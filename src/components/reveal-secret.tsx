"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { openSecret } from "@/lib/crypto";

type Phase =
  | "checking"
  | "ready" // exists & available, awaiting user click
  | "revealed"
  | "gone"
  | "expired"
  | "not_found"
  | "no_key"
  | "decrypt_error";

export function RevealSecret({ id }: { id: string }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [plaintext, setPlaintext] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);

  const keyFragment =
    typeof window !== "undefined"
      ? decodeURIComponent(window.location.hash.replace(/^#/, ""))
      : "";

  // Non-consuming status check on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!keyFragment) {
        setPhase("no_key");
        return;
      }
      try {
        const res = await fetch(`/api/secrets/${id}`, { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (data.status === "available") {
          setRemaining(data.remainingViews ?? null);
          setPhase("ready");
        } else {
          setPhase(data.status as Phase);
        }
      } catch {
        if (active) setPhase("not_found");
      }
    })();
    return () => {
      active = false;
    };
  }, [id, keyFragment]);

  const reveal = useCallback(async () => {
    setRevealing(true);
    try {
      const res = await fetch(`/api/secrets/${id}/reveal`, { method: "POST" });
      if (!res.ok) {
        // 410 / 404 — someone else won the race, or it expired between check and click.
        const data = await res.json().catch(() => ({}));
        setPhase((data.status as Phase) ?? "gone");
        return;
      }
      const data = (await res.json()) as { ciphertext: string; iv: string };
      const text = await openSecret(
        { ciphertext: data.ciphertext, iv: data.iv },
        keyFragment,
      );
      setPlaintext(text);
      setPhase("revealed");
    } catch {
      // The server burned the row, but we couldn't decrypt (bad/edited key).
      setPhase("decrypt_error");
    } finally {
      setRevealing(false);
    }
  }, [id, keyFragment]);

  async function copy() {
    await navigator.clipboard.writeText(plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-xl">
      {phase === "checking" && (
        <Panel>
          <p className="text-muted">Checking the vault…</p>
        </Panel>
      )}

      {phase === "ready" && (
        <Panel>
          <span className="badge border-ember/40 text-ember-soft">
            🔥 one-time secret
          </span>
          <h1 className="mt-3 text-2xl font-semibold">
            Someone shared a secret with you
          </h1>
          <p className="mt-2 text-sm text-muted">
            {remaining === 1
              ? "You can reveal it once. The moment you do, it's destroyed forever — so have somewhere to put it."
              : `This secret has ${remaining} views left. Revealing it uses one.`}
          </p>
          <button
            onClick={reveal}
            disabled={revealing}
            className="btn-primary mt-6 w-full"
          >
            {revealing ? "Decrypting…" : "Reveal secret"}
          </button>
          <ReportLink id={id} />
        </Panel>
      )}

      {phase === "revealed" && (
        <Panel>
          <span className="badge border-success/40 text-success">
            ● decrypted locally
          </span>
          <h1 className="mt-3 text-2xl font-semibold">Here it is</h1>
          <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface-2 p-4 font-mono text-sm">
            {plaintext}
          </pre>
          <button onClick={copy} className="btn-ghost mt-4">
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
            This secret has now been destroyed on the server. Refresh this page
            and it will be gone.
          </div>
        </Panel>
      )}

      {phase === "gone" && (
        <Ash
          title="This secret is gone"
          body="It has already been viewed the maximum number of times. There's nothing left to recover — the ciphertext was shredded on the final read."
        />
      )}
      {phase === "expired" && (
        <Ash
          title="This secret has expired"
          body="The link passed its expiry time and was destroyed."
        />
      )}
      {phase === "not_found" && (
        <Ash
          title="No such secret"
          body="This link doesn't point to anything — it may have been mistyped, or it was already burned."
        />
      )}
      {phase === "no_key" && (
        <Ash
          title="This link is missing its key"
          body="The decryption key lives in the part of the URL after the # symbol. It looks like it got cut off, so this secret can't be decrypted."
        />
      )}
      {phase === "decrypt_error" && (
        <Ash
          title="Couldn't decrypt this secret"
          body="The server released the ciphertext but the key in this link didn't fit it — the link may be corrupted. Note: the one-time view has now been used up."
        />
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="card p-6">{children}</div>;
}

function Ash({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-8 text-center">
      <div className="text-4xl">🌑</div>
      <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{body}</p>
      <Link href="/" className="btn-primary mt-6">
        Create your own secret
      </Link>
    </div>
  );
}

function ReportLink({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="mt-4 text-center text-xs text-muted">
        Thanks — this link has been reported to the administrators.
      </p>
    );
  }

  return (
    <div className="mt-4 text-center">
      {open ? (
        <div className="text-left">
          <input
            className="input text-xs"
            placeholder="What's wrong with this link?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="btn-danger !py-1.5 text-xs"
              onClick={async () => {
                if (reason.trim().length < 3) return;
                await fetch(`/api/secrets/${id}/report`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reason }),
                });
                setDone(true);
              }}
            >
              Submit report
            </button>
            <button
              className="btn-ghost !py-1.5 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-muted underline hover:text-foreground"
        >
          Report this link as abuse
        </button>
      )}
    </div>
  );
}
