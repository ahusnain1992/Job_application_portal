import { Role } from "@prisma/client";
import { CheckCircle } from "lucide-react";
import { AppShell } from "@/components/shell";
import { PageHeader, Panel, SubmitButton, TextInput } from "@/components/ui";
import { FileUploadOrUrl } from "@/components/file-upload-or-url";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ResumesPage() {
  const user = await requireUser();
  const assignedClientIds = user.role === Role.ADMIN ? undefined : (await prisma.clientAssignment.findMany({ where: { userId: user.id }, select: { clientId: true } })).map((item) => item.clientId);
  const clients = await prisma.clientProfile.findMany({
    where: assignedClientIds ? { id: { in: assignedClientIds } } : undefined,
    include: { resumes: true },
    orderBy: { clientName: "asc" }
  });

  return (
    <AppShell>
      <PageHeader title="Resume versions" eyebrow="Client assets" />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Panel title="Add resume version">
          <form action="/api/clients" method="post" className="space-y-3">
            <TextInput name="resumeOnly" type="hidden" value="true" />
            <select name="clientId" className="focus-ring h-10 w-full rounded-md border border-line bg-white px-3 text-sm" required>
              <option value="">Select client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.clientName}</option>)}
            </select>
            <TextInput name="resumeName" placeholder="e.g. Senior Data Engineer - GCP" required />
            <label className="block text-sm font-medium text-ink">
              Resume file
              <FileUploadOrUrl
                name="fileUrl"
                placeholder="https://drive.google.com/..."
                className="mt-1"
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              Resume text (paste full CV text)
              <span className="ml-1 text-xs font-normal text-brand">← Required for ATS matching</span>
              <textarea
                name="resumeText"
                rows={10}
                placeholder={"Paste the full text of this resume version here.\nThis is used to automatically match the right resume to each job and decide if a rewrite is needed.\n\nExample:\nJohn Smith\nSenior Data Engineer\n\nEXPERIENCE\n• Designed GCP data pipelines..."}
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-xs font-mono leading-5 text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y"
              />
            </label>
            <TextInput name="rewriteToolUrl" placeholder="Rewrite tool URL (optional)" />
            <SubmitButton>Add resume</SubmitButton>
          </form>
        </Panel>

        <Panel title="Versions by client">
          <div className="grid gap-4 md:grid-cols-2">
            {clients.map((client) => (
              <div key={client.id} className="rounded-lg border border-line p-4">
                <div className="font-semibold">{client.clientName}</div>
                <div className="mt-3 space-y-2">
                  {client.resumes.map((resume) => (
                    <div key={resume.id} className="rounded-md border border-line bg-canvas px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{resume.name}</span>
                        <div className="flex items-center gap-2">
                          {resume.resumeText && (
                            <span className="flex items-center gap-0.5 text-xs text-brand">
                              <CheckCircle size={11} /> ATS ready
                            </span>
                          )}
                          {resume.fileUrl && (
                            resume.fileUrl.startsWith("data:") ? (
                              <a href={resume.fileUrl} download={`${resume.name}.pdf`} className="text-xs text-muted hover:text-brand hover:underline">Download</a>
                            ) : (
                              <a href={resume.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-brand hover:underline">View</a>
                            )
                          )}
                        </div>
                      </div>
                      {!resume.resumeText && (
                        <p className="mt-1 text-xs text-warn">No text pasted — ATS matching disabled for this resume</p>
                      )}
                    </div>
                  ))}
                  {client.resumes.length === 0 && (
                    <div className="text-xs text-muted">No resumes yet.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
