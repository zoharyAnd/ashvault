import "server-only";
import { createHash } from "crypto";
import { env } from "./env";

/**
 * Extract the client IP from proxy headers. On Vercel/most proxies the real
 * client address is the first entry of `x-forwarded-for`.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() ?? "unknown";
}

/**
 * Salted SHA-256 of an IP. We keep an audit trail ("was this opened, and roughly
 * by whom") without ever storing a raw IP address — the hash is stable enough to
 * correlate repeat access but not reversible back to the address.
 */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${env.AUTH_SECRET}:${ip}`)
    .digest("base64url");
}

export function getUserAgent(headers: Headers): string | null {
  return headers.get("user-agent");
}
