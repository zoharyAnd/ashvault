import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { registerSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const limit = await rateLimit(`register:${ip}`, { limit: 5, windowSec: 3600 });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many accounts created. Try again later." },
      { status: 429, headers: limit.headers },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    // Avoid leaking which emails are registered beyond a generic conflict.
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db
    .insert(users)
    .values({ name, email, passwordHash })
    .returning({ id: users.id, email: users.email });

  return NextResponse.json({ id: created.id, email: created.email }, {
    status: 201,
  });
}
