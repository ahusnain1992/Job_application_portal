import { Role } from "@prisma/client";
import { Download } from "lucide-react";
import { AppShell } from "@/components/shell";
import { MetricCard, PageHeader, Panel, Select } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  clientId?: string;
  memberId?: string;
  range?: string;
  status?: string;
};

function dateRange(range: string | undefined): Date {
  const now = new Date();
  if (range === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (range === "quarter") {
    const q = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return q;
  }
  // Default: last 7 days
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(Role.ADMIN);

  const since = dateRange(searchParams.range);
  const where = {
    ...(searchParams.clientId ? { clientId: searchParams.clientId } : {}),
    ...(searchParams.memberId ? { appliedById: searchParams.memberId } : {}),
    ...(searchParams.status ? { status: searchParams.status as any } : {}),
    updatedAt: { gte: since },
  };

  const [clients, users, applications, followUps, interviews] = await Promise.all([
    prisma.clientProfile.findMany({ orderBy: { clientName: "asc" } }),
    prisma.user.findMany({ where: { role: "TEAM_MEMBER" }, orderBy: { name: "asc" } }),
    prisma.application.findMany({
      where,
      include: { client: true, job: true, appliedBy: true },
      orderBy: { updatedAt: "desc" },
      take: 200
    }),
    prisma.application.count({ where: { ...where, status: "FOLLOW_UP_NEEDED" } }),
    prisma.application.count({ where: { ...where, status: "INTERVIEW_RECEIVED" } }),
  ]);

  // Build CSV export URL with current filters
  const csvParams = new URLSearchParams();
  if (searchParams.clientId) csvParams.set("clientId", searchParams.clientId);
  if (searchParams.memberId) csvParams.set("memberId", searchParams.memberId);
  if (searchParams.range) csvParams.set("range", searchParams.range);
  if (searchParams.status) csvParams.set("status", searchParams.status);
  const csvHref = `/api/exports/applications${csvParams.size ? `?${csvParams}` : ""}`;

  const STATUSES = ["APPLIED", "SKIPPED", "FOLLOW_UP_NEEDED", "INTERVIEW_RECEIVED", "REJECTED"];

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        eyebrow="Exports and productivity"
        actions={
          <a
            href={csvHref}
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white"
          >
            <Download size={16} /> Export CSV
          </a>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Applications in report" value={applications.length} />
        <MetricCard label="Follow-up needed" value={followUps} tone="warn" />
        <MetricCard label="Interview callbacks" value={interviews} tone="brand" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
        <Panel title="Report filters">
          <form method="get" className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Client</label>
              <Select name="clientId" defaultValue={searchParams.clientId || ""}>
                <option value="">All clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.clientName}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Team member</label>
              <Select name="memberId" defaultValue={searchParams.memberId || ""}>
                <option value="">All team members</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Status</label>
              <Select name="status" defaultValue={searchParams.status || ""}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Date range</label>
              <Select name="range" defaultValue={searchParams.range || "7d"}>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="quarter">This quarter</option>
              </Select>
            </div>
            <button
              type="submit"
              className="focus-ring w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Run report
            </button>
          </form>
        </Panel>

        <Panel title={`Application activity · ${applications.length} result${applications.length !== 1 ? "s" : ""}`}>
          {applications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">No applications match these filters.</div>
          ) : (
            <div className="space-y-2">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="flex flex-col gap-1 rounded-md border border-line bg-canvas p-3 text-sm sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink truncate">{app.job.title}</div>
                    <div className="text-xs text-muted truncate">{app.job.companyName} · {app.client.clientName}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                    <span className={`rounded px-2 py-0.5 font-medium ${
                      app.status === "APPLIED" ? "bg-[#ECF7F4] text-[#186A5E]"
                      : app.status === "INTERVIEW_RECEIVED" ? "bg-blue-50 text-blue-700"
                      : app.status === "REJECTED" ? "bg-red-50 text-red-700"
                      : app.status === "FOLLOW_UP_NEEDED" ? "bg-[#FFF6EB] text-[#8A4604]"
                      : "bg-canvas text-muted"
                    }`}>
                      {app.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted">{app.appliedBy?.name || "Unassigned"}</span>
                    <span className="text-muted">{new Date(app.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
