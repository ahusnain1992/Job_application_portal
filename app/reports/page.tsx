import { Role } from "@prisma/client";
import { Download } from "lucide-react";
import { AppShell } from "@/components/shell";
import { MetricCard, PageHeader, Panel, Select, SubmitButton } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ReportsPage() {
  await requireRole(Role.ADMIN);
  const [clients, users, applications, skipped, followUps, interviews] = await Promise.all([
    prisma.clientProfile.findMany({ orderBy: { clientName: "asc" } }),
    prisma.user.findMany({ where: { role: "TEAM_MEMBER" }, orderBy: { name: "asc" } }),
    prisma.application.findMany({ include: { client: true, job: true, appliedBy: true }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.application.count({ where: { status: "SKIPPED" } }),
    prisma.application.count({ where: { status: "FOLLOW_UP_NEEDED" } }),
    prisma.application.count({ where: { status: "INTERVIEW_RECEIVED" } })
  ]);

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        eyebrow="Exports and productivity"
        actions={<a href="/api/exports/applications" className="focus-ring inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white"><Download size={16} /> Export CSV</a>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Applications in report" value={applications.length} />
        <MetricCard label="Follow-up needed" value={followUps} tone="warn" />
        <MetricCard label="Interview callbacks" value={interviews} tone="brand" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
        <Panel title="Report filters">
          <form className="space-y-3">
            <Select name="client">
              <option>All clients</option>
              {clients.map((client) => <option key={client.id}>{client.clientName}</option>)}
            </Select>
            <Select name="member">
              <option>All team members</option>
              {users.map((user) => <option key={user.id}>{user.name}</option>)}
            </Select>
            <Select name="range">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>This quarter</option>
            </Select>
            <SubmitButton>Run report</SubmitButton>
          </form>
        </Panel>
        <Panel title={`Recent application activity · ${skipped} skipped`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-muted">
                <tr><th className="py-3">Client</th><th>Job</th><th>Company</th><th>Status</th><th>Team member</th></tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id} className="border-b border-line last:border-0">
                    <td className="py-3">{application.client.clientName}</td>
                    <td>{application.job.title}</td>
                    <td>{application.job.companyName}</td>
                    <td>{application.status}</td>
                    <td>{application.appliedBy?.name || "Unassigned"}</td>
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
