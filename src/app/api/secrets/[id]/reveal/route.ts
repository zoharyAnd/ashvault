import { NextResponse } from "next/server";

import { claimSecret, logAccess, statusToHttp } from "@/lib/secrets";
import { rateLimit } from "@/lib/rate-limit";
import {
  getClientIp,
  hashIp,
  getUserAgent,
} from "@/lib/request-meta";

export const dynamic = "force-dynamic";

/**
 * Consuming reveal. A POST (not GET) so that only a deliberate user action
 * burns the secret. Atomically claims one view; returns ciphertext + IV for the
 * client to decrypt with the key from the URL fragment.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ip = getClientIp(req.headers);
  const limit = await rateLimit(`reveal:${ip}`, { limit: 60, windowSec: 600 });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: limit.headers },
    );
  }

  const claim = await claimSecret(id);
  const { result, code } = statusToHttp(claim.status);

  // Audit every attempt — successful or not — with a salted IP hash, never raw.
  await logAccess({
    secretId: id,
    result,
    ipHash: hashIp(ip),
    userAgent: getUserAgent(req.headers),
  });

  if (claim.status !== "available") {
    return NextResponse.json({ status: claim.status }, { status: code });
  }

  return NextResponse.json(
    {
      status: "available",
      ciphertext: claim.ciphertext,
      iv: claim.iv,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
