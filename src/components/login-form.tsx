"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-muted">
        Access your dashboard and audit logs.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary mt-5 w-full">
        {loading ? "Signing in…" : "Log in"}
      </button>

      <p className="mt-4 text-center text-sm text-muted">
        No account?{" "}
        <Link href="/register" className="text-ember hover:text-ember-soft">
          Create one
        </Link>
      </p>
    </form>
  );
}
