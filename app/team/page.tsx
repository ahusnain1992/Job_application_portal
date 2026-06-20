import { JobStatus } from "@prisma/client";
import { AppShell } from "@/components/shell";
import { JobTable } from "@/components/job-table";
import { MetricCard, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TeamDashboard() {
  const user = await requireUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const assignedClientIds = (await prisma.clientAssignment.findMany({ where: { userId: user.id }, select: { clientId: true } })).map((item) => item.clientId);
  const [clients, pendingJobs, appliedToday, skippedToday, followUps, duplicates] = await Promise.all([
    prisma.clientProfile.findMany({ where: { id: { in: assignedClientIds } }, include: { dailyTargets: true } }),
    prisma.job.findMany({
      where: { clientId: { in: assignedClientIds }, status: { in: [JobStatus.SUGGESTED, JobStatus.APPROVED, JobStatus.ASSIGNED, JobStatus.SAVED_FOR_LATER] } },
      orderBy: [{ matchScore: "desc" }, { discoveredAt: "desc" }],
      include: { client: { select: { clientName: true } } }
    }),
    prisma.application.count({ where: { appliedById: user.id, status: JobStatus.APPLIED, appliedDateTime: { gte: today } } }),
    prisma.application.count({ where: { lastUpdatedById: user.id, status: JobStatus.SKIPPED, updatedAt: { gte: today } } }),
    prisma.job.count({ where: { clientId: { in: assignedClientIds }, status: JobStatus.FOLLOW_UP_NEEDED } }),
    prisma.job.count({ where: { clientId: { in: assignedClientIds }, duplicateGroupId: { not: null } } })
  ]);

  return (
    <AppShell>
      <PageHeader title="Team dashboard" eyebrow="Assigned work" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Assigned clients" value={clients.length} tone="signal" />
        <MetricCard label="Pending jobs" value={pendingJobs.length} />
        <MetricCard label="Applied today" value={appliedToday} tone="brand" />
        <MetricCard label="Skipped today" value={skippedToday} tone="warn" />
        <MetricCard label="Follow-up needed" value={followUps} tone="warn" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
        <Panel title="Clients">
          <div className="space-y-3">
            {clients.map((client) => (
              <a key={client.id} href={`/clients/${client.id}`} className="block rounded-md border border-line p-3 hover:bg-canvas">
                <div className="font-semibold text-ink">{client.clientName}</div>
                <div className="mt-1 text-sm text-muted">{client.targetJobTitles.slice(0, 2).join(", ")}</div>
              </a>
            ))}
          </div>
        </Panel>
        <Panel title={`Pending jobs · ${duplicates} duplicate warnings`}>
          <JobTable jobs={pendingJobs} />
        </Panel>
      </div>
    </AppShell>
  );
}
