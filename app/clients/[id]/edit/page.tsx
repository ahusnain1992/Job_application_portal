import { notFound, redirect } from "next/navigation";
import { EmploymentType, Role, WorkMode } from "@prisma/client";
import { AppShell } from "@/components/shell";
import { PageHeader, Panel, Select, SubmitButton, TextArea, TextInput } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditClientPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireRole(Role.ADMIN);

  const client = await prisma.clientProfile.findUnique({ where: { id: params.id } });
  if (!client) notFound();

  const join = (arr: string[]) => arr.join(", ");

  return (
    <AppShell>
      <PageHeader
        title={`Edit — ${client.clientName}`}
        eyebrow="Client profile"
      />

      {searchParams.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}

      <form action={`/api/clients/${client.id}`} method="post" className="space-y-6">

        <div className="grid gap-6 xl:grid-cols-2">
          {/* Basic info */}
          <Panel title="Basic information">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-ink">
                Full name
                <TextInput name="clientName" defaultValue={client.clientName} required className="mt-1" />
              </label>
              <label className="block text-sm font-medium text-ink">
                Current job title
                <TextInput name="currentJobTitle" defaultValue={client.currentJobTitle} required className="mt-1" />
              </label>
              <label className="block text-sm font-medium text-ink">
                LinkedIn URL
                <TextInput name="linkedinUrl" type="url" defaultValue={client.linkedinUrl || ""} className="mt-1" />
              </label>
              <label className="block text-sm font-medium text-ink">
                Portfolio / GitHub URL
                <TextInput name="portfolioUrl" type="url" defaultValue={client.portfolioUrl || ""} className="mt-1" />
              </label>
              <label className="block text-sm font-medium text-ink">
                Primary resume URL
                <TextInput name="resumeUrl" type="url" defaultValue={client.resumeUrl || ""} className="mt-1" />
              </label>
            </div>
          </Panel>

          {/* Job targets */}
          <Panel title="Job targets">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-ink">
                Target job titles <span className="font-normal text-muted">(comma or line separated)</span>
                <TextArea
                  name="targetJobTitles"
                  defaultValue={join(client.targetJobTitles)}
                  required
                  className="mt-1"
                  placeholder="Senior Data Engineer, Data Engineer, GCP Data Engineer"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Alternative titles <span className="font-normal text-muted">(optional)</span>
                <TextArea
                  name="alternativeJobTitles"
                  defaultValue={join(client.alternativeJobTitles)}
                  className="mt-1"
                  placeholder="ETL Developer, BI Engineer"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Preferred locations <span className="font-normal text-muted">(comma or line separated)</span>
                <TextArea
                  name="preferredLocations"
                  defaultValue={join(client.preferredLocations)}
                  required
                  className="mt-1"
                  placeholder="Remote, Chicago, IL, Dallas, TX"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  Work mode
                  <Select name="workModePreference" defaultValue={client.workModePreference} className="mt-1">
                    {Object.values(WorkMode).map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </label>
                <label className="block text-sm font-medium text-ink">
                  Employment type
                  <Select name="employmentTypePreference" defaultValue={client.employmentTypePreference} className="mt-1">
                    {Object.values(EmploymentType).map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  Min salary ($)
                  <TextInput name="minimumSalary" type="number" defaultValue={client.minimumSalary ?? ""} className="mt-1" />
                </label>
                <label className="block text-sm font-medium text-ink">
                  Max salary ($)
                  <TextInput name="maximumSalary" type="number" defaultValue={client.maximumSalary ?? ""} className="mt-1" />
                </label>
              </div>
            </div>
          </Panel>

          {/* Skills */}
          <Panel title="Skills">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-ink">
                Main skills <span className="font-normal text-muted">(comma separated — used heavily in matching)</span>
                <TextArea
                  name="mainSkills"
                  defaultValue={join(client.mainSkills)}
                  required
                  className="mt-1"
                  placeholder="SQL, Python, GCP, BigQuery, Airflow"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Secondary skills <span className="font-normal text-muted">(nice-to-have)</span>
                <TextArea
                  name="secondarySkills"
                  defaultValue={join(client.secondarySkills)}
                  className="mt-1"
                  placeholder="Tableau, Power BI, dbt"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Industries preferred
                <TextArea
                  name="industriesPreferred"
                  defaultValue={join(client.industriesPreferred)}
                  className="mt-1"
                  placeholder="Healthcare, Fintech, SaaS"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Industries to avoid
                <TextArea
                  name="industriesToAvoid"
                  defaultValue={join(client.industriesToAvoid)}
                  className="mt-1"
                  placeholder="Defense, Gambling"
                />
              </label>
            </div>
          </Panel>

          {/* Matching keywords */}
          <Panel title="Matching & filtering">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-ink">
                Must-include keywords
                <TextArea
                  name="keywordsInclude"
                  defaultValue={join(client.keywordsInclude)}
                  className="mt-1"
                  placeholder="SQL, Python, BigQuery"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Exclude keywords <span className="font-normal text-muted">(jobs with these get penalized)</span>
                <TextArea
                  name="keywordsExclude"
                  defaultValue={join(client.keywordsExclude)}
                  className="mt-1"
                  placeholder="active security clearance, onsite only"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Resume PDF limit
                <TextInput name="resumePdfLimit" type="number" defaultValue={client.resumePdfLimit} className="mt-1" />
              </label>
            </div>
          </Panel>

          {/* Application notes */}
          <Panel title="Notes for team members">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-ink">
                Application instructions <span className="font-normal text-muted">(shown to team members on every job)</span>
                <TextArea
                  name="applicationNotes"
                  defaultValue={client.applicationNotes || ""}
                  className="mt-1"
                  placeholder="Prioritize company career pages. Avoid roles requiring active clearance."
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Work authorization notes
                <TextInput name="workAuthorizationNotes" defaultValue={client.workAuthorizationNotes || ""} className="mt-1" />
              </label>
              <label className="block text-sm font-medium text-ink">
                Sponsorship requirement
                <TextInput name="sponsorshipRequirement" defaultValue={client.sponsorshipRequirement || ""} className="mt-1" />
              </label>
            </div>
          </Panel>

          {/* CV text */}
          <Panel title="CV / resume text">
            <label className="block text-sm font-medium text-ink">
              Paste the full CV text <span className="font-normal text-muted">(used for resume analysis and keyword matching)</span>
              <TextArea
                name="cvText"
                defaultValue={client.cvText || ""}
                className="mt-1 min-h-60"
                placeholder="Paste the client's full resume text here…"
              />
            </label>
          </Panel>
        </div>

        <div className="flex items-center gap-3">
          <SubmitButton>Save changes</SubmitButton>
          <a href={`/clients/${client.id}`} className="text-sm text-muted hover:text-ink">Cancel</a>
        </div>
      </form>
    </AppShell>
  );
}
