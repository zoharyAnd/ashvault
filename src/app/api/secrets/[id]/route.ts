import { NextResponse } from "next/server";

import { getSecretStatus, statusToHttp } from "@/lib/secrets";

export const dynamic = "force-dynamic";

/**
 * Non-consuming status check. Renders the pre-reveal screen without burning the
 * secret, so refreshes and link-preview bots don't destroy it.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const status = await getSecretStatus(id);
  const { code } = statusToHttp(status.status);

  return NextResponse.json(
    {
      status: status.status,
      remainingViews: status.remainingViews,
      maxViews: status.maxViews,
      expiresAt: status.expiresAt,
    },
    { status: status.status === "available" ? 200 : code },
  );
}
