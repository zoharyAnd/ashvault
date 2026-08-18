import { CreateSecretForm } from "@/components/create-secret-form";

const FEATURES = [
  {
    title: "Encrypted before it leaves your browser",
    body: "AES-256-GCM runs client-side. The server stores ciphertext and an IV — never the plaintext, never the key.",
  },
  {
    title: "Reads exactly once",
    body: "The link is claimed with a single atomic database update. Two people opening it at once? Only one wins; the other sees ash.",
  },
  {
    title: "Time-boxed & auditable",
    body: "Set an expiry and a view budget. Sign in to see an audit trail of when each secret was opened.",
  },
];

export default function Home() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      <section className="flex flex-col justify-center">
        <span className="badge w-fit border-ember/40 text-ember-soft">
          zero-knowledge · one-time
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Send a secret that{" "}
          <span className="text-ember">burns after reading</span>.
        </h1>
        <p className="mt-4 max-w-md text-muted">
          Passwords, API keys, private notes — share them through a link that
          works exactly once, then destroys itself. End-to-end encrypted, so not
          even AshVault can read what you send.
        </p>

        <ul className="mt-8 space-y-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3">
              <span className="mt-1 text-ember">◆</span>
              <div>
                <p className="font-medium">{f.title}</p>
                <p className="text-sm text-muted">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-start">
        <div className="w-full">
          <CreateSecretForm />
        </div>
      </section>
    </div>
  );
}
