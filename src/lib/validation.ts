import { z } from "zod";

/** Shared Zod schemas — the single source of truth for request validation. */

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// A sealed secret arrives already encrypted: the server only sees ciphertext.
export const createSecretSchema = z.object({
  ciphertext: z.string().min(1).max(200_000),
  iv: z.string().min(1).max(64),
  // 1 = classic one-time link. Cap keeps the concurrency story honest.
  maxViews: z.number().int().min(1).max(100).default(1),
  // Time-boxing: minutes until expiry (min 1 minute, max 30 days).
  ttlMinutes: z
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 30)
    .default(60 * 24), // 24h default
});
export type CreateSecretInput = z.infer<typeof createSecretSchema>;

export const abuseReportSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
