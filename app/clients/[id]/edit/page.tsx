import { notFound, redirect } from "next/navigation";
import { EmploymentType, Role, WorkMode } from "@prisma/client";
import { AppShell } from "@/components/shell";
import { LocationPicker } from "@/components/location-picker";
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
              <div>
                <p className="text-sm font-medium text-ink mb-2">Job locations</p>
                <LocationPicker
                  defaultCountries={client.preferredCountries}
                  defaultCities={client.preferredCities}
                  defaultLocations={client.preferredLocations}
                />
              </div>
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

          {/* Personal information for form filling */}
          <Panel title="Personal information (for form filling)">
            <p className="mb-3 text-xs text-muted">Used by employees to fill in application forms. Visible only to team members on each job page.</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  Date of birth
                  <TextInput
                    name="dateOfBirth"
                    type="date"
                    defaultValue={client.dateOfBirth ? new Date(client.dateOfBirth).toISOString().split("T")[0] : ""}
                    className="mt-1"
                  />
                </label>
                <label className="block text-sm font-medium text-ink">
                  Phone number
                  <TextInput name="phone" type="tel" defaultValue={client.phone || ""} placeholder="+1 (555) 000-0000" className="mt-1" />
                </label>
              </div>
              <label className="block text-sm font-medium text-ink">
                Personal email
                <TextInput name="personalEmail" type="email" defaultValue={client.personalEmail || ""} placeholder="client@gmail.com" className="mt-1" />
              </label>
              <label className="block text-sm font-medium text-ink">
                Street address
                <TextInput name="streetAddress" defaultValue={client.streetAddress || ""} placeholder="123 Main St, Apt 4B" className="mt-1" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  City
                  <TextInput name="addressCity" defaultValue={client.addressCity || ""} placeholder="Chicago" className="mt-1" />
                </label>
                <label className="block text-sm font-medium text-ink">
                  State / Province
                  <TextInput name="addressState" defaultValue={client.addressState || ""} placeholder="IL" className="mt-1" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  ZIP / Postal code
                  <TextInput name="addressZip" defaultValue={client.addressZip || ""} placeholder="60601" className="mt-1" />
                </label>
                <label className="block text-sm font-medium text-ink">
                  Country
                  <TextInput name="addressCountry" defaultValue={client.addressCountry || ""} placeholder="United States" className="mt-1" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  GitHub URL
                  <TextInput name="githubUrl" type="url" defaultValue={client.githubUrl || ""} placeholder="https://github.com/..." className="mt-1" />
                </label>
                <label className="block text-sm font-medium text-ink">
                  Languages spoken
                  <TextInput name="languages" defaultValue={client.languages?.join(", ") || ""} placeholder="English, Urdu" className="mt-1" />
                </label>
              </div>
            </div>
          </Panel>

          {/* Education */}
          <Panel title="Education">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  Highest degree
                  <Select name="highestDegree" defaultValue={client.highestDegree || ""} className="mt-1">
                    <option value="">Not specified</option>
                    <option>High School / GED</option>
                    <option>Associate&apos;s Degree</option>
                    <option>Bachelor&apos;s Degree</option>
                    <option>Master&apos;s Degree</option>
                    <option>MBA</option>
                    <option>PhD / Doctorate</option>
                    <option>Professional Degree (JD, MD)</option>
                    <option>Bootcamp / Certificate</option>
                  </Select>
                </label>
                <label className="block text-sm font-medium text-ink">
                  Field of study / Major
                  <TextInput name="fieldOfStudy" defaultValue={client.fieldOfStudy || ""} placeholder="Computer Science" className="mt-1" />
                </label>
              </div>
              <label className="block text-sm font-medium text-ink">
                University / School
                <TextInput name="university" defaultValue={client.university || ""} placeholder="University of Illinois" className="mt-1" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  Graduation year
                  <TextInput name="graduationYear" type="number" defaultValue={client.graduationYear ?? ""} placeholder="2018" className="mt-1" />
                </label>
                <label className="block text-sm font-medium text-ink">
                  GPA <span className="font-normal text-muted">(optional)</span>
                  <TextInput name="gpa" defaultValue={client.gpa || ""} placeholder="3.8 / 4.0" className="mt-1" />
                </label>
              </div>
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
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  Notice period
                  <Select name="noticePeriod" defaultValue={client.noticePeriod || ""} className="mt-1">
                    <option value="">Not specified</option>
                    <option>Immediate</option>
                    <option>1 week</option>
                    <option>2 weeks</option>
                    <option>1 month</option>
                    <option>2 months</option>
                    <option>3 months</option>
                  </Select>
                </label>
                <label className="block text-sm font-medium text-ink">
                  Available from
                  <TextInput
                    name="availableFrom"
                    type="date"
                    defaultValue={client.availableFrom ? new Date(client.availableFrom).toISOString().split("T")[0] : ""}
                    className="mt-1"
                  />
                </label>
              </div>
            </div>
          </Panel>

          {/* EEO / Voluntary disclosures */}
          <Panel title="EEO / Voluntary disclosures">
            <p className="mb-3 text-xs text-muted">Optional. Used only when a job application specifically asks. Leave blank if the client doesn&apos;t want to disclose.</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  Gender (EEO)
                  <Select name="genderEeo" defaultValue={client.genderEeo || ""} className="mt-1">
                    <option value="">Prefer not to say</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Non-binary</option>
                    <option>Decline to self-identify</option>
                  </Select>
                </label>
                <label className="block text-sm font-medium text-ink">
                  Ethnicity (EEO)
                  <Select name="ethnicityEeo" defaultValue={client.ethnicityEeo || ""} className="mt-1">
                    <option value="">Prefer not to say</option>
                    <option>White</option>
                    <option>Black or African American</option>
                    <option>Hispanic or Latino</option>
                    <option>Asian</option>
                    <option>Native American or Alaska Native</option>
                    <option>Native Hawaiian or Pacific Islander</option>
                    <option>Two or more races</option>
                    <option>Decline to self-identify</option>
                  </Select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink">
                  Veteran status
                  <Select name="veteranStatus" defaultValue={client.veteranStatus || ""} className="mt-1">
                    <option value="">Prefer not to say</option>
                    <option>I am not a protected veteran</option>
                    <option>I identify as a protected veteran</option>
                    <option>Decline to self-identify</option>
                  </Select>
                </label>
                <label className="block text-sm font-medium text-ink">
                  Disability status
                  <Select name="disabilityStatus" defaultValue={client.disabilityStatus || ""} className="mt-1">
                    <option value="">Prefer not to say</option>
                    <option>Yes, I have a disability</option>
                    <option>No, I don&apos;t have a disability</option>
                    <option>Decline to self-identify</option>
                  </Select>
                </label>
              </div>
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
