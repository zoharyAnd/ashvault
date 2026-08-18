import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "./logo";
import { signOutAction } from "@/app/actions";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Logo />
          <span>
            Ash<span className="text-ember">Vault</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-muted hover:text-foreground"
          >
            New secret
          </Link>

          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-muted hover:text-foreground"
              >
                Dashboard
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="rounded-md px-3 py-1.5 text-ember hover:text-ember-soft"
                >
                  Admin
                </Link>
              )}
              <span className="mx-2 hidden text-xs text-muted sm:inline">
                {user.email}
              </span>
              <form action={signOutAction}>
                <button type="submit" className="btn-ghost !py-1.5 !px-3">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-muted hover:text-foreground"
              >
                Log in
              </Link>
              <Link href="/register" className="btn-primary !py-1.5 !px-3">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
