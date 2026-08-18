import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * A single shared postgres-js connection pool. In dev, Next.js hot-reloads
 * modules, which would otherwise open a new pool on every change and exhaust
 * connections — so we cache the client on `globalThis`.
 */
const globalForDb = globalThis as unknown as {
  __ashvaultClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__ashvaultClient ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 10 : 5,
  });

if (env.NODE_ENV !== "production") {
  globalForDb.__ashvaultClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
