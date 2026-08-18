import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAuditLog } from "@/lib/secrets";

export const dynamic = "force-dynamic";

const RESULT_STYLES: Record<string, string> = {
  success: "border-success/40 text-success",
  gone: "border-danger/40 text-danger",
  expired: "border-muted/40 text-muted",
  not_found: "border-muted/40 text-muted",
};

export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  // Ownership is enforced inside getAuditLog: another user's secret returns
  // ok:false, which we surface as a 404 — never their audit data.
  const { ok, logs } = await getAuditLog(id, session.user.id);
  if (!ok) notFound();

  return (
    <div>
      <Link
        href="/dashboard"
        className="text-sm text-muted hover:text-foreground"
      >
        ← Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Audit log</h1>
      <p className="mt-1 font-mono text-xs text-muted">secret {id}</p>

      <div className="card mt-6 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No access attempts recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium">Client (hashed IP)</th>
                  <th className="px-4 py-3 font-medium">User agent</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-3 text-muted">
                      {log.createdAt.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          RESULT_STYLES[log.result] ?? "border-border"
                        }`}
                      >
                        {log.result}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {log.ipHash ? `${log.ipHash.slice(0, 12)}…` : "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-muted">
                      {log.userAgent ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        IP addresses are stored only as salted SHA-256 hashes — enough to tell
        repeat opens apart, never enough to recover the address.
      </p>
    </div>
  );
}
