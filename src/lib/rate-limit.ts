import "server-only";
import { hasUpstash, env } from "./env";

/**
 * Pluggable rate limiter.
 *
 * - Dev / single instance: an in-memory fixed-window counter (no infra needed).
 * - Production (Vercel, multi-instance): Upstash Redis sliding window, enabled
 *   automatically when both UPSTASH_* env vars are set.
 *
 * A security app that can be spammed isn't a security app — so both the write
 * path (creating secrets, registering) and the read path are limited by IP.
 */

export interface RateLimitOptions {
  /** Max requests permitted within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch seconds when the window resets. */
  reset: number;
  headers: Record<string, string>;
}

function buildHeaders(
  limit: number,
  remaining: number,
  reset: number,
  success: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(limit),
    "RateLimit-Remaining": String(remaining),
    "RateLimit-Reset": String(reset),
  };
  if (!success) {
    headers["Retry-After"] = String(Math.max(0, reset - Math.floor(Date.now() / 1000)));
  }
  return headers;
}

// --- in-memory backend -----------------------------------------------------

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function sweep(now: number) {
  if (memoryStore.size < 5000) return;
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt < now) memoryStore.delete(key);
  }
}

function memoryLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + opts.windowSec * 1000;
    memoryStore.set(key, { count: 1, resetAt });
    const resetSec = Math.ceil(resetAt / 1000);
    return {
      success: true,
      limit: opts.limit,
      remaining: opts.limit - 1,
      reset: resetSec,
      headers: buildHeaders(opts.limit, opts.limit - 1, resetSec, true),
    };
  }

  entry.count += 1;
  const success = entry.count <= opts.limit;
  const remaining = Math.max(0, opts.limit - entry.count);
  const resetSec = Math.ceil(entry.resetAt / 1000);
  return {
    success,
    limit: opts.limit,
    remaining,
    reset: resetSec,
    headers: buildHeaders(opts.limit, remaining, resetSec, success),
  };
}

// --- Upstash backend (lazy, only when configured) --------------------------

type UpstashLimiter = {
  limit: (id: string) => Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
};

let redisClient: unknown;
const upstashLimiters = new Map<string, UpstashLimiter>();

async function getUpstashLimiter(
  opts: RateLimitOptions,
): Promise<UpstashLimiter> {
  const cacheKey = `${opts.limit}:${opts.windowSec}`;
  const cached = upstashLimiters.get(cacheKey);
  if (cached) return cached;

  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  redisClient ??= new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const limiter = new Ratelimit({
    redis: redisClient as ConstructorParameters<typeof Ratelimit>[0]["redis"],
    limiter: Ratelimit.slidingWindow(opts.limit, `${opts.windowSec} s`),
    prefix: "ashvault:rl",
    analytics: false,
  }) as unknown as UpstashLimiter;

  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

// --- public API ------------------------------------------------------------

export async function rateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  if (!hasUpstash) {
    return memoryLimit(key, opts);
  }

  const limiter = await getUpstashLimiter(opts);
  const res = await limiter.limit(key);
  const resetSec = Math.ceil(res.reset / 1000);
  return {
    success: res.success,
    limit: res.limit,
    remaining: res.remaining,
    reset: resetSec,
    headers: buildHeaders(res.limit, res.remaining, resetSec, res.success),
  };
}
