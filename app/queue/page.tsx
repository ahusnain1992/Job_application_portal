import Link from "next/link";
import { JobStatus, Role, WorkMode } from "@prisma/client";
import { BriefcaseBusiness, MapPin, Banknote, Clock, Sparkles, FileText } from "lucide-react";
import { AppShell } from "@/components/shell";
import { Badge, MetricCard, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, workModeLabel } from "@/lib/format";
import { QueueRefresh } from "@/components/queue-refresh";
import { jobDecisionFromRow, JobDecision, NextAction } from "@/lib/services/job-decision";

const WORKABLE_STATUSES: JobStatus[] = [
  JobStatus.NEW, JobStatus.SUGGESTED, JobStatus.APPROVED, JobStatus.ASSIGNED,
  JobStatus.OPENED, JobStatus.IN_PROGRESS, JobStatus.SAVED_FOR_LATER,
  JobStatus.FOLLOW_UP_NEEDED,
];

export default async function QueuePage({ searchParams }: { searchParams: { clientId?: string } }) {
  const user = await requireUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const assignedClientIds =
    user.role === Role.ADMIN
      ? undefined
      : (
          await prisma.clientAssignment.findMany({
            where: { userId: user.id, client: { status: "ACTIVE" } },
            select: { clientId: true }
          })
        ).map((a) => a.clientId);

  const clientFilter = searchParams.clientId
    ? user.role === Role.ADMIN || assignedClientIds?.includes(searchParams.clientId)
      ? [searchParams.clientId]
      : []
    : assignedClientIds;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [jobs, appliedToday, clients, dailyTarget, newJobsCount] = await Promise.all([
    prisma.job.findMany({
      where: {
        clientId: clientFilter ? { in: clientFilter } : undefined,
        status: { in: WORKABLE_STATUSES }
      },
      select: {
        id: true, title: true, companyName: true, location: true, workMode: true,
        salaryMin: true, salaryMax: true, matchScore: true, matchWarnings: true,
        resumeRecommendation: true, resumeCoverageScore: true,
        applyUrl: true, status: true, discoveredAt: true,
        openedAt: true, openedById: true, lockExpiresAt: true,
        bestResumeName: true,
        client: { select: { clientName: true } },
        assignments: { select: { user: { select: { name: true } } } }
      },
      orderBy: [{ matchScore: "desc" }, { discoveredAt: "desc" }],
      take: 200
    }),
    prisma.application.count({
      where: {
        status: JobStatus.APPLIED,
        appliedDateTime: { gte: today },
        ...(user.role !== Role.ADMIN ? { appliedById: user.id } : {})
      }
    }),
    user.role === Role.ADMIN
      ? prisma.clientProfile.findMany({ where: { status: "ACTIVE" }, select: { id: true, clientName: true }, orderBy: { clientName: "asc" } })
      : Promise.resolve([] as { id: string; clientName: string }[]),
    user.role !== Role.ADMIN
      ? prisma.dailyTarget.findFirst({ where: { userId: user.id }, select: { target: true } })
      : Promise.resolve(null),
    prisma.job.count({
      where: {
        clientId: clientFilter ? { in: clientFilter } : undefined,
        status: { in: WORKABLE_STATUSES },
        discoveredAt: { gte: yesterday }
      }
    })
  ]);

  // Derive decision for each job using the shared helper
  const jobsWithDecision = jobs.map((job) => ({
    ...job,
    decision: jobDecisionFromRow({
      matchScore: job.matchScore,
      resumeRecommendation: job.resumeRecommendation,
      resumeCoverageScore: job.resumeCoverageScore,
      applyUrl: job.applyUrl,
      matchWarnings: job.matchWarnings,
    }),
  }));

  // Sort by queue priority (lower = better), then match score
  const sorted = [...jobsWithDecision].sort((a, b) => {
    if (a.decision.queuePriority !== b.decision.queuePriority) {
      return a.decision.queuePriority - b.decision.queuePriority;
    }
    return b.matchScore - a.matchScore;
  });

  const applyNow     = sorted.filter((j) => j.decision.nextAction === "tailor-resume");
  const tailorFirst  = sorted.filter((j) => j.decision.nextAction === "rewrite-resume");
  const needsRewrite = sorted.filter((j) => j.decision.nextAction === "new-resume-version");
  const blocked      = sorted.filter((j) =>
    j.decision.nextAction === "find-apply-link" || j.decision.nextAction === "missing-resume-text"
  );
  const doNotApply   = sorted.filter((j) =>
    j.decision.nextAction === "do-not-apply" || j.decision.nextAction === "wrong-location"
  );

  const dailyTargetNum = dailyTarget?.target ?? 30;

  return (
    <AppShell>
      <QueueRefresh />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-4 min-w-0">
        <div>
          <div className="text-sm font-medium uppercase tracking-wide text-brand">Today&apos;s work</div>
          <h1 className="mt-1 text-2xl font-semibold text-ink">My Work Queue</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user.role === Role.ADMIN && clients.length > 0 && (
            <form className="flex items-center gap-2">
              <select
                name="clientId"
                defaultValue={searchParams.clientId || ""}
                className="focus-ring h-9 rounded-md border border-line bg-white px-3 text-sm text-ink"
              >
                <option value="">All clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.clientName}</option>
                ))}
              </select>
              <button className="focus-ring h-9 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-canvas">
                Filter
              </button>
            </form>
          )}
        </div>
      </div>

      {newJobsCount > 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-brand/30 bg-[#ECF7F4] px-4 py-3 text-sm text-[#186A5E]">
          <Sparkles size={15} />
          <span><strong>{newJobsCount} new job{newJobsCount !== 1 ? "s" : ""}</strong> added in the last 24 hours.</span>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <MetricCard
          label={user.role === Role.ADMIN ? "Applied today (team)" : "Applied today"}
          value={appliedToday}
          tone="brand"
        />
        <MetricCard label="Ready to apply now" value={applyNow.length} tone={applyNow.length > 0 ? "brand" : "neutral"} />
        {user.role !== Role.ADMIN ? (
          <MetricCard
            label={`Daily target (${dailyTargetNum} apps)`}
            value={`${appliedToday} / ${dailyTargetNum}`}
            tone={appliedToday >= dailyTargetNum ? "brand" : "neutral"}
          />
        ) : (
          <MetricCard label="Jobs in queue" value={jobs.length} tone="signal" />
        )}
      </div>

      {jobs.length === 0 ? (
        <Panel>
          <div className="py-12 text-center">
            <div className="text-5xl mb-4">✓</div>
            <div className="text-xl font-semibold text-ink">All caught up!</div>
            <div className="mt-2 text-sm text-muted max-w-sm mx-auto">
              No pending jobs in the queue. New jobs are fetched daily — check back tomorrow or ask your admin to import jobs.
            </div>
          </div>
        </Panel>
      ) : (
        <div className="space-y-10">
          <QueueSection
            title="Apply Now"
            subtitle="Strong match — resume is ready, go apply"
            color="green"
            jobs={applyNow}
            showClient={user.role === Role.ADMIN}
          />
          <QueueSection
            title="Tailor Resume First"
            subtitle="Good match — make small resume adjustments before applying"
            color="blue"
            jobs={tailorFirst}
            showClient={user.role === Role.ADMIN}
          />
          <QueueSection
            title="Resume Rewrite Needed"
            subtitle="Send to resume builder — do not apply until rewrite is done"
            color="orange"
            jobs={needsRewrite}
            showClient={user.role === Role.ADMIN}
          />
          {blocked.length > 0 && (
            <QueueSection
              title="Blocked — Needs Info"
              subtitle="Missing apply link or resume text — admin action needed"
              color="gray"
              jobs={blocked}
              showClient={user.role === Role.ADMIN}
            />
          )}
          {(user.role === Role.ADMIN) && doNotApply.length > 0 && (
            <QueueSection
              title="Poor Match — Do Not Apply"
              subtitle="Below minimum match threshold or wrong location"
              color="red"
              jobs={doNotApply}
              showClient={true}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

type QueueJob = {
  id: string;
  title: string;
  companyName: string;
  location: string;
  workMode: WorkMode;
  salaryMin: number | null;
  salaryMax: number | null;
  matchScore: number;
  resumeRecommendation: string | null;
  applyUrl: string | null;
  status: JobStatus;
  matchWarnings: string[];
  bestResumeName: string | null;
  client: { clientName: string };
  assignments: { user: { name: string } }[];
  decision: JobDecision;
};

function QueueSection({
  title, subtitle, color, jobs, showClient
}: {
  title: string;
  subtitle: string;
  color: "green" | "blue" | "orange" | "gray" | "red";
  jobs: QueueJob[];
  showClient: boolean;
}) {
  if (jobs.length === 0) return null;
  const dotColors = {
    green: "bg-brand",
    blue: "bg-blue-600",
    orange: "bg-warn",
    gray: "bg-gray-400",
    red: "bg-red-500",
  };
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${dotColors[color]}`}>
          {jobs.length}
        </span>
        <div>
          <div className="font-semibold text-ink">{title}</div>
          <div className="text-xs text-muted">{subtitle}</div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {jobs.map((job) => (
          <QueueCard key={job.id} job={job} showClient={showClient} />
        ))}
      </div>
    </section>
  );
}

function QueueCard({ job, showClient }: { job: QueueJob; showClient: boolean }) {
  const { decision } = job;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block w-full min-w-0 rounded-lg border border-line bg-white p-3 sm:p-4 shadow-panel transition-all hover:border-brand/50 hover:shadow-md overflow-hidden"
    >
      {/* Header row: company + next-action badge */}
      <div className="flex items-start gap-2 min-w-0">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate font-semibold text-ink group-hover:text-brand text-sm sm:text-base">{job.companyName}</div>
          <div className="mt-0.5 truncate text-xs sm:text-sm text-muted">{job.title}</div>
        </div>
        <div className="shrink-0">
          <Badge tone={decision.actionTone}>{decision.actionLabel}</Badge>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted sm:flex-row sm:flex-wrap sm:gap-x-3 sm:gap-y-1">
        <span className="flex items-center gap-1 truncate">
          <MapPin size={10} className="shrink-0" />
          <span className="truncate">{job.location}</span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <BriefcaseBusiness size={10} className="shrink-0" /> {workModeLabel(job.workMode)}
        </span>
        {(job.salaryMin || job.salaryMax) && (
          <span className="flex items-center gap-1 shrink-0">
            <Banknote size={10} className="shrink-0" /> {money(job.salaryMin, job.salaryMax)}
          </span>
        )}
      </div>

      {/* Recommended resume name */}
      {job.bestResumeName && decision.nextAction === "tailor-resume" && (
        <div className="mt-2 flex items-center gap-1 text-xs text-brand truncate">
          <FileText size={10} className="shrink-0" />
          <span className="truncate">Use: {job.bestResumeName}</span>
        </div>
      )}

      {/* Footer: job fit + client/status */}
      <div className="mt-2 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-sm font-semibold ${
            decision.jobFitLabel === "High" ? "text-brand"
            : decision.jobFitLabel === "Medium" ? "text-blue-600"
            : "text-muted"
          }`}>
            {job.matchScore}%
          </span>
          <span className={`text-xs ${
            decision.jobFitLabel === "High" ? "text-brand"
            : decision.jobFitLabel === "Medium" ? "text-blue-600"
            : "text-muted"
          }`}>
            {decision.jobFitLabel} fit
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {showClient && (
            <span className="truncate text-xs text-muted max-w-[120px]">{job.client.clientName}</span>
          )}
          {job.status === JobStatus.IN_PROGRESS && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-blue-600">
              <Clock size={10} /> In progress
            </span>
          )}
        </div>
      </div>

      {/* Warning — capped to one line */}
      {job.matchWarnings.length > 0 && (
        <div className="mt-2 rounded bg-[#FFF6EB] px-2 py-1 text-xs text-[#8A4604] line-clamp-2">
          ⚠ {job.matchWarnings[0]}
        </div>
      )}
    </Link>
  );
}
