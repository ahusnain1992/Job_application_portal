import Link from "next/link";
import { redirect } from "next/navigation";
import { JobStatus, Role } from "@prisma/client";
import { ArrowRight, CheckCircle2, Clock, Target, Users, Sparkles } from "lucide-react";
import { AppShell } from "@/components/shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TeamDashboard() {
  const user = await requireUser();
  if (user.role === Role.ADMIN) redirect("/admin");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const assignedClientIds = (
    await prisma.clientAssignment.findMany({
      where: { userId: user.id, client: { status: "ACTIVE" } },
      select: { clientId: true }
    })
  ).map((item) => item.clientId);

  const WORKABLE_STATUSES: JobStatus[] = [
    JobStatus.NEW,
    JobStatus.SUGGESTED,
    JobStatus.APPROVED,
    JobStatus.ASSIGNED,
    JobStatus.OPENED,
    JobStatus.IN_PROGRESS,
    JobStatus.SAVED_FOR_LATER,
    JobStatus.FOLLOW_UP_NEEDED,
  ];

  const hasClients = assignedClientIds.length > 0;

  const [clients, pendingJobs, appliedToday, skippedToday, followUps, topJobs, dailyTarget] = await Promise.all([
    hasClients
      ? prisma.clientProfile.findMany({
          where: { id: { in: assignedClientIds } },
          select: { id: true, clientName: true, targetJobTitles: true }
        })
      : Promise.resolve([] as { id: string; clientName: string; targetJobTitles: string[] }[]),
    hasClients
      ? prisma.job.count({ where: { clientId: { in: assignedClientIds }, status: { in: WORKABLE_STATUSES } } })
      : Promise.resolve(0),
    prisma.application.count({
      where: { appliedById: user.id, status: JobStatus.APPLIED, appliedDateTime: { gte: today } }
    }),
    prisma.application.count({
      where: { appliedById: user.id, status: JobStatus.SKIPPED, updatedAt: { gte: today } }
    }),
    hasClients
      ? prisma.job.count({ where: { clientId: { in: assignedClientIds }, status: JobStatus.FOLLOW_UP_NEEDED } })
      : Promise.resolve(0),
    hasClients ? prisma.job.findMany({
      where: {
        clientId: { in: assignedClientIds },
        status: { in: [JobStatus.SUGGESTED, JobStatus.APPROVED, JobStatus.ASSIGNED, JobStatus.NEW] },
        applyUrl: { not: null }
      },
      orderBy: [{ matchScore: "desc" }, { discoveredAt: "desc" }],
      take: 6,
      select: {
        id: true,
        title: true,
        companyName: true,
        matchScore: true,
        location: true,
        resumeRecommendation: true,
        client: { select: { clientName: true } }
      }
    }) : Promise.resolve([] as { id: string; title: string; companyName: string; matchScore: number; location: string; resumeRecommendation: string | null; client: { clientName: string } }[]),
    prisma.dailyTarget.findFirst({ where: { userId: user.id }, select: { target: true } }).catch(() => null)
  ]);

  const dailyTargetNum = dailyTarget?.target ?? 30;
  const progressPct = Math.min(100, Math.round((appliedToday / dailyTargetNum) * 100));
  const remaining = Math.max(0, dailyTargetNum - appliedToday);

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      {/* Welcome header */}
      <div className="mb-8">
        <div className="text-sm font-medium uppercase tracking-wide text-brand">Dashboard</div>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{greeting}, {user.name.split(" ")[0]}!</h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s your work summary for today.</p>
      </div>

      {/* Progress bar card */}
      <div className="mb-6 rounded-xl border border-brand/20 bg-gradient-to-r from-[#ECF7F4] to-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Target size={16} className="text-brand" />
                Daily target: {dailyTargetNum} applications
              </div>
              <span className="text-sm font-bold text-brand">{appliedToday} / {dailyTargetNum}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-white border border-brand/20">
              <div
                className={`h-3 rounded-full transition-all ${progressPct >= 100 ? "bg-brand" : progressPct >= 60 ? "bg-blue-500" : "bg-warn"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-muted">
              {progressPct >= 100
                ? "🎉 Daily target reached! Keep going if you can."
                : `${remaining} more application${remaining !== 1 ? "s" : ""} to reach today's target`}
            </div>
          </div>
          <Link
            href="/queue"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand/90 transition-colors"
          >
            Go to My Queue
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Applied today" value={appliedToday} icon={<CheckCircle2 size={18} className="text-brand" />} />
        <StatCard label="Skipped today" value={skippedToday} icon={<Clock size={18} className="text-muted" />} />
        <StatCard label="In queue" value={pendingJobs} icon={<Sparkles size={18} className="text-blue-500" />} />
        <StatCard label="Follow-ups needed" value={followUps} icon={<Clock size={18} className="text-warn" />} highlight={followUps > 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        {/* My Clients */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Users size={16} className="text-muted" />
            <span className="text-sm font-semibold text-ink">My clients</span>
            <span className="ml-auto rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">{clients.length}</span>
          </div>
          {clients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
              No clients assigned yet.<br />Ask your admin to assign you.
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-white p-3 hover:border-brand/40 hover:bg-[#F0FAF7] transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                    {client.clientName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{client.clientName}</div>
                    <div className="truncate text-xs text-muted">{client.targetJobTitles.slice(0, 2).join(", ")}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {followUps > 0 && (
            <Link
              href="/queue"
              className="mt-4 flex items-center justify-between rounded-lg border border-warn/40 bg-[#FFF6EB] px-4 py-3 text-sm text-[#8A4604] hover:bg-[#FFECD0] transition-colors"
            >
              <span className="font-semibold">⚠ {followUps} follow-up{followUps !== 1 ? "s" : ""} needed</span>
              <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {/* Next recommended jobs */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-500" />
              <span className="text-sm font-semibold text-ink">Next recommended jobs</span>
            </div>
            <Link href="/queue" className="text-xs font-medium text-brand hover:underline">
              View all →
            </Link>
          </div>

          {topJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
              <div className="text-3xl mb-2">✓</div>
              <div className="font-semibold text-ink">Queue is empty</div>
              <div className="mt-1">New jobs are fetched daily. Check back soon.</div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topJobs.map((job) => {
                const rec = job.resumeRecommendation;
                const needsRewrite = rec === "FULL_REWRITE" || rec === "NEW_VERSION";
                const isStrong = job.matchScore >= 65 && !needsRewrite;
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="group flex flex-col gap-1 rounded-lg border border-line bg-white p-3 hover:border-brand/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink group-hover:text-brand">{job.companyName}</div>
                        <div className="truncate text-xs text-muted mt-0.5">{job.title}</div>
                      </div>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
                        isStrong ? "bg-[#ECF7F4] text-[#186A5E]" :
                        job.matchScore >= 45 ? "bg-[#EEF5FF] text-[#1D4ED8]" :
                        "bg-canvas text-muted"
                      }`}>
                        {job.matchScore}%
                      </span>
                    </div>
                    <div className="text-xs text-muted truncate">{job.location}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted">{job.client.clientName}</span>
                      {needsRewrite && (
                        <span className="text-xs text-[#8A4604]">Needs rewrite</span>
                      )}
                      {isStrong && (
                        <span className="text-xs font-semibold text-[#186A5E]">Apply now →</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {topJobs.length > 0 && (
            <div className="mt-4 text-center">
              <Link
                href="/queue"
                className="inline-flex items-center gap-2 rounded-lg border border-brand/30 bg-[#ECF7F4] px-6 py-2.5 text-sm font-semibold text-[#186A5E] hover:bg-[#D7F0E8] transition-colors"
              >
                Open My Full Queue
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-lg border bg-white p-4 ${highlight ? "border-warn/40" : "border-line"}`}>
      <div className="flex items-center justify-between">
        {icon}
        <span className={`text-2xl font-bold ${highlight ? "text-warn" : "text-ink"}`}>{value}</span>
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
