import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

/**
 * Route protection runs on the Edge runtime, so it uses the adapter-free,
 * bcrypt-free `authConfig`. It only reads the signed JWT (which already carries
 * `role`) — no database access needed to decide access.
 *
 *   /dashboard/*  → any signed-in user
 *   /admin/*      → role === "admin" only
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isLoggedIn = !!session;
  const isAdmin = session?.user?.role === "admin";

  const needsAdmin = nextUrl.pathname.startsWith("/admin");
  const needsAuth =
    needsAdmin || nextUrl.pathname.startsWith("/dashboard");

  if (needsAuth && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (needsAdmin && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
