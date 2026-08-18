import { config } from "dotenv";
config({ path: ".env" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const SEED_USERS: { name: string; email: string; password: string; role: "admin" | "user" }[] = [];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  for (const u of SEED_USERS) {
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, u.email),
    });
    if (existing) {
      console.log(`• ${u.email} already exists — skipping`);
      continue;
    }
    await db.insert(schema.users).values({
      name: u.name,
      email: u.email,
      passwordHash: await bcrypt.hash(u.password, 12),
      role: u.role,
    });
    console.log(`✓ created ${u.email} (${u.role})`);
  }

  await client.end();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
