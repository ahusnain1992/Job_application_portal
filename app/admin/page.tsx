import Link from "next/link";
import { Role, JobStatus } from "@prisma/client";
import { AlertTriangle, ShieldCheck, Clock, FileText, Pencil } from "lucide-react";
import { AppShell } from "@/components/shell";
import { JobTable } from "@/components/job-table";
import { Badge, MetricCard, PageHeader, Panel } from "@/components/ui";
import { FetchJobsButton } from "@/components/fetch-jobs-button";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shortDate } from "@/lib/format";

export default async function AdminDashboard() {
  await requireRole(Role.ADMIN);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date();
  week.setDate(week.getDate() - 7);
  const now = new Date();

  const [
    totalClients, activeClients,
    jobsToday, appliedToday, appliedWeek,
    interviews, duplicates,
    resumeRewritesNeeded, missingProof, incompleteOpens,
    topJobs, teamMembers, recentApplications, skipReasons, lastSource
  ] = await Promise.all([
    prisma.clientProfile.count(),
    prisma.clientProfile.count({ where: { status: "ACTIVE" } }),
    prisma.job.count({ where: { discoveredAt: { gte: today } } }),
    prisma.application.count({ where: { status: JobStatus.APPLIED, appliedDateTime: { gte: today } } }),
    prisma.application.count({ where: { status: JobStatus.APPLIED, appliedDateTime: { gte: week } } }),
    prisma.application.count({ where: { status: JobStatus.INTERVIEW_RECEIVED } }),
    prisma.job.count({ where: { duplicateGroupId: { not: null } } }),

    // Jobs still needing resume rewrite before applying
    prisma.job.count({
      where: {
        resumeRecommendation: { in: ["REWRITE", "NEW_VERSION"] },
        status: { in: [JobStatus.SUGGESTED, JobStatus.APPROVED, JobStatus.ASSIGNED, JobStatus.NEW] }
      }
    }),

    // Applied applications with no proof and not Gmail-verified
    prisma.application.findMany({
      where: {
        status: JobStatus.APPLIED,
        confirmationNumber: null,
        proofUrl: null,
        verifiedByGmail: false
      },
      include: {
        appliedBy: { select: { name: true } },
        job: { select: { id: true, title: true, companyName: true } },
        client: { select: { clientName: true } }
      },
      orderBy: { appliedDateTime: "desc" },
      take: 15
    }),

    // Jobs opened but not completed (lock expired or no lock but IN_PROGRESS)
    prisma.job.findMany({
      where: {
        status: JobStatus.IN_PROGRESS,
        OR: [
          { lockExpiresAt: { lt: now } },
          { lockExpiresAt: null }
        ]
      },
      include: {
        openedBy: { select: { name: true } },
        client: { select: { clientName: true } }
      },
      orderBy: { openedAt: "desc" },
      take: 10
    }),

    prisma.job.findMany({
      take: 20,
      orderBy: [{ matchScore: "desc" }, { discoveredAt: "desc" }],
      where: {
        status: { in: [JobStatus.SUGGESTED, JobStatus.APPROVED, JobStatus.ASSIGNED] },
        matchScore: { gte: 40 }, // exclude low-fit / wrong-title jobs
      },
      select: {
        id: true, title: true, companyName: true, location: true, workMode: true,
        status: true, matchScore: true, sourceName: true, postedDate: true,
        applyUrl: true, salaryMin: true, salaryMax: true, duplicateGroupId: true,
        resumeRecommendation: true, resumeCoverageScore: true, matchWarnings: true,
        client: { select: { clientName: true } }
      }
    }),

    prisma.user.findMany({
      where: { role: Role.TEAM_MEMBER, active: true },
      orderBy: { name: "asc" }
    }),

    prisma.application.findMany({
      where: { updatedAt: { gte: week } },
      include: {
        appliedBy: { select: { name: true } },
        client: { select: { clientName: true } },
        job: { select: { title: true, companyName: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 200
    }),

    // Skip reasons breakdown
    prisma.application.groupBy({
      by: ["reasonSkipped"],
      where: { status: { in: [JobStatus.SKIPPED, JobStatus.NOT_RELEVANT] }, reasonSkipped: { not: null } },
      _count: { reasonSkipped: true },
      orderBy: { _count: { reasonSkipped: "desc" } }
    }),

    // Last job fetch time (for button cooldown)
    prisma.jobSource.findFirst({
      where: { lastRunAt: { not: null } },
      orderBy: { lastRunAt: "desc" },
      select: { lastRunAt: true }
    })
  ]);

  // Per-resource productivity stats (this week)
  const resourceStats = await Promise.all(
    teamMembers.map(async (member) => {
      const [applied, skipped, opened, flagged, gmailVerified, appsWithProof] = await Promise.all([
        prisma.application.count({ where: { appliedById: member.id, status: JobStatus.APPLIED, appliedDateTime: { gte: week } } }),
        prisma.application.count({ where: { lastUpdatedById: member.id, status: { in: [JobStatus.SKIPPED, JobStatus.NOT_RELEVANT] }, updatedAt: { gte: week } } }),
        prisma.job.count({ where: { openedById: member.id, openedAt: { gte: week } } }),
        prisma.application.count({ where: { appliedById: member.id, flaggedFast: true, flagDismissed: false, appliedDateTime: { gte: week } } }),
        prisma.application.count({ where: { appliedById: member.id, verifiedByGmail: true, appliedDateTime: { gte: week } } }),
        prisma.application.count({
          where: {
            appliedById: member.id,
            appliedDateTime: { gte: week },
            OR: [{ proofUrl: { not: null } }, { confirmationNumber: { not: null } }, { verifiedByGmail: true }]
          }
        })
      ]);
      const timedApps = await prisma.application.findMany({
        where: { appliedById: member.id, appliedDateTime: { gte: week }, timeSpentMinutes: { not: null } },
        select: { timeSpentMinutes: true }
      });
      const avgTime = timedApps.length
        ? Math.round(timedApps.reduce((s, a) => s + (a.timeSpentMinutes || 0), 0) / timedApps.length)
        : null;
      return { member, applied, skipped, opened, flagged, gmailVerified, appsWithProof, avgTime };
    })
  );

  // Per-client progress
  const clients = await prisma.clientProfile.findMany({
    where: { status: "ACTIVE" },
    include: {
      _count: { select: { jobs: true, applications: true } },
      applications: { where: { status: JobStatus.APPLIED }, select: { id: true } }
    },
    orderBy: { clientName: "asc" }
  });

  const flaggedApplications = await prisma.application.findMany({
    where: { flaggedFast: true, verifiedByGmail: false, flagDismissed: false },
    include: {
      appliedBy: { select: { name: true } },
      job: { select: { title: true, companyName: true, id: true } },
      client: { select: { clientName: true } }
    },
    orderBy: { appliedDateTime: "desc" },
    take: 10
  });

  const attentionCount = flaggedApplications.length + missingProof.length + incompleteOpens.length;

  return (
    <AppShell>
      <PageHeader
        title="Admin dashboard"
        eyebrow="Operations overview"
        actions={<FetchJobsButton lastRunAt={lastSource?.lastRunAt?.toISOString() ?? null} />}
      />

      {/* Top-line metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active clients" value={activeClients} tone="brand" />
        <MetricCard label="Applied today" value={appliedToday} tone="brand" />
        <MetricCard label="Applied this week" value={appliedWeek} />
        <MetricCard label="Interview callbacks" value={interviews} tone="brand" />
        <MetricCard label="Jobs discovered today" value={jobsToday} tone="signal" />
        <MetricCard label="Needs resume rewrite" value={resumeRewritesNeeded} tone="warn" />
        <MetricCard label="Duplicate jobs grouped" value={duplicates} tone="warn" />
        <MetricCard label="Needs attention" value={attentionCount} tone={attentionCount > 0 ? "warn" : "neutral"} />
      </div>

      {/* Needs attention banner */}
      {attentionCount > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-ink">⚠ Needs Attention</h2>
          <div className="grid gap-4 xl:grid-cols-3">
            {flaggedApplications.length > 0 && (
              <Panel title={`⚑ Flagged fast (${flaggedApplications.length})`}>
                <div className="space-y-2">
                  {flaggedApplications.map((app) => (
                    <Link key={app.id} href={`/jobs/${app.jobId}`} className="block rounded-md border border-red-100 bg-red-50 p-3 text-sm hover:bg-red-100">
                      <div className="font-medium text-red-800">{app.job.title} — {app.job.companyName}</div>
                      <div className="mt-0.5 text-xs text-red-600">{app.appliedBy?.name} · {app.client.clientName} · {app.timeSpentMinutes}min</div>
                    </Link>
                  ))}
                </div>
              </Panel>
            )}

            {missingProof.length > 0 && (
              <Panel title={`Missing proof (${missingProof.length})`}>
                <div className="space-y-2">
                  {missingProof.slice(0, 8).map((app) => (
                    <Link key={app.id} href={`/jobs/${app.jobId}`} className="block rounded-md border border-warn/30 bg-[#FFF6EB] p-3 text-sm hover:bg-[#FDEBD0]">
                      <div className="font-medium text-[#8A4604]">{app.job.title}</div>
                      <div className="mt-0.5 text-xs text-[#8A4604]/80">{app.appliedBy?.name} · {app.client.clientName}</div>
                    </Link>
                  ))}
                  {missingProof.length > 8 && (
                    <Link href="/applications?status=APPLIED" className="block text-center text-xs text-muted hover:text-ink">
                      +{missingProof.length - 8} more →
                    </Link>
                  )}
                </div>
              </Panel>
            )}

            {incompleteOpens.length > 0 && (
              <Panel title={`Opened, not completed (${incompleteOpens.length})`}>
                <div className="space-y-2">
                  {incompleteOpens.map((job) => (
                    <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-md border border-signal/30 bg-[#EEF5FF] p-3 text-sm hover:bg-blue-100">
                      <div className="font-medium text-blue-800">{job.title} — {job.companyName}</div>
                      <div className="mt-0.5 text-xs text-blue-600">{job.openedBy?.name} · {job.client.clientName}</div>
                    </Link>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* Team productivity */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-ink">Team productivity — this week</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-panel">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase text-muted">
                <th className="py-3 pl-4 pr-4 font-semibold">Resource</th>
                <th className="py-3 pr-4 font-semibold">Applied</th>
                <th className="py-3 pr-4 font-semibold">Opened</th>
                <th className="py-3 pr-4 font-semibold">Skipped</th>
                <th className="py-3 pr-4 font-semibold">Avg time</th>
                <th className="py-3 pr-4 font-semibold">With proof</th>
                <th className="py-3 pr-4 font-semibold">Gmail ✓</th>
                <th className="py-3 pr-4 font-semibold">⚑ Flagged</th>
              </tr>
            </thead>
            <tbody>
              {resourceStats.map(({ member, applied, skipped, opened, flagged, gmailVerified, appsWithProof, avgTime }) => (
                <tr key={member.id} className="border-b border-line/70 last:border-0">
                  <td className="py-3 pl-4 pr-4 font-semibold text-ink">{member.name}</td>
                  <td className="py-3 pr-4"><span className={applied > 0 ? "font-semibold text-brand" : "text-muted"}>{applied}</span></td>
                  <td className="py-3 pr-4">{opened}</td>
                  <td className="py-3 pr-4 text-muted">{skipped}</td>
                  <td className="py-3 pr-4">
                    {avgTime !== null ? (
                      <span className="inline-flex items-center gap-1 text-muted"><Clock size={12} /> {avgTime} min</span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {applied > 0 ? (
                      <span className={appsWithProof < applied ? "font-medium text-warn" : "font-medium text-brand"}>
                        {appsWithProof}/{applied}
                      </span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {gmailVerified > 0 ? (
                      <span className="inline-flex items-center gap-1 text-brand"><ShieldCheck size={13} /> {gmailVerified}</span>
                    ) : <span className="text-muted">0</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {flagged > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-red-600"><AlertTriangle size={13} /> {flagged}</span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
              {resourceStats.length === 0 && (
                <tr><td colSpan={8} className="py-6 pl-4 text-center text-sm text-muted">No team members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* High-match pending jobs */}
        <Panel title="High-match jobs pending action">
          <JobTable jobs={topJobs} />
        </Panel>

        <div className="space-y-6">
          {/* Client progress */}
          <Panel title="Client progress">
            <div className="space-y-2">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center justify-between rounded-md border border-line p-3 hover:bg-canvas">
                  <Link href={`/clients/${client.id}`} className="min-w-0 flex-1">
                    <div className="font-medium text-ink truncate">{client.clientName}</div>
                    <div className="text-xs text-muted">{client._count.jobs} jobs · {client._count.applications} tracked</div>
                  </Link>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge tone="brand">{client.applications.length} applied</Badge>
                    <Link href={`/clients/${client.id}/edit`} className="text-muted hover:text-ink">
                      <Pencil size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Skip reasons */}
          {skipReasons.length > 0 && (
            <Panel title="Skip reasons this week">
              <div className="space-y-2">
                {skipReasons.slice(0, 8).map((r) => (
                  <div key={r.reasonSkipped} className="flex items-center justify-between text-sm">
                    <span className="text-muted truncate max-w-[220px]">{r.reasonSkipped}</span>
                    <Badge tone="neutral">{r._count.reasonSkipped}</Badge>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Resume rewrites needed */}
          {resumeRewritesNeeded > 0 && (
            <div className="rounded-lg border border-warn/30 bg-[#FFF6EB] p-4">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-warn" />
                <div className="font-semibold text-[#8A4604]">{resumeRewritesNeeded} jobs need resume rewrite</div>
              </div>
              <p className="mt-1 text-xs text-[#8A4604]/80">These jobs require a tailored resume before applying. Go to Resume Strategy to plan.</p>
              <Link href="/resumes/strategy" className="mt-2 inline-block text-xs font-medium text-[#8A4604] hover:underline">
                View resume plan →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-8">
        <Panel title="Recent activity — this week">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase text-muted">
                  <th className="py-3 pr-4 font-semibold">Resource</th>
                  <th className="py-3 pr-4 font-semibold">Job</th>
                  <th className="py-3 pr-4 font-semibold">Client</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentApplications.slice(0, 30).map((app) => (
                  <tr key={app.id} className="border-b border-line/70 last:border-0">
                    <td className="py-2 pr-4">{app.appliedBy?.name || "—"}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/jobs/${app.jobId}`} className="text-brand hover:underline">{app.job.title}</Link>
                      <div className="text-xs text-muted">{app.job.companyName}</div>
                    </td>
                    <td className="py-2 pr-4 text-muted">{app.client.clientName}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={app.status === JobStatus.APPLIED ? "brand" : (app.flaggedFast && !(app as any).flagDismissed) ? "danger" : "neutral"}>
                        {app.status}{(app.flaggedFast && !(app as any).flagDismissed) ? " ⚑" : ""}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-muted">{shortDate(app.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
