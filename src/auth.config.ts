import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth configuration.
 *
 * This half deliberately contains NO database adapter and NO Node-only crypto
 * (bcrypt), so it can be imported into the middleware (which runs on the Edge
 * runtime) to read the signed JWT and make routing decisions. The heavy half —
 * the Drizzle adapter and the Credentials provider — lives in `auth.ts`.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    // Credentials sign-in requires JWT sessions (no DB session row).
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "user" | "admin";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
