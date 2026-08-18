"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not create account.");
      }
      // Auto sign-in after successful registration.
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        // Account exists but sign-in failed — send them to login.
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <p className="mt-1 text-sm text-muted">
        Registered senders get a dashboard and an audit trail for every secret.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Name <span className="text-muted">(optional)</span>
          </label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
            Password <span className="text-muted">(min 8 characters)</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
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
        {loading ? "Creating…" : "Create account"}
      </button>

      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-ember hover:text-ember-soft">
          Log in
        </Link>
      </p>
    </form>
  );
}
