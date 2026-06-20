import { Role } from "@prisma/client";
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
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Panel title="Add resume version">
          <form action="/api/clients" method="post" className="space-y-3">
            <TextInput name="resumeOnly" type="hidden" value="true" />
            <select name="clientId" className="focus-ring h-10 w-full rounded-md border border-line bg-white px-3 text-sm" required>
              <option value="">Select client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.clientName}</option>)}
            </select>
            <TextInput name="resumeName" placeholder="Senior Data Engineer - GCP" required />
            <label className="block text-sm font-medium text-ink">
              Resume file
              <FileUploadOrUrl
                name="fileUrl"
                placeholder="https://drive.google.com/..."
                className="mt-1"
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
                    <div key={resume.id} className="flex items-center justify-between rounded-md bg-canvas px-3 py-2 text-sm">
                      <span>{resume.name}</span>
                      {resume.fileUrl && (
                        resume.fileUrl.startsWith("data:") ? (
                          <a
                            href={resume.fileUrl}
                            download={`${resume.name}.pdf`}
                            className="text-xs text-brand hover:underline"
                          >
                            Download
                          </a>
                        ) : (
                          <a
                            href={resume.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-brand hover:underline"
                          >
                            View
                          </a>
                        )
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
