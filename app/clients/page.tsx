import Link from "next/link";
import { Role } from "@prisma/client";
import { AppShell } from "@/components/shell";
import { Badge, PageHeader, Panel, Select, SubmitButton, TextArea, TextInput } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ClientsPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireRole(Role.ADMIN);

  const [clients, teamMembers] = await Promise.all([
    prisma.clientProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assignments: { include: { user: { select: { name: true } } } },
        _count: { select: { jobs: true, applications: true } }
      }
    }),
    prisma.user.findMany({ where: { role: "TEAM_MEMBER", active: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <AppShell>
      <PageHeader title="Client profiles" eyebrow="Admin" />

      {searchParams.error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Something went wrong. Please try again.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[460px_1fr]">
        {/* Create form */}
        <Panel title="Add client">
          <form action="/api/clients" method="post" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink">Client full name *</label>
              <TextInput name="clientName" placeholder="e.g. Nadia Rahman" required className="mt-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Current job title *</label>
              <TextInput name="currentJobTitle" placeholder="e.g. Senior Data Engineer" required className="mt-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Target job titles * <span className="text-muted font-normal">(comma separated, 3–4 titles)</span></label>
              <TextInput name="targetJobTitles" placeholder="Senior Data Engineer, GCP Data Engineer, Analytics Engineer" required className="mt-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Alternative titles <span className="text-muted font-normal">(comma separated)</span></label>
              <TextInput name="alternativeJobTitles" placeholder="ETL Developer, BI Engineer, Data Warehouse Engineer" className="mt-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Main skills * <span className="text-muted font-normal">(comma separated)</span></label>
              <TextInput name="mainSkills" placeholder="SQL, Python, GCP, BigQuery, Airflow" required className="mt-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Preferred locations * <span className="text-muted font-normal">(comma separated)</span></label>
              <TextInput name="preferredLocations" placeholder="Remote, Chicago IL, Dallas TX" required className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ink">Work mode</label>
                <Select name="workModePreference" className="mt-1">
                  <option value="FLEXIBLE">Flexible</option>
                  <option value="REMOTE">Remote only</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ONSITE">Onsite</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">Employment type</label>
                <Select name="employmentTypePreference" className="mt-1">
                  <option value="UNKNOWN">Any</option>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="C2C">C2C</option>
                  <option value="W2">W2</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ink">Min salary ($)</label>
                <TextInput name="minimumSalary" type="number" placeholder="130000" className="mt-1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">Max salary ($)</label>
                <TextInput name="maximumSalary" type="number" placeholder="180000" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Exclude keywords <span className="text-muted font-normal">(comma separated — skip jobs containing these)</span></label>
              <TextInput name="keywordsExclude" placeholder="clearance, onsite only, visa sponsorship" className="mt-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">LinkedIn URL</label>
              <TextInput name="linkedinUrl" placeholder="https://linkedin.com/in/..." className="mt-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">CV text <span className="text-muted font-normal">(paste resume content for AI matching)</span></label>
              <TextArea name="cvText" placeholder="Paste the client's CV / resume text here..." className="mt-1 min-h-32" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Notes for your team <span className="text-muted font-normal">(instructions shown to resources)</span></label>
              <TextArea name="applicationNotes" placeholder="e.g. Prioritize company career pages. Avoid roles requiring security clearance." className="mt-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Assign resource</label>
              <Select name="teamMemberId" className="mt-1">
                <option value="">Unassigned for now</option>
                {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </div>
            <SubmitButton>Create client profile</SubmitButton>
          </form>
        </Panel>

        {/* Clients list */}
        <Panel title={`${clients.length} client profiles`}>
          <div className="grid gap-3 md:grid-cols-2">
            {clients.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-sm text-muted">No clients yet. Create the first one.</div>
            ) : clients.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`} className="rounded-lg border border-line p-4 hover:bg-canvas transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{client.clientName}</div>
                    <div className="mt-0.5 text-sm text-muted">{client.currentJobTitle}</div>
                  </div>
                  <Badge tone={client.status === "ACTIVE" ? "brand" : "neutral"}>{client.status}</Badge>
                </div>
                <div className="mt-2 text-sm text-muted line-clamp-1">{client.targetJobTitles.join(" · ")}</div>
                <div className="mt-3 flex items-center gap-4 text-sm text-muted">
                  <span>{client._count.jobs} jobs</span>
                  <span>{client._count.applications} applications</span>
                </div>
                <div className="mt-2 text-xs text-muted">
                  Assigned: {client.assignments.map((a) => a.user.name).join(", ") || "None"}
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
