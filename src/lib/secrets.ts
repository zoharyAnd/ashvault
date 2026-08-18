import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { secrets, accessLogs, type Secret } from "@/db/schema";

export type ClaimStatus = "available" | "gone" | "expired" | "not_found";

export interface CreateSecretArgs {
  ciphertext: string;
  iv: string;
  maxViews: number;
  ttlMinutes: number;
  ownerId?: string | null;
}

export async function createSecret(args: CreateSecretArgs): Promise<{
  id: string;
  expiresAt: Date;
}> {
  const expiresAt = new Date(Date.now() + args.ttlMinutes * 60_000);
  const [row] = await db
    .insert(secrets)
    .values({
      ciphertext: args.ciphertext,
      iv: args.iv,
      maxViews: args.maxViews,
      expiresAt,
      ownerId: args.ownerId ?? null,
    })
    .returning({ id: secrets.id, expiresAt: secrets.expiresAt });
  return row;
}

/**
 * Read a secret's status WITHOUT consuming a view. Used to render the
 * pre-reveal screen ("this is a one-time secret, reveal it?") so that link
 * preview bots and page refreshes don't burn the secret.
 */
export async function getSecretStatus(id: string): Promise<{
  status: ClaimStatus;
  remainingViews: number;
  maxViews: number;
  expiresAt: Date | null;
}> {
  const row = await db.query.secrets.findFirst({
    where: eq(secrets.id, id),
  });

  if (!row) {
    return { status: "not_found", remainingViews: 0, maxViews: 0, expiresAt: null };
  }

  const now = Date.now();
  const expired = row.expiresAt.getTime() <= now;
  const burned = row.burnedAt !== null || row.viewCount >= row.maxViews;

  let status: ClaimStatus = "available";
  if (expired) status = "expired";
  else if (burned) status = "gone";

  // Opportunistically shred ciphertext for expired-but-not-yet-swept rows.
  if (expired && row.ciphertext !== null) {
    await shred(id);
  }

  return {
    status,
    remainingViews: Math.max(0, row.maxViews - row.viewCount),
    maxViews: row.maxViews,
    expiresAt: row.expiresAt,
  };
}

/**
 * Atomically claim one view of a secret.
 *
 * This is the concurrency-critical operation. The single UPDATE below relies on
 * Postgres row-level locking: when two requests race for the last view, the
 * database serialises them, so exactly one sees `view_count < max_views` and
 * wins. The loser's WHERE no longer matches and it gets zero rows — meaning
 * "already taken". No application-level lock, no read-modify-write window.
 *
 * `view_count` / the boolean in RETURNING reflect the POST-update values, so
 * `burned` is true precisely when this claim consumed the final view.
 */
export async function claimSecret(id: string): Promise<{
  status: ClaimStatus;
  ciphertext?: string;
  iv?: string;
}> {
  const result = await db.execute<{
    ciphertext: string;
    iv: string;
    burned: boolean;
  }>(sql`
    UPDATE ${secrets}
    SET view_count = view_count + 1,
        burned_at = CASE
          WHEN view_count + 1 >= max_views THEN now()
          ELSE burned_at
        END
    WHERE id = ${id}
      AND burned_at IS NULL
      AND view_count < max_views
      AND expires_at > now()
    RETURNING ciphertext, iv, (view_count >= max_views) AS burned
  `);

  const rows = result as unknown as Array<{
    ciphertext: string;
    iv: string;
    burned: boolean;
  }>;

  if (rows.length > 0) {
    const claimed = rows[0];
    // If that was the final view, shred the ciphertext so it can never be
    // recovered from the database — not even from a later backup/dump.
    if (claimed.burned) {
      await shred(id);
    }
    return { status: "available", ciphertext: claimed.ciphertext, iv: claimed.iv };
  }

  // The claim failed — figure out why, for the correct status code & audit entry.
  const existing = await db.query.secrets.findFirst({
    where: eq(secrets.id, id),
    columns: { id: true, expiresAt: true, viewCount: true, maxViews: true, burnedAt: true, ciphertext: true },
  });
  if (!existing) return { status: "not_found" };

  if (existing.expiresAt.getTime() <= Date.now()) {
    if (existing.ciphertext !== null) await shred(id);
    return { status: "expired" };
  }
  return { status: "gone" };
}

/** Null out ciphertext + iv so the plaintext is unrecoverable. */
async function shred(id: string): Promise<void> {
  await db
    .update(secrets)
    .set({ ciphertext: null, iv: null })
    .where(eq(secrets.id, id));
}

export type AccessResult = "success" | "gone" | "expired" | "not_found";

export async function logAccess(entry: {
  secretId: string;
  result: AccessResult;
  ipHash?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await db.insert(accessLogs).values({
    secretId: entry.secretId,
    result: entry.result,
    ipHash: entry.ipHash ?? null,
    userAgent: entry.userAgent ?? null,
  });
}

/** Map a claim status to the access-log result + HTTP status code. */
export function statusToHttp(status: ClaimStatus): {
  result: AccessResult;
  code: number;
} {
  switch (status) {
    case "available":
      return { result: "success", code: 200 };
    case "expired":
      return { result: "expired", code: 410 };
    case "gone":
      return { result: "gone", code: 410 };
    case "not_found":
      return { result: "not_found", code: 404 };
  }
}

// --- dashboard queries ------------------------------------------------------

export type SecretState = "active" | "burned" | "expired";

export interface OwnedSecret extends Secret {
  accessCount: number;
  lastAccessedAt: Date | null;
  state: SecretState;
}

export async function listSecretsForOwner(
  ownerId: string,
): Promise<OwnedSecret[]> {
  const rows = await db
    .select({
      secret: secrets,
      accessCount: sql<number>`count(${accessLogs.id})`.mapWith(Number),
      lastAccessedAt: sql<Date | null>`max(${accessLogs.createdAt})`,
    })
    .from(secrets)
    .leftJoin(
      accessLogs,
      and(
        eq(accessLogs.secretId, secrets.id),
        eq(accessLogs.result, "success"),
      ),
    )
    .where(eq(secrets.ownerId, ownerId))
    .groupBy(secrets.id)
    .orderBy(desc(secrets.createdAt));

  const now = Date.now();
  return rows.map((r) => {
    const s = r.secret;
    let state: SecretState = "active";
    if (s.burnedAt || s.viewCount >= s.maxViews) state = "burned";
    else if (s.expiresAt.getTime() <= now) state = "expired";
    return {
      ...s,
      accessCount: r.accessCount,
      lastAccessedAt: r.lastAccessedAt,
      state,
    };
  });
}

export async function getAuditLog(
  secretId: string,
  ownerId: string,
): Promise<{ ok: boolean; logs: Array<typeof accessLogs.$inferSelect> }> {
  // Ownership check FIRST — user A must never read user B's audit log.
  const owned = await db.query.secrets.findFirst({
    where: and(eq(secrets.id, secretId), eq(secrets.ownerId, ownerId)),
    columns: { id: true },
  });
  if (!owned) return { ok: false, logs: [] };

  const logs = await db.query.accessLogs.findMany({
    where: eq(accessLogs.secretId, secretId),
    orderBy: (l, { desc: d }) => [d(l.createdAt)],
  });
  return { ok: true, logs };
}
