import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  primaryKey,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

/**
 * Roles for RBAC. `user` sees only their own secrets and audit log;
 * `admin` additionally sees system health and abuse reports.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);

// ---------------------------------------------------------------------------
// Auth tables (users + Auth.js account/session/verification tables)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // Null for OAuth-only accounts; set for credentials sign-in.
  passwordHash: text("password_hash"),
  role: roleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---------------------------------------------------------------------------
// Secrets — the encrypted payloads. The server stores ONLY ciphertext.
// The decryption key never touches the server (it lives in the URL fragment).
// ---------------------------------------------------------------------------

export const secrets = pgTable(
  "secrets",
  {
    // Public, unguessable id used in share links.
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    // AES-256-GCM ciphertext + iv, base64url encoded. Nulled out once burned so
    // the plaintext is unrecoverable even from a DB dump after the final read.
    ciphertext: text("ciphertext"),
    iv: text("iv"),
    // GCM auth tag length / algorithm marker for forward compatibility.
    algorithm: text("algorithm").notNull().default("AES-GCM-256"),

    // Access policy.
    maxViews: integer("max_views").notNull().default(1),
    viewCount: integer("view_count").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),

    // True once the secret can never be read again (view cap hit or expired+swept).
    burnedAt: timestamp("burned_at"),

    // Null for anonymous senders; set for registered users (enables dashboard).
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("secrets_owner_idx").on(t.ownerId),
    index("secrets_expires_idx").on(t.expiresAt),
  ],
);

// ---------------------------------------------------------------------------
// Access log — the audit trail. One row per read attempt (successful or not).
// ---------------------------------------------------------------------------

export const accessResultEnum = pgEnum("access_result", [
  "success", // ciphertext handed out
  "gone", // already burned / view cap hit
  "expired", // past expiry
  "not_found", // no such id
]);

export const accessLogs = pgTable(
  "access_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    secretId: text("secret_id").notNull(),
    result: accessResultEnum("result").notNull(),
    ipHash: text("ip_hash"), // salted hash of the client IP (never the raw IP)
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("access_logs_secret_idx").on(t.secretId)],
);

// ---------------------------------------------------------------------------
// Abuse reports — anyone can flag a link; admins triage them.
// ---------------------------------------------------------------------------

export const abuseReports = pgTable("abuse_reports", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  secretId: text("secret_id").notNull(),
  reason: text("reason").notNull(),
  reporterIpHash: text("reporter_ip_hash"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations (typed joins for the dashboard queries)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  secrets: many(secrets),
}));

export const secretsRelations = relations(secrets, ({ one, many }) => ({
  owner: one(users, {
    fields: [secrets.ownerId],
    references: [users.id],
  }),
  accessLogs: many(accessLogs),
}));

export const accessLogsRelations = relations(accessLogs, ({ one }) => ({
  secret: one(secrets, {
    fields: [accessLogs.secretId],
    references: [secrets.id],
  }),
}));

// Convenience types
export type User = typeof users.$inferSelect;
export type Secret = typeof secrets.$inferSelect;
export type NewSecret = typeof secrets.$inferInsert;
export type AccessLog = typeof accessLogs.$inferSelect;
export type AbuseReport = typeof abuseReports.$inferSelect;
