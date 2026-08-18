import { z } from "zod";

/**
 * Centralised, validated environment access.
 *
 * Anything the server needs is parsed once here so a misconfigured deploy fails
 * loudly at boot instead of mysteriously at request time. Client-safe values are
 * only ever read through `NEXT_PUBLIC_*`, which Next.js inlines at build time.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

function parseEnv() {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = parseEnv();

/** True when both Upstash credentials are present (distributed rate limiter). */
export const hasUpstash = Boolean(
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN,
);
