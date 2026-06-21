import Link from "next/link";
import { Role } from "@prisma/client";
import { AppShell } from "@/components/shell";
import { Badge, PageHeader, Panel, Select, SubmitButton, TextArea, TextInput } from "@/components/ui";
import { TagInput } from "@/components/tag-input";
import { LocationPicker } from "@/components/location-picker";
import { FileUploadOrUrl } from "@/components/file-upload-or-url";
import { DeleteClientButton } from "@/components/delete-client-button";
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
              <label className="block text-sm font-medium text-ink mb-1">
                Target job titles * <span className="text-muted font-normal">(3–4 titles)</span>
              </label>
              <TagInput
                name="targetJobTitles"
                placeholder="e.g. Senior Data Engineer — press Enter"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Alternative titles <span className="text-muted font-normal">(optional)</span>
              </label>
              <TagInput
                name="alternativeJobTitles"
                placeholder="e.g. ETL Developer, BI Engineer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Main skills * <span className="text-muted font-normal">(used for job matching)</span>
              </label>
              <TagInput
                name="mainSkills"
                placeholder="e.g. SQL, Python, BigQuery"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Job locations
              </label>
              <LocationPicker />
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
              <label className="block text-sm font-medium text-ink mb-1">
                Exclude keywords <span className="text-muted font-normal">(skip jobs containing these)</span>
              </label>
              <TagInput
                name="keywordsExclude"
                placeholder="e.g. security clearance, onsite only"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">LinkedIn URL</label>
              <TextInput name="linkedinUrl" placeholder="https://linkedin.com/in/..." className="mt-1" />
            </div>

            {/* Resume — upload file or paste URL */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Resume file <span className="text-muted font-normal">(upload PDF or paste a link)</span>
              </label>
              <FileUploadOrUrl
                name="resumeUrl"
                placeholder="https://drive.google.com/..."
                accept=".pdf,.doc,.docx"
              />
            </div>

            {/* CV text for AI keyword matching */}
            <div>
              <label className="block text-sm font-medium text-ink">
                CV text <span className="text-muted font-normal">(paste resume text — used for AI job matching)</span>
              </label>
              <TextArea
                name="cvText"
                placeholder="Paste the client's full resume text here. This is used to match keywords against job descriptions."
                className="mt-1 min-h-32"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">
                Notes for your team <span className="text-muted font-normal">(shown to resources on every job)</span>
              </label>
              <TextArea
                name="applicationNotes"
                placeholder="e.g. Prioritize company career pages. Avoid roles requiring security clearance."
                className="mt-1"
              />
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
        <div className="space-y-6">
          {/* Active clients */}
          <Panel title={`${clients.filter(c => c.status === "ACTIVE").length} active clients`}>
            <div className="grid gap-3 md:grid-cols-2">
              {clients.filter(c => c.status === "ACTIVE").length === 0 ? (
                <div className="col-span-2 py-8 text-center text-sm text-muted">No active clients yet. Create the first one.</div>
              ) : clients.filter(c => c.status === "ACTIVE").map((client) => (
                <Link key={client.id} href={`/clients/${client.id}`} className="rounded-lg border border-line p-4 hover:bg-canvas transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-ink">{client.clientName}</div>
                      <div className="mt-0.5 text-sm text-muted">{client.currentJobTitle}</div>
                    </div>
                    <Badge tone="brand">Active</Badge>
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

          {/* Archived clients */}
          {clients.filter(c => c.status === "INACTIVE").length > 0 && (
            <Panel title={`${clients.filter(c => c.status === "INACTIVE").length} archived clients`}>
              <p className="mb-3 text-xs text-muted">Archived clients are hidden from the job queue. You can reactivate them or delete them permanently.</p>
              <div className="space-y-2">
                {clients.filter(c => c.status === "INACTIVE").map((client) => (
                  <div key={client.id} className="flex items-center justify-between rounded-lg border border-line bg-canvas p-3">
                    <div className="min-w-0">
                      <Link href={`/clients/${client.id}`} className="font-semibold text-ink hover:text-brand hover:underline text-sm">
                        {client.clientName}
                      </Link>
                      <div className="text-xs text-muted">{client.currentJobTitle} · {client._count.jobs} jobs · {client._count.applications} applications</div>
                    </div>
                    <DeleteClientButton clientId={client.id} clientName={client.clientName} />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </AppShell>
  );
}
