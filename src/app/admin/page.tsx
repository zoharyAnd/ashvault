import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getSystemHealth,
  listAbuseReports,
  countExpiredUnswept,
} from "@/lib/admin";
import { resolveReportAction } from "./actions";

export const metadata = { title: "Admin · AshVault" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "admin") redirect("/dashboard");

  const [health, reports, unswept] = await Promise.all([
    getSystemHealth(),
    listAbuseReports(),
    countExpiredUnswept(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">System health</h1>
      <p className="mt-1 text-sm text-muted">
        Admin-only view of vault activity and abuse reports.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Users" value={health.users} />
        <Stat label="Secrets stored" value={health.totalSecrets} />
        <Stat label="Active" value={health.activeSecrets} tone="success" />
        <Stat label="Burned" value={health.burnedSecrets} tone="danger" />
        <Stat label="Access attempts" value={health.accessAttempts} />
        <Stat
          label="Failed / gone opens"
          value={health.failedAccessAttempts}
          tone="danger"
        />
        <Stat
          label="Open abuse reports"
          value={health.openReports}
          tone={health.openReports > 0 ? "danger" : undefined}
        />
        <Stat
          label="Expired, unswept"
          value={unswept}
          tone={unswept > 0 ? "danger" : "success"}
        />
      </div>

      <h2 className="mt-10 text-xl font-semibold">Abuse reports</h2>
      <div className="card mt-4 overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No abuse reports. All quiet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Reported</th>
                  <th className="px-4 py-3 font-medium">Secret</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-3 text-muted">
                      {r.createdAt.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.secretId.slice(0, 10)}…
                    </td>
                    <td className="max-w-sm px-4 py-3">{r.reason}</td>
                    <td className="px-4 py-3">
                      {r.resolved ? (
                        <span className="badge border-success/40 text-success">
                          Resolved
                        </span>
                      ) : (
                        <span className="badge border-danger/40 text-danger">
                          Open
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!r.resolved && (
                        <form action={resolveReportAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="btn-ghost !py-1.5 text-xs">
                            Mark resolved
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : "text-foreground";
  return (
    <div className="card p-4">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
