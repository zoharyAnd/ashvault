import { type Page, type APIRequestContext, expect } from "@playwright/test";
import postgres from "postgres";
import { sealSecret } from "../src/lib/crypto";

/** Seeded credentials (see src/db/seed.ts). */
export const USERS = {
  admin: { email: "REDACTED", password: "REDACTED" },
  alice: { email: "REDACTED", password: "REDACTED" },
  bob: { email: "REDACTED", password: "REDACTED" },
};

export async function login(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto("/login");
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
}

export interface CreatedSecret {
  id: string;
  keyFragment: string;
}

/**
 * Create a secret through the real API using the given request context.
 * Encryption happens here (client-side, exactly as the browser would), so the
 * server only ever receives ciphertext. Pass `page.request` to create it as the
 * logged-in user, or a bare `request` fixture to create it anonymously.
 */
export async function createSecret(
  request: APIRequestContext,
  plaintext: string,
  opts: { maxViews?: number; ttlMinutes?: number } = {},
): Promise<CreatedSecret> {
  const sealed = await sealSecret(plaintext);
  const res = await request.post("/api/secrets", {
    data: {
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      maxViews: opts.maxViews ?? 1,
      ttlMinutes: opts.ttlMinutes ?? 60,
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { id: body.id, keyFragment: sealed.keyFragment };
}

/** Directly age a secret's expiry into the past (for expiry tests). */
export async function expireSecret(id: string) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await sql`UPDATE secrets SET expires_at = now() - interval '1 minute' WHERE id = ${id}`;
  } finally {
    await sql.end();
  }
}

/** Read a secret row straight from the DB (to assert shredding). */
export async function readSecretRow(id: string) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const rows = await sql`SELECT ciphertext, view_count, max_views, burned_at FROM secrets WHERE id = ${id}`;
    return rows[0] ?? null;
  } finally {
    await sql.end();
  }
}
