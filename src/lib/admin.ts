import "server-only";
import { and, count, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { users, secrets, accessLogs, abuseReports } from "@/db/schema";

export interface SystemHealth {
  users: number;
  totalSecrets: number;
  activeSecrets: number;
  burnedSecrets: number;
  accessAttempts: number;
  failedAccessAttempts: number;
  openReports: number;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const now = new Date();
  const [
    userCount,
    secretCount,
    activeCount,
    burnedCount,
    accessCount,
    failedCount,
    reportCount,
  ] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(secrets),
    db
      .select({ n: count() })
      .from(secrets)
      .where(
        and(
          isNull(secrets.burnedAt),
          gt(secrets.expiresAt, now),
          sql`${secrets.viewCount} < ${secrets.maxViews}`,
        ),
      ),
    db
      .select({ n: count() })
      .from(secrets)
      .where(sql`${secrets.burnedAt} is not null`),
    db.select({ n: count() }).from(accessLogs),
    db
      .select({ n: count() })
      .from(accessLogs)
      .where(sql`${accessLogs.result} <> 'success'`),
    db
      .select({ n: count() })
      .from(abuseReports)
      .where(eq(abuseReports.resolved, false)),
  ]);

  return {
    users: userCount[0].n,
    totalSecrets: secretCount[0].n,
    activeSecrets: activeCount[0].n,
    burnedSecrets: burnedCount[0].n,
    accessAttempts: accessCount[0].n,
    failedAccessAttempts: failedCount[0].n,
    openReports: reportCount[0].n,
  };
}

export async function listAbuseReports(limit = 50) {
  return db.query.abuseReports.findMany({
    orderBy: [desc(abuseReports.createdAt)],
    limit,
  });
}

/** Count secrets that have expired but not yet been swept (ciphertext lingering). */
export async function countExpiredUnswept(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(secrets)
    .where(
      and(
        lte(secrets.expiresAt, new Date()),
        sql`${secrets.ciphertext} is not null`,
      ),
    );
  return row.n;
}
