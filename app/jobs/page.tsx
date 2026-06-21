import { JobStatus, Role } from "@prisma/client";
import { Filter, Upload } from "lucide-react";
import { AppShell } from "@/components/shell";
import { JobTable } from "@/components/job-table";
import { PageHeader, Panel, Select, SubmitButton, TextArea, TextInput } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function JobsPage({ searchParams }: { searchParams: { status?: JobStatus; q?: string; clientId?: string } }) {
  const user = await requireUser();
  const assignedClientIds = user.role === Role.ADMIN
    ? undefined
    : (await prisma.clientAssignment.findMany({ where: { userId: user.id, client: { status: "ACTIVE" } }, select: { clientId: true } })).map((item) => item.clientId);
  const clients = await prisma.clientProfile.findMany({
    where: assignedClientIds ? { id: { in: assignedClientIds }, status: "ACTIVE" } : { status: "ACTIVE" },
    orderBy: { clientName: "asc" }
  });
  const clientFilter = searchParams.clientId
    ? user.role === Role.ADMIN || assignedClientIds?.includes(searchParams.clientId)
      ? [searchParams.clientId]
      : []
    : assignedClientIds;
  const statusFilter = searchParams.status && Object.values(JobStatus).includes(searchParams.status)
    ? searchParams.status
    : undefined;

  const jobs = await prisma.job.findMany({
    where: {
      clientId: clientFilter ? { in: clientFilter } : undefined,
      status: statusFilter,
      OR: searchParams.q ? [
        { title: { contains: searchParams.q, mode: "insensitive" } },
        { companyName: { contains: searchParams.q, mode: "insensitive" } },
        { location: { contains: searchParams.q, mode: "insensitive" } }
      ] : undefined
    },
    orderBy: [{ matchScore: "desc" }, { discoveredAt: "desc" }],
    include: { client: { select: { clientName: true } } },
    take: 100
  });

  return (
    <AppShell>
      <PageHeader title="Jobs" eyebrow="Discovery and tracking" />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Panel title="Filters" action={<Filter size={18} />}>
            <form className="space-y-3">
              <TextInput name="q" placeholder="Company, title, location" defaultValue={searchParams.q || ""} />
              <Select name="clientId" defaultValue={searchParams.clientId || ""}>
                <option value="">All clients</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.clientName}</option>)}
              </Select>
              <Select name="status" defaultValue={searchParams.status || ""}>
                <option value="">All statuses</option>
                {Object.values(JobStatus).map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
              <SubmitButton>Apply filters</SubmitButton>
            </form>
          </Panel>
          <Panel title="Manual import" action={<Upload size={18} />}>
            <form action="/api/jobs/import" method="post" className="space-y-3">
              <Select name="clientId" required>
                <option value="">Select client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.clientName}</option>)}
              </Select>
              <TextInput name="title" placeholder="Job title" required />
              <TextInput name="companyName" placeholder="Company" required />
              <TextInput name="location" placeholder="Location" required />
              <TextInput name="applyUrl" placeholder="Apply URL" />
              <TextInput name="requiredSkills" placeholder="Required skills, comma separated" />
              <TextArea name="description" placeholder="Job description" required />
              <SubmitButton>Import job</SubmitButton>
            </form>
          </Panel>
        </div>
        <Panel title={`${jobs.length} jobs`}>
          <JobTable jobs={jobs} />
        </Panel>
      </div>
    </AppShell>
  );
}
