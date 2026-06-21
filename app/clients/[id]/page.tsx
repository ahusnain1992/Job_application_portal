import Link from "next/link";
import { notFound } from "next/navigation";
import { JobStatus, Role } from "@prisma/client";
import { Mail, CheckCircle, Pencil, Archive, RotateCcw } from "lucide-react";
import { ArchiveClientButton } from "@/components/archive-client-button";
import { DeleteClientButton } from "@/components/delete-client-button";
import { AppShell } from "@/components/shell";
import { JobTable } from "@/components/job-table";
import { ClientRefreshButton } from "@/components/client-refresh-button";
import { Badge, MetricCard, PageHeader, Panel } from "@/components/ui";
import { requireUser, requireClientAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ClientDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { gmailConnected?: string; error?: string; updated?: string };
}) {
  const user = await requireUser();

  await requireClientAccess(user, params.id);

  const isAdmin = user.role === Role.ADMIN;
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  const [client, allTeamMembers] = await Promise.all([
    prisma.clientProfile.findUnique({
      where: { id: params.id },
      include: {
        assignments: { include: { user: { select: { name: true, id: true } } } },
        resumes: true,
        jobs: {
          orderBy: [{ matchScore: "desc" }, { discoveredAt: "desc" }],
          take: 20,
          include: { client: { select: { clientName: true } } }
        },
        applications: {
          include: { appliedBy: { select: { name: true } } }
        },
        _count: { select: { jobs: true } }
      }
    }),
    isAdmin
      ? prisma.user.findMany({ where: { role: { not: "ADMIN" } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string }[])
  ]);
  if (!client) notFound();

  const applied = client.applications.filter((a) => a.status === JobStatus.APPLIED).length;
  const skipped = client.applications.filter((a) => a.status === JobStatus.SKIPPED).length;
  const rejected = client.applications.filter((a) => a.status === JobStatus.REJECTED).length;
  const interviews = client.applications.filter((a) => a.status === JobStatus.INTERVIEW_RECEIVED).length;
  const pendingStatuses: string[] = ["NEW", "SUGGESTED", "APPROVED", "ASSIGNED"];
  const pending = client.applications.filter((a) => pendingStatuses.includes(a.status)).length;
  const flagged = client.applications.filter((a) => (a as any).flaggedFast && !(a as any).verifiedByGmail && !(a as any).flagDismissed).length;
  const gmailVerified = client.applications.filter((a) => (a as any).verifiedByGmail).length;

  // Per-resource breakdown for this client
  const resourceBreakdown = client.assignments.map((assignment) => {
    const memberApps = client.applications.filter((a) => a.appliedById === assignment.userId);
    return {
      name: assignment.user.name,
      applied: memberApps.filter((a) => a.status === JobStatus.APPLIED).length,
      skipped: memberApps.filter((a) => a.status === JobStatus.SKIPPED).length
    };
  });

  return (
    <AppShell>
      {searchParams.updated && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-brand/30 bg-[#ECF7F4] px-4 py-3 text-sm text-[#186A5E]">
          <CheckCircle size={16} /> Client profile updated successfully.
        </div>
      )}
      {searchParams.gmailConnected ? (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-brand/30 bg-[#ECF7F4] px-4 py-3 text-sm text-[#186A5E]">
          <CheckCircle size={16} /> Gmail connected successfully. The system will now auto-verify applications for {client.clientName}.
        </div>
      ) : null}
      {searchParams.error === "google-not-configured" ? (
        <div className="mb-4 rounded-md border border-warn/40 bg-[#FFF6EB] px-4 py-3 text-sm text-[#8A4604]">
          <strong>Gmail not configured.</strong> To enable Gmail verification, add these two variables in Railway → your service → Variables:
          <ul className="mt-2 list-disc pl-5 space-y-1 font-mono text-xs">
            <li>GOOGLE_CLIENT_ID</li>
            <li>GOOGLE_CLIENT_SECRET</li>
          </ul>
          <p className="mt-2 text-xs">Get these from <strong>console.cloud.google.com</strong> → APIs &amp; Services → Credentials → Create OAuth 2.0 Client ID (Web application). Gmail verification is optional — the portal works fully without it.</p>
        </div>
      ) : null}

      <PageHeader
        title={client.clientName}
        eyebrow="Client profile"
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <Badge tone={client.status === "ACTIVE" ? "brand" : "neutral"}>{client.status}</Badge>
              <ClientRefreshButton clientId={client.id} clientName={client.clientName} />
              <Link href={`/clients/${client.id}/edit`} className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas">
                <Pencil size={12} /> Edit profile
              </Link>
              <ArchiveClientButton clientId={client.id} clientName={client.clientName} currentStatus={client.status} />
              {client.status === "INACTIVE" && (
                <DeleteClientButton clientId={client.id} clientName={client.clientName} />
              )}
              {client.gmailEmail ? (
                <div className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-[#ECF7F4] px-3 py-1.5 text-xs font-semibold text-[#186A5E]">
                  <CheckCircle size={12} /> {client.gmailEmail}
                </div>
              ) : googleConfigured ? (
                <a
                  href={`/api/gmail/connect?clientId=${client.id}`}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
                >
                  <Mail size={13} /> Connect Gmail
                </a>
              ) : (
                <span
                  title="Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Railway to enable Gmail verification"
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-canvas px-3 py-1.5 text-xs text-muted cursor-not-allowed"
                >
                  <Mail size={13} /> Gmail (not configured)
                </span>
              )}
            </div>
          ) : null
        }
      />

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total jobs found" value={client._count.jobs} />
        <MetricCard label="Pending review" value={pending} tone="signal" />
        <MetricCard label="Applied" value={applied} tone="brand" />
        <MetricCard label="Skipped" value={skipped} tone="warn" />
        <MetricCard label="Rejected" value={rejected} />
        <MetricCard label="Interviews" value={interviews} tone="brand" />
      </div>

      {(flagged > 0 || gmailVerified > 0) ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {gmailVerified > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-md border border-brand/30 bg-[#ECF7F4] px-3 py-2 text-sm text-[#186A5E]">
              <CheckCircle size={14} /> {gmailVerified} applications Gmail-verified
            </div>
          ) : null}
          {flagged > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              ⚑ {flagged} applications flagged as suspiciously fast — review needed
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          {/* Client preferences */}
          <Panel title="Profile & preferences">
            <div className="space-y-3 text-sm">
              <div><strong>Current role:</strong> {client.currentJobTitle}</div>
              <div><strong>Target titles:</strong> {client.targetJobTitles.join(", ")}</div>
              {client.alternativeJobTitles.length ? (
                <div><strong>Alternative titles:</strong> {client.alternativeJobTitles.join(", ")}</div>
              ) : null}
              <div><strong>Main skills:</strong> {client.mainSkills.join(", ")}</div>
              {client.secondarySkills.length ? (
                <div><strong>Secondary skills:</strong> {client.secondarySkills.join(", ")}</div>
              ) : null}
              <div>
                <strong>Locations:</strong>{" "}
                {[
                  ...(client.preferredCountries.length ? client.preferredCountries : []),
                  ...(client.preferredCities.length ? client.preferredCities : []),
                  ...(client.preferredLocations.includes("Remote") ? ["Remote"] : []),
                ].join(", ") || client.preferredLocations.join(", ") || "—"}
              </div>
              <div><strong>Work mode:</strong> {client.workModePreference}</div>
              <div><strong>Employment:</strong> {client.employmentTypePreference}</div>
              {(client.minimumSalary || client.maximumSalary) ? (
                <div>
                  <strong>Salary range:</strong>{" "}
                  {[client.minimumSalary, client.maximumSalary].filter(Boolean).map((n) =>
                    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n!)
                  ).join(" – ")}
                </div>
              ) : null}
              {client.applicationNotes ? (
                <div className="rounded-md bg-canvas p-3">
                  <strong>Applicant notes:</strong>
                  <p className="mt-1 text-muted">{client.applicationNotes}</p>
                </div>
              ) : null}
              {client.keywordsExclude.length ? (
                <div>
                  <strong>Exclude keywords:</strong>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {client.keywordsExclude.map((k) => <Badge key={k} tone="warn">{k}</Badge>)}
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>

          {/* Assigned resources */}
          <Panel title="Assigned resources">
            <div className="space-y-3">
              {client.assignments.map((a) => {
                const stats = resourceBreakdown.find((r) => r.name === a.user.name);
                return (
                  <div key={a.user.id} className="flex items-center justify-between rounded-md border border-line p-3">
                    <div className="font-medium text-ink">{a.user.name}</div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-muted">
                        {stats?.applied ?? 0} applied · {stats?.skipped ?? 0} skipped
                      </div>
                      {isAdmin && (
                        <form action={`/api/clients/${client.id}/assign`} method="post">
                          <input type="hidden" name="userId" value={a.user.id} />
                          <input type="hidden" name="action" value="remove" />
                          <button
                            type="submit"
                            className="rounded px-2 py-0.5 text-xs text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Remove assignment"
                          >
                            Remove
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
              {client.assignments.length === 0 ? (
                <div className="text-sm text-muted">No resources assigned yet.</div>
              ) : null}
            </div>

            {isAdmin && allTeamMembers.length > 0 && (
              <form action={`/api/clients/${client.id}/assign`} method="post" className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                <input type="hidden" name="action" value="add" />
                <select
                  name="userId"
                  required
                  className="focus-ring h-9 flex-1 rounded-md border border-line bg-white px-3 text-sm text-ink"
                >
                  <option value="">Add team member…</option>
                  {allTeamMembers
                    .filter((u) => !client.assignments.some((a) => a.user.id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
                <button
                  type="submit"
                  className="focus-ring h-9 rounded-md border border-brand bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
                >
                  Assign
                </button>
              </form>
            )}
          </Panel>

          {/* Resume versions */}
          <Panel title={`Resume versions (${client.resumes.length})`}>
            <div className="space-y-2">
              {client.resumes.length === 0 ? (
                <div className="text-sm text-muted">No resume versions yet.</div>
              ) : client.resumes.map((r) => {
                const hasText = !!r.resumeText?.trim();
                return (
                  <div key={r.id} className={`flex items-center justify-between rounded-md border p-3 ${hasText ? "border-brand/20 bg-[#F0FAF7]" : "border-warn/30 bg-[#FFF6EB]"}`}>
                    <div>
                      <div className="text-sm font-semibold text-ink">{r.name}</div>
                      {hasText ? (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-[#186A5E]">
                          <CheckCircle size={10} /> ATS ready — used for matching
                        </div>
                      ) : (
                        <div className="text-xs text-[#8A4604] mt-0.5">Text missing — not used for matching</div>
                      )}
                    </div>
                    {r.fileUrl ? (
                      r.fileUrl.startsWith("data:") ? (
                        <a href={r.fileUrl} download={`${r.name}.pdf`} className="text-xs text-brand hover:underline shrink-0">Download</a>
                      ) : (
                        <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline shrink-0">Open file</a>
                      )
                    ) : <span className="text-xs text-muted shrink-0">No file</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-3">
              <Link href="/resumes" className="text-xs text-brand hover:underline">Manage resume versions →</Link>
            </div>
          </Panel>

          {/* Gmail integration status */}
          <Panel title="Gmail auto-verification">
            {client.gmailEmail ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-brand">
                  <CheckCircle size={14} /> Connected: {client.gmailEmail}
                </div>
                {client.gmailConnectedAt ? (
                  <div className="text-xs text-muted">
                    Connected {new Date(client.gmailConnectedAt).toLocaleDateString()}
                  </div>
                ) : null}
                <p className="text-muted">
                  The system scans this inbox daily for application confirmation emails and automatically verifies applications.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-muted">
                  Connect the client&apos;s Gmail to automatically detect application confirmation emails from Greenhouse, Workday, Lever, and other ATS platforms.
                </p>
                {isAdmin ? (
                  <a
                    href={`/api/gmail/connect?clientId=${client.id}`}
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-canvas"
                  >
                    <Mail size={14} /> Connect Gmail
                  </a>
                ) : null}
              </div>
            )}
          </Panel>
        </div>

        {/* Recent jobs */}
        <Panel title={`Recent jobs (showing ${client.jobs.length} of ${client._count.jobs})`}>
          <JobTable jobs={client.jobs} />
        </Panel>
      </div>
    </AppShell>
  );
}
