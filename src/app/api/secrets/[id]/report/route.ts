import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { abuseReports, secrets } from "@/db/schema";
import { abuseReportSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/request-meta";

export const dynamic = "force-dynamic";

/** Anyone can flag a link for abuse; admins triage it in the admin panel. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ip = getClientIp(req.headers);
  const limit = await rateLimit(`report:${ip}`, { limit: 20, windowSec: 3600 });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: limit.headers },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = abuseReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const exists = await db.query.secrets.findFirst({
    where: eq(secrets.id, id),
    columns: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.insert(abuseReports).values({
    secretId: id,
    reason: parsed.data.reason,
    reporterIpHash: hashIp(ip),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
