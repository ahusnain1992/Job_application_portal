import Link from "next/link";
import { AppShell } from "@/components/shell";
import { Badge, MetricCard, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clusterJobsByResume } from "@/lib/services/resume-match";
import { Role } from "@prisma/client";

const REC_STYLE: Record<string, { tone: "brand" | "signal" | "warn" | "danger" | "neutral"; label: string }> = {
  LEVERAGE:    { tone: "brand",   label: "✏️ Tailor existing" },
  REWRITE:     { tone: "warn",    label: "🔄 Rewrite for ATS" },
  NEW_VERSION: { tone: "danger",  label: "🆕 New version" }
};

export default async function ResumeStrategyPage() {
  const user = await requireUser();

  const assignedClientIds =
    user.role === Role.ADMIN
      ? undefined
      : (
          await prisma.clientAssignment.findMany({
            where: { userId: user.id },
            select: { clientId: true }
          })
        ).map((a) => a.clientId);

  const clients = await prisma.clientProfile.findMany({
    where: assignedClientIds ? { id: { in: assignedClientIds }, status: "ACTIVE" } : { status: "ACTIVE" },
    include: {
      resumes: { where: { active: true } },
      jobs: {
        where: { status: { notIn: ["APPLIED", "SKIPPED", "NOT_RELEVANT", "DUPLICATE", "CLOSED"] } },
        select: {
          id: true,
          title: true,
          companyName: true,
          resumeRecommendation: true,
          resumeCoverageScore: true,
          missingKeywords: true,
          coveredKeywords: true,
          resumeClusterId: true,
          matchScore: true
        }
      }
    },
    orderBy: { clientName: "asc" }
  });

  return (
    <AppShell>
      <PageHeader
        title="Resume strategy"
        eyebrow="PDF budget & rewrite planner"
      />

      <div className="space-y-8">
        {clients.map((client) => {
          const activeJobs = client.jobs;
          const leverage = activeJobs.filter((j) => j.resumeRecommendation === "LEVERAGE").length;
          const rewrite = activeJobs.filter((j) => j.resumeRecommendation === "REWRITE").length;
          const newVersion = activeJobs.filter((j) => j.resumeRecommendation === "NEW_VERSION").length;
          const noAnalysis = activeJobs.filter((j) => !j.resumeRecommendation).length;

          const clusters = clusterJobsByResume(
            activeJobs.filter((j) => j.resumeRecommendation && j.resumeRecommendation !== "LEVERAGE")
          );

          const pdfsNeeded = clusters.length;
          const pdfsAvailable = client.resumePdfLimit;
          const pdfsUsed = client.resumes.length;
          const pdfsRemaining = pdfsAvailable - pdfsUsed;
          const budgetTight = pdfsRemaining < pdfsNeeded;

          return (
            <div key={client.id}>
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-ink">{client.clientName}</h2>
                  <p className="text-sm text-muted">{activeJobs.length} pending jobs analysed</p>
                  <Link href={`/queue?clientId=${client.id}`} className="mt-1 inline-block text-xs text-brand hover:underline">
                    View jobs in queue →
                  </Link>
                </div>
                <div className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${budgetTight ? "border-red-200 bg-red-50 text-red-700" : "border-brand/30 bg-[#ECF7F4] text-[#186A5E]"}`}>
                  PDF budget: {pdfsUsed} used / {pdfsAvailable} limit · {pdfsRemaining} remaining
                  {budgetTight ? ` · ⚠️ need ${pdfsNeeded}` : ""}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
                <MetricCard label="✏️ Tailor existing" value={leverage} tone="brand" />
                <MetricCard label="🔄 Rewrite for ATS" value={rewrite} tone="warn" />
                <MetricCard label="🆕 New version" value={newVersion} />
                <MetricCard label="⚠ No analysis" value={noAnalysis} />
              </div>

              {!client.cvText && (
                <div className="mb-4 rounded-md border border-warn/30 bg-[#FFF6EB] px-4 py-3 text-sm text-[#8A4604]">
                  No CV text on file for this client — resume analysis is unavailable.{" "}
                  <Link href={`/clients/${client.id}`} className="font-semibold underline">
                    Add CV text →
                  </Link>
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                {/* Cluster plan */}
                {clusters.length > 0 && (
                  <Panel title={`Resume rewrite plan · ${pdfsNeeded} PDF${pdfsNeeded !== 1 ? "s" : ""} needed`}>
                    <div className="space-y-3">
                      {clusters.map((cluster, i) => (
                        <div key={cluster.clusterId} className="rounded-md border border-line p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-ink text-sm">
                                Resume #{i + 1}: {cluster.suggestedResumeName}
                              </div>
                              <div className="mt-1 text-xs text-muted">
                                Key skills: {cluster.keySkills.slice(0, 5).join(", ")}
                              </div>
                            </div>
                            <Badge tone="signal">{cluster.jobs.length} jobs</Badge>
                          </div>
                          <div className="mt-2 space-y-1">
                            {cluster.jobs.slice(0, 4).map((j) => {
                              const rec = REC_STYLE[j.recommendation] ?? REC_STYLE.LEVERAGE;
                              return (
                                <div key={j.id} className="flex items-center justify-between text-xs text-muted">
                                  <Link href={`/jobs/${j.id}`} className="hover:text-brand">
                                    {j.title} @ {j.company}
                                  </Link>
                                  <Badge tone={rec.tone}>{rec.label}</Badge>
                                </div>
                              );
                            })}
                            {cluster.jobs.length > 4 && (
                              <div className="text-xs text-muted">+{cluster.jobs.length - 4} more jobs in this cluster</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {leverage > 0 && (
                        <div className="rounded-md border border-brand/20 bg-[#ECF7F4] p-3 text-sm text-[#186A5E]">
                          <strong>{leverage} jobs</strong> can use the existing resume with minor keyword tailoring — no new PDF needed.
                        </div>
                      )}
                    </div>
                  </Panel>
                )}

                {/* Job-by-job breakdown */}
                <Panel title="All pending jobs — resume decision">
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {activeJobs.length === 0 && (
                      <p className="text-sm text-muted">No pending jobs for this client.</p>
                    )}
                    {activeJobs
                      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
                      .map((job) => {
                        const rec = job.resumeRecommendation
                          ? REC_STYLE[job.resumeRecommendation]
                          : null;
                        return (
                          <div key={job.id} className="rounded-md border border-line p-3">
                            <div className="flex items-start justify-between gap-2">
                              <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-ink hover:text-brand leading-tight">
                                {job.title}
                                <span className="ml-1 font-normal text-muted">@ {job.companyName}</span>
                              </Link>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-muted">{job.matchScore}%</span>
                                {rec ? (
                                  <Badge tone={rec.tone}>{rec.label}</Badge>
                                ) : (
                                  <Badge tone="neutral">No CV</Badge>
                                )}
                              </div>
                            </div>
                            {job.resumeCoverageScore !== null && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-muted mb-1">
                                  <span>Resume coverage</span>
                                  <span className="font-semibold">{job.resumeCoverageScore}%</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-gray-100">
                                  <div
                                    className={`h-1.5 rounded-full ${job.resumeCoverageScore >= 75 ? "bg-brand" : job.resumeCoverageScore >= 55 ? "bg-signal" : "bg-warn"}`}
                                    style={{ width: `${job.resumeCoverageScore}%` }}
                                  />
                                </div>
                              </div>
                            )}
                            {job.missingKeywords.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {job.missingKeywords.slice(0, 5).map((kw) => (
                                  <span key={kw} className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">
                                    -{kw}
                                  </span>
                                ))}
                                {job.missingKeywords.length > 5 && (
                                  <span className="text-xs text-muted">+{job.missingKeywords.length - 5} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </Panel>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
