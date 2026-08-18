import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createSecret } from "@/lib/secrets";
import { createSecretSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";
import { env } from "@/lib/env";

// Secrets are dynamic per-request; never cache.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const limit = await rateLimit(`create:${ip}`, { limit: 30, windowSec: 3600 });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Slow down." },
      { status: 429, headers: limit.headers },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createSecretSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Anonymous senders are allowed; registered users get an owner + dashboard.
  const session = await auth();
  const ownerId = session?.user?.id ?? null;

  const { ciphertext, iv, maxViews, ttlMinutes } = parsed.data;
  const { id, expiresAt } = await createSecret({
    ciphertext,
    iv,
    maxViews,
    ttlMinutes,
    ownerId,
  });

  const url = `${env.NEXT_PUBLIC_APP_URL}/s/${id}`;
  return NextResponse.json(
    { id, url, expiresAt, maxViews },
    { status: 201, headers: limit.headers },
  );
}
