import Link from "next/link";
import { JobStatus, Role } from "@prisma/client";
import { ShieldCheck, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/shell";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shortDate, statusLabel } from "@/lib/format";

const STATUS_TONE: Record<string, "brand" | "signal" | "warn" | "danger" | "neutral"> = {
  APPLIED: "brand",
  INTERVIEW_RECEIVED: "brand",
  SKIPPED: "warn",
  NOT_RELEVANT: "warn",
  ERROR_COULD_NOT_APPLY: "danger",
  FOLLOW_UP_NEEDED: "signal",
  DUPLICATE: "neutral",
  IN_PROGRESS: "signal"
};

export default async function ApplicationsPage({
  searchParams
}: {
  searchParams: {
    clientId?: string;
    userId?: string;
    status?: string;
    company?: string;
    range?: "today" | "week" | "month" | "all";
  };
}) {
  const user = await requireUser();

  const assignedClientIds =
    user.role === Role.ADMIN
      ? undefined
      : (
          await prisma.clientAssignment.findMany({
            where: { userId: user.id },
            select: { clientId: true }
          })
        ).map((a) => a.clientId);

  const clientFilter = searchParams.clientId
    ? user.role === Role.ADMIN || assignedClientIds?.includes(searchParams.clientId)
      ? searchParams.clientId
      : "__unauthorized__"
    : assignedClientIds
    ? { in: assignedClientIds }
    : undefined;

  // Date range filter
  const range = searchParams.range || "week";
  const statusFilter = searchParams.status && Object.values(JobStatus).includes(searchParams.status as JobStatus)
    ? searchParams.status as JobStatus
    : undefined;
  const rangeStart = new Date();
  if (range === "today") rangeStart.setHours(0, 0, 0, 0);
  else if (range === "week") rangeStart.setDate(rangeStart.getDate() - 7);
  else if (range === "month") rangeStart.setDate(rangeStart.getDate() - 30);

  const [applications, clients, teamMembers] = await Promise.all([
    prisma.application.findMany({
      where: {
        clientId: clientFilter,
        appliedById: user.role === Role.ADMIN ? searchParams.userId || undefined : user.id,
        status: statusFilter,
        ...(range !== "all" ? { updatedAt: { gte: rangeStart } } : {}),
        ...(searchParams.company
          ? { job: { companyName: { contains: searchParams.company, mode: "insensitive" } } }
          : {})
      },
      include: {
        appliedBy: { select: { id: true, name: true } },
        lastUpdatedBy: { select: { name: true } },
        client: { select: { clientName: true } },
        job: { select: { id: true, title: true, companyName: true, applyUrl: true } },
        resume: { select: { name: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 100
    }),
    user.role === Role.ADMIN
      ? prisma.clientProfile.findMany({ where: { status: "ACTIVE" }, select: { id: true, clientName: true }, orderBy: { clientName: "asc" } })
      : Promise.resolve([] as { id: string; clientName: string }[]),
    user.role === Role.ADMIN
      ? prisma.user.findMany({ where: { role: Role.TEAM_MEMBER, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string }[])
  ]);

  const appliedCount = applications.filter((a) => a.status === JobStatus.APPLIED).length;
  const flaggedCount = applications.filter((a) => a.flaggedFast && !a.verifiedByGmail && !(a as any).flagDismissed).length;
  const missingProofCount = applications.filter(
    (a) => a.status === JobStatus.APPLIED && !a.confirmationNumber && !a.proofUrl && !a.verifiedByGmail
  ).length;

  return (
    <AppShell>
      <PageHeader title="Application Tracker" eyebrow="All applications" />

      {/* Summary counts */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="rounded-lg border border-line bg-white px-4 py-3 shadow-panel">
          <div className="text-xs text-muted">Applied</div>
          <div className="mt-1 text-2xl font-semibold text-brand">{appliedCount}</div>
        </div>
        {flaggedCount > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-panel">
            <div className="text-xs text-red-600">⚑ Flagged fast</div>
            <div className="mt-1 text-2xl font-semibold text-red-700">{flaggedCount}</div>
          </div>
        )}
        {missingProofCount > 0 && (
          <div className="rounded-lg border border-warn/30 bg-[#FFF6EB] px-4 py-3 shadow-panel">
            <div className="text-xs text-[#8A4604]">Missing proof</div>
            <div className="mt-1 text-2xl font-semibold text-[#8A4604]">{missingProofCount}</div>
          </div>
        )}
        <div className="rounded-lg border border-line bg-white px-4 py-3 shadow-panel">
          <div className="text-xs text-muted">Total shown</div>
          <div className="mt-1 text-2xl font-semibold text-ink">{applications.length}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        {/* Filters panel */}
        <Panel title="Filters">
          <form className="space-y-3">
            {/* Date range */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Date range</label>
              <div className="flex flex-wrap gap-1">
                {(["today", "week", "month", "all"] as const).map((r) => (
                  <button
                    key={r}
                    type="submit"
                    name="range"
                    value={r}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${
                      range === r ? "bg-brand text-white" : "border border-line text-muted hover:bg-canvas"
                    }`}
                  >
                    {r === "today" ? "Today" : r === "week" ? "This week" : r === "month" ? "30 days" : "All time"}
                  </button>
                ))}
              </div>
              <input type="hidden" name="range" value={range} />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1" htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                name="status"
                defaultValue={searchParams.status || ""}
                className="focus-ring h-9 w-full rounded-md border border-line bg-white px-2 text-sm"
              >
                <option value="">All statuses</option>
                {[
                  JobStatus.APPLIED,
                  JobStatus.IN_PROGRESS,
                  JobStatus.SKIPPED,
                  JobStatus.NOT_RELEVANT,
                  JobStatus.ERROR_COULD_NOT_APPLY,
                  JobStatus.FOLLOW_UP_NEEDED,
                  JobStatus.INTERVIEW_RECEIVED
                ].map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>

            {/* Client — admin only */}
            {clients.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1" htmlFor="client-filter">Client</label>
                <select
                  id="client-filter"
                  name="clientId"
                  defaultValue={searchParams.clientId || ""}
                  className="focus-ring h-9 w-full rounded-md border border-line bg-white px-2 text-sm"
                >
                  <option value="">All clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.clientName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Team member — admin only */}
            {teamMembers.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1" htmlFor="user-filter">Team member</label>
                <select
                  id="user-filter"
                  name="userId"
                  defaultValue={searchParams.userId || ""}
                  className="focus-ring h-9 w-full rounded-md border border-line bg-white px-2 text-sm"
                >
                  <option value="">Everyone</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Company search */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1" htmlFor="company-filter">Company</label>
              <input
                id="company-filter"
                name="company"
                defaultValue={searchParams.company || ""}
                placeholder="Search company…"
                className="focus-ring h-9 w-full rounded-md border border-line bg-white px-2 text-sm"
              />
            </div>

            <button
              type="submit"
              className="focus-ring h-9 w-full rounded-md bg-brand px-3 text-sm font-semibold text-white hover:bg-[#12564C]"
            >
              Apply filters
            </button>

            {Object.values(searchParams).some(Boolean) && (
              <Link
                href="/applications"
                className="block text-center text-xs text-muted hover:text-ink"
              >
                Clear filters
              </Link>
            )}
          </form>
        </Panel>

        {/* Applications table */}
        <Panel title={`${applications.length} applications`}>
          {applications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">No applications found for the selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase text-muted">
                    <th className="py-3 pr-4 font-semibold">Job</th>
                    <th className="py-3 pr-4 font-semibold">Client</th>
                    <th className="py-3 pr-4 font-semibold">Applied by</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Proof</th>
                    <th className="py-3 pr-4 font-semibold">Date</th>
                    <th className="py-3 pr-4 font-semibold">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    const needsProof = app.status === JobStatus.APPLIED && !app.confirmationNumber && !app.proofUrl && !app.verifiedByGmail;
                    return (
                      <tr key={app.id} className={`border-b border-line/60 align-top last:border-0 ${needsProof ? "bg-[#FFFBF0]" : ""}`}>
                        <td className="py-3 pr-4">
                          <Link href={`/jobs/${app.jobId}`} className="font-medium text-ink hover:text-brand">
                            {app.job.title}
                          </Link>
                          <div className="text-xs text-muted">{app.job.companyName}</div>
                          {app.reasonSkipped && (
                            <div className="mt-0.5 text-xs text-muted italic">{app.reasonSkipped}</div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted">{app.client.clientName}</td>
                        <td className="py-3 pr-4 text-muted">{app.appliedBy?.name || "—"}</td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-1">
                            <Badge tone={STATUS_TONE[app.status] ?? "neutral"}>{statusLabel(app.status)}</Badge>
                            {app.flaggedFast && !app.verifiedByGmail && !(app as any).flagDismissed && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600">
                                <AlertTriangle size={10} /> Fast
                              </span>
                            )}
                            {app.verifiedByGmail && (
                              <span className="inline-flex items-center gap-1 text-xs text-brand">
                                <ShieldCheck size={10} /> Verified
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {app.verifiedByGmail ? (
                            <span className="text-xs text-brand font-medium">Gmail ✓</span>
                          ) : app.confirmationNumber ? (
                            <span className="text-xs text-muted font-mono">{app.confirmationNumber}</span>
                          ) : app.proofUrl ? (
                            <a href={app.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                              Screenshot <ExternalLink size={10} />
                            </a>
                          ) : app.status === JobStatus.APPLIED ? (
                            <span className="text-xs font-medium text-warn">Missing</span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted">
                          {shortDate(app.appliedDateTime || app.updatedAt)}
                          {app.timeSpentMinutes != null && (
                            <div className="flex items-center gap-1 text-muted">
                              <Clock size={9} /> {app.timeSpentMinutes}m
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {app.job.applyUrl ? (
                            <a href={app.job.applyUrl} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-brand">
                              <ExternalLink size={13} />
                            </a>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
