import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listSecretsForOwner, type SecretState } from "@/lib/secrets";

export const metadata = { title: "Dashboard · AshVault" };
export const dynamic = "force-dynamic";

const STATE_META: Record<SecretState, { label: string; className: string }> = {
  active: { label: "Active", className: "border-success/40 text-success" },
  burned: { label: "Burned", className: "border-danger/40 text-danger" },
  expired: { label: "Expired", className: "border-muted/40 text-muted" },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  const secrets = await listSecretsForOwner(session.user.id);

  const active = secrets.filter((s) => s.state === "active").length;
  const totalOpens = secrets.reduce((n, s) => n + s.accessCount, 0);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your secrets</h1>
          <p className="mt-1 text-sm text-muted">
            Metadata and audit trails. AshVault never stored the plaintext, so
            it can&apos;t be shown here either.
          </p>
        </div>
        <Link href="/" className="btn-primary">
          New secret
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Total secrets" value={secrets.length} />
        <Stat label="Currently active" value={active} />
        <Stat label="Successful opens" value={totalOpens} />
      </div>

      <div className="card mt-6 overflow-hidden">
        {secrets.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            You haven&apos;t created any secrets while signed in yet.{" "}
            <Link href="/" className="text-ember hover:text-ember-soft">
              Create one
            </Link>{" "}
            to see it here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Secret ID</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Views</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {secrets.map((s) => {
                  const state = STATE_META[s.state];
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {s.id.slice(0, 10)}…
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${state.className}`}>
                          {state.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {s.viewCount}/{s.maxViews}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {s.expiresAt.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {s.createdAt.toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/secrets/${s.id}`}
                          className="text-ember hover:text-ember-soft"
                        >
                          Audit log →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
