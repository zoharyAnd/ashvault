"use client";

import { useState } from "react";
import { sealSecret } from "@/lib/crypto";

const TTL_OPTIONS = [
  { label: "10 minutes", value: 10 },
  { label: "1 hour", value: 60 },
  { label: "24 hours", value: 60 * 24 },
  { label: "7 days", value: 60 * 24 * 7 },
];

interface CreatedLink {
  url: string;
  expiresAt: string;
  maxViews: number;
}

export function CreateSecretForm() {
  const [secret, setSecret] = useState("");
  const [maxViews, setMaxViews] = useState(1);
  const [ttlMinutes, setTtlMinutes] = useState(60 * 24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!secret.trim()) {
      setError("Enter a secret to share.");
      return;
    }
    setLoading(true);
    try {
      // 1) Encrypt entirely in the browser. The key never leaves this device
      //    except inside the URL fragment we build below.
      const { ciphertext, iv, keyFragment } = await sealSecret(secret);

      // 2) Send only ciphertext + iv to the server.
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciphertext, iv, maxViews, ttlMinutes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create secret.");
      }
      const data = (await res.json()) as {
        url: string;
        expiresAt: string;
        maxViews: number;
      };

      // 3) Append the key as a URL fragment (#…). Fragments are never sent in
      //    HTTP requests, so the server can never learn the key.
      setCreated({
        url: `${data.url}#${keyFragment}`,
        expiresAt: data.expiresAt,
        maxViews: data.maxViews,
      });
      setSecret("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    await navigator.clipboard.writeText(created.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (created) {
    return (
      <div className="card p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="badge border-success/40 text-success">
            ● Link ready
          </span>
        </div>
        <h2 className="text-lg font-semibold">Share this link</h2>
        <p className="mt-1 text-sm text-muted">
          {created.maxViews === 1
            ? "It can be opened exactly once, then it's gone forever."
            : `It can be opened ${created.maxViews} times, then it's gone forever.`}{" "}
          Expires {new Date(created.expiresAt).toLocaleString()}.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            readOnly
            value={created.url}
            className="input font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button onClick={copyLink} className="btn-primary shrink-0">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-ember/30 bg-ember/5 p-3 text-xs text-ember-soft">
          ⚠ We can&apos;t show you this link again — the decryption key lives only
          in the part after <code className="font-mono">#</code>, and it never
          reached our server. Copy it now.
        </div>

        <button
          onClick={() => setCreated(null)}
          className="btn-ghost mt-4"
        >
          Create another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <label htmlFor="secret" className="label">
        Your secret
      </label>
      <textarea
        id="secret"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="Paste a password, API key, or private note…"
        rows={10}
        className="input resize-y font-mono"
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="views" className="label">
            Number of views
          </label>
          <select
            id="views"
            value={maxViews}
            onChange={(e) => setMaxViews(Number(e.target.value))}
            className="input"
          >
            <option value={1}>1 — classic one-time link</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </div>
        <div>
          <label htmlFor="ttl" className="label">
            Expires after
          </label>
          <select
            id="ttl"
            value={ttlMinutes}
            onChange={(e) => setTtlMinutes(Number(e.target.value))}
            className="input"
          >
            {TTL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary mt-5 w-full"
      >
        {loading ? "Encrypting…" : "Create secret link"}
      </button>
      <p className="mt-3 text-center text-xs text-muted">
        Encrypted in your browser with AES-256-GCM before it&apos;s sent. The
        server only ever stores ciphertext.
      </p>
    </form>
  );
}
