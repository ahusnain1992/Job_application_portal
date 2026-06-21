import { JobStatus, Role } from "@prisma/client";
import { Upload } from "lucide-react";
import { AppShell } from "@/components/shell";
import { JobTable } from "@/components/job-table";
import { PageHeader, Panel, Select, TextArea, TextInput } from "@/components/ui";
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

      {/* Filters — top bar */}
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted">Search</label>
          <TextInput name="q" placeholder="Company, title, location" defaultValue={searchParams.q || ""} />
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted">Client</label>
          <Select name="clientId" defaultValue={searchParams.clientId || ""}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.clientName}</option>)}
          </Select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted">Status</label>
          <Select name="status" defaultValue={searchParams.status || ""}>
            <option value="">All statuses</option>
            {Object.values(JobStatus).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-md bg-brand px-5 text-sm font-semibold text-white hover:bg-brand/90 transition-colors"
        >
          Apply
        </button>
        {(searchParams.q || searchParams.clientId || searchParams.status) && (
          <a href="/jobs" className="h-10 flex items-center px-4 rounded-md border border-line bg-white text-sm text-muted hover:bg-canvas">
            Clear
          </a>
        )}
      </form>

      {/* Full-width job table */}
      <Panel title={`${jobs.length} jobs`}>
        <JobTable jobs={jobs} />
      </Panel>

      {/* Manual import — collapsed at bottom, admin only */}
      {user.role === Role.ADMIN && (
        <details className="mt-6">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink list-none">
            <Upload size={15} className="text-muted" />
            Manual import
            <span className="text-xs font-normal text-muted ml-1">— click to expand</span>
          </summary>
          <Panel>
            <form action="/api/jobs/import" method="post" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Client *</label>
                <Select name="clientId" required>
                  <option value="">Select client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.clientName}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Job title *</label>
                <TextInput name="title" placeholder="Senior Data Engineer" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Company *</label>
                <TextInput name="companyName" placeholder="Acme Corp" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Location *</label>
                <TextInput name="location" placeholder="Chicago, IL" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Apply URL</label>
                <TextInput name="applyUrl" placeholder="https://..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Required skills</label>
                <TextInput name="requiredSkills" placeholder="SQL, Python, GCP" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-xs font-medium text-muted">Job description *</label>
                <TextArea name="description" placeholder="Paste the job description here…" required />
              </div>
              <div>
                <button
                  type="submit"
                  className="h-10 rounded-md bg-brand px-5 text-sm font-semibold text-white hover:bg-brand/90"
                >
                  Import job
                </button>
              </div>
            </form>
          </Panel>
        </details>
      )}
    </AppShell>
  );
}
