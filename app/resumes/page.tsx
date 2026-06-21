import { Role } from "@prisma/client";
import { CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/shell";
import { PageHeader, Panel, SubmitButton, TextInput } from "@/components/ui";
import { FileUploadOrUrl } from "@/components/file-upload-or-url";
import { DeleteResumeButton } from "@/components/delete-resume-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ResumesPage() {
  const user = await requireUser();
  const isAdmin = user.role === Role.ADMIN;

  const assignedClientIds = isAdmin
    ? undefined
    : (await prisma.clientAssignment.findMany({ where: { userId: user.id }, select: { clientId: true } })).map((item) => item.clientId);

  const clients = await prisma.clientProfile.findMany({
    where: assignedClientIds ? { id: { in: assignedClientIds }, status: "ACTIVE" } : { status: "ACTIVE" },
    include: {
      resumes: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { applications: true } } }
      }
    },
    orderBy: { clientName: "asc" }
  });

  const totalResumes = clients.reduce((sum, c) => sum + c.resumes.length, 0);
  const readyResumes = clients.reduce((sum, c) => sum + c.resumes.filter((r) => r.resumeText).length, 0);

  return (
    <AppShell>
      <PageHeader title="Resume versions" eyebrow="Client assets" />

      {/* How this works banner */}
      <div className="mb-6 rounded-lg border border-brand/20 bg-[#F0FAF7] px-4 py-3 text-sm text-[#186A5E]">
        <div className="font-semibold mb-1">How resume versions work</div>
        <ul className="space-y-0.5 text-xs leading-5">
          <li>• <strong>Upload the PDF or paste a URL</strong> so employees can download the file and attach it to applications.</li>
          <li>• <strong>Paste the resume text</strong> so the app can match the right version to each job automatically.</li>
          <li>• Without pasted text, the resume can be downloaded but <strong>will not be matched to jobs</strong>.</li>
          <li>• Each client can have multiple versions: Data Engineer, Data Analyst, Cloud Support, etc.</li>
        </ul>
      </div>

      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        {/* Add form — admin only */}
        {isAdmin && (
          <Panel title="Add resume version">
            <form action="/api/clients" method="post" className="space-y-3">
              <input type="hidden" name="resumeOnly" value="true" />

              <div>
                <label className="block text-sm font-medium text-ink mb-1">Client *</label>
                <select name="clientId" className="focus-ring h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink" required>
                  <option value="">Select client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.clientName}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Resume name * <span className="font-normal text-muted">(describe the target role)</span>
                </label>
                <TextInput name="resumeName" placeholder="e.g. Data Engineer — GCP Focus" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Resume file <span className="font-normal text-muted">(upload PDF or paste a link)</span>
                </label>
                <FileUploadOrUrl
                  name="fileUrl"
                  placeholder="https://drive.google.com/file/..."
                />
                <p className="mt-1.5 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-xs text-muted">
                  ℹ Uploading a file lets employees download it. Pasting resume text below is required for job matching.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Resume text <span className="text-brand font-semibold text-xs">← Required for job matching</span>
                </label>
                <textarea
                  name="resumeText"
                  rows={12}
                  placeholder={"Paste the full plain text of this resume version here.\n\nThe app uses this to:\n• Pick the right resume for each job automatically\n• Calculate how well it matches the job description\n• Decide if a rewrite is needed\n\nHow to get the text:\n1. Open the PDF\n2. Select all (Ctrl+A / Cmd+A)\n3. Copy and paste here"}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-xs font-mono leading-5 text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Rewrite tool URL <span className="font-normal text-muted">(optional)</span>
                </label>
                <TextInput name="rewriteToolUrl" placeholder="https://docs.google.com/..." />
              </div>

              <SubmitButton>Add resume version</SubmitButton>
            </form>
          </Panel>
        )}

        {/* Resumes by client */}
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total versions" value={totalResumes} />
            <SummaryCard label="ATS-ready" value={readyResumes} highlight={readyResumes === totalResumes && totalResumes > 0} />
            <SummaryCard label="Text missing" value={totalResumes - readyResumes} warn={totalResumes - readyResumes > 0} />
            <SummaryCard label="Clients" value={clients.length} />
          </div>

          {clients.length === 0 ? (
            <Panel>
              <div className="py-8 text-center text-sm text-muted">No clients assigned. Ask your admin.</div>
            </Panel>
          ) : clients.map((client) => (
            <Panel key={client.id} title={`${client.clientName} — ${client.resumes.length} version${client.resumes.length !== 1 ? "s" : ""}`}>
              {client.resumes.length === 0 ? (
                <div className="py-4 text-sm text-muted">
                  No resume versions yet.{isAdmin ? " Add one using the form on the left." : " Ask your admin to upload resume versions for this client."}
                </div>
              ) : (
                <div className="space-y-2">
                  {client.resumes.map((resume) => {
                    const hasText = !!resume.resumeText?.trim();
                    const hasFile = !!resume.fileUrl;
                    const appCount = resume._count.applications;
                    return (
                      <div
                        key={resume.id}
                        className={`rounded-lg border p-3 ${hasText ? "border-brand/20 bg-[#F0FAF7]" : "border-warn/30 bg-[#FFF6EB]"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-ink">{resume.name}</span>
                              {hasText ? (
                                <span className="flex items-center gap-1 rounded bg-[#DDF3ED] px-1.5 py-0.5 text-xs font-semibold text-[#14544B]">
                                  <CheckCircle size={10} /> ATS ready
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 rounded bg-[#FFF0D4] px-1.5 py-0.5 text-xs font-semibold text-[#8A4604]">
                                  <AlertTriangle size={10} /> Text missing
                                </span>
                              )}
                              {appCount > 0 && (
                                <span className="rounded bg-white border border-line px-1.5 py-0.5 text-xs text-muted">
                                  Used in {appCount} application{appCount !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>

                            {!hasText && (
                              <p className="mt-1 text-xs text-[#8A4604]">
                                This resume can be downloaded, but it cannot be used for job matching until resume text is pasted.
                              </p>
                            )}

                            {resume.rewriteToolUrl && (
                              <a
                                href={resume.rewriteToolUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-brand hover:underline"
                              >
                                <ExternalLink size={10} /> Open rewrite tool
                              </a>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {hasFile ? (
                              resume.fileUrl!.startsWith("data:") ? (
                                <a
                                  href={resume.fileUrl!}
                                  download={`${resume.name}.pdf`}
                                  className="rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-canvas"
                                >
                                  Download
                                </a>
                              ) : (
                                <a
                                  href={resume.fileUrl!}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-canvas"
                                >
                                  Open file
                                </a>
                              )
                            ) : (
                              <span className="text-xs text-muted italic">No file</span>
                            )}
                            {isAdmin && (
                              <DeleteResumeButton
                                resumeId={resume.id}
                                resumeName={resume.name}
                                onDeleted={() => { if (typeof window !== "undefined") window.location.reload(); }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value, highlight, warn }: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 text-center ${
      highlight ? "border-brand/20 bg-[#ECF7F4]"
      : warn ? "border-warn/30 bg-[#FFF6EB]"
      : "border-line bg-white"
    }`}>
      <div className={`text-2xl font-bold ${warn ? "text-warn" : highlight ? "text-brand" : "text-ink"}`}>{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
