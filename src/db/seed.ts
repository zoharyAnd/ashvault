import { config } from "dotenv";
config({ path: ".env" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

type SeedUser = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
};

/**
 * Seed users are sourced entirely from the environment — no credentials live in
 * this file or anywhere in the repo. A user is only seeded when BOTH its email
 * and password env vars are present, so running `pnpm db:seed` without them
 * configured is a no-op. Set them in your local .env (see .env.example) or as
 * CI secrets. The e2e suite reads the same vars in e2e/helpers.ts.
 */
function userFromEnv(
  name: string,
  role: "admin" | "user",
  emailVar: string,
  passwordVar: string,
): SeedUser | null {
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  if (!email || !password) return null;
  return { name, email, password, role };
}

const SEED_USERS: SeedUser[] = [
  userFromEnv("Ada Admin", "admin", "SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD"),
  userFromEnv("User One", "user", "SEED_USER1_EMAIL", "SEED_USER1_PASSWORD"),
  userFromEnv("User Two", "user", "SEED_USER2_EMAIL", "SEED_USER2_PASSWORD"),
].filter((u): u is SeedUser => u !== null);

async function main() {
  // Guard: never let the seed create login accounts on a hosted instance.
  // Requires a deliberate opt-in even when seed users are configured via env.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error(
      "Refusing to seed with NODE_ENV=production. Set ALLOW_PROD_SEED=true " +
        "only if you truly intend to create these accounts on production.",
    );
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  if (SEED_USERS.length === 0) {
    console.log(
      "No seed users configured — set SEED_ADMIN_EMAIL/PASSWORD, " +
        "SEED_USER1_EMAIL/PASSWORD, SEED_USER2_EMAIL/PASSWORD to seed accounts.",
    );
    return;
  }

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
