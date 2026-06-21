import { notFound } from "next/navigation";
import Link from "next/link";
import { JobStatus, Role } from "@prisma/client";
import { ExternalLink, ShieldCheck, AlertTriangle, Clock, FileText, ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/shell";
import { ApplyButton } from "@/components/apply-button";
import { ActionForm } from "@/components/action-form";
import { CoverLetterButton } from "@/components/cover-letter-button";
import { ResumeHandoffButton } from "@/components/resume-handoff-button";
import { ResumeRewriteButton } from "@/components/resume-rewrite-button";
import { DismissFlagButton } from "@/components/dismiss-flag-button";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { money, relativeDate, shortDate, statusLabel, workModeLabel } from "@/lib/format";
import { requireUser, requireClientAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function JobDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { duplicateApplied?: string; error?: string };
}) {
  const user = await requireUser();

  const jobMeta = await prisma.job.findUnique({ where: { id: params.id }, select: { clientId: true } });
  if (!jobMeta) notFound();
  await requireClientAccess(user, jobMeta.clientId);

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      client: {
        select: {
          clientName: true,
          currentJobTitle: true,
          applicationNotes: true,
          cvText: true,
          workAuthorizationNotes: true,
          resumes: { where: { active: true }, select: { id: true, name: true, fileUrl: true, resumeText: true } }
        }
      },
      applications: {
        include: {
          appliedBy: { select: { name: true } },
          resume: true,
          statusHistory: { orderBy: { createdAt: "desc" } }
        }
      },
      assignments: { include: { user: { select: { name: true } } } },
      duplicateGroup: { include: { jobs: { take: 6 } } },
      openedBy: { select: { name: true } }
    }
  });
  if (!job) notFound();

  const app = job.applications[0];
  const isApplied = app?.status === JobStatus.APPLIED;
  const isTerminal = isApplied || app?.status === JobStatus.SKIPPED ||
    app?.status === JobStatus.ERROR_COULD_NOT_APPLY || app?.status === JobStatus.NOT_RELEVANT;
  const alreadyAppliedByOther = isApplied && app.appliedById !== user.id;
  const lockActive =
    job.status === JobStatus.IN_PROGRESS &&
    job.lockExpiresAt !== null &&
    job.lockExpiresAt > new Date() &&
    job.openedById !== user.id;

  const needsResumeWork = job.resumeRecommendation === "FULL_REWRITE" || job.resumeRecommendation === "NEW_VERSION";
  const hasWebhook = !!process.env.N8N_RESUME_WEBHOOK_URL;

  // Find the best recommended resume for this job
  const recommendedResume = job.client.resumes.find((r) =>
    r.name.toLowerCase().includes(job.resumeClusterId?.toLowerCase() ?? "_nomatch_")
  ) ?? job.client.resumes[0] ?? null;

  const hasProof = !!(app?.confirmationNumber || app?.proofUrl || app?.verifiedByGmail);
  const isAdmin = user.role === Role.ADMIN;

  return (
    <AppShell>
      {/* Back link */}
      <Link href="/queue" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={14} /> Back to queue
      </Link>

      {/* Alert banners */}
      {searchParams.duplicateApplied && (
        <div className="mb-4 rounded-md border border-warn/40 bg-[#FFF6EB] px-4 py-3 text-sm text-[#8A4604]">
          Another team member already applied to this job. No duplicate application was recorded.
        </div>
      )}
      {searchParams.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error === "proof-required"
            ? "Please enter a confirmation number or screenshot link before marking this job as Applied."
            : searchParams.error === "skip-reason-required"
            ? "Please choose a skip or problem reason before saving."
            : searchParams.error === "invalid-resume"
            ? "Invalid resume selection — please pick a resume from the list and try again."
            : searchParams.error === "invalid-job"
            ? "This job could not be found or no longer belongs to this client. Please go back and refresh."
            : "Something went wrong — please try again. If the problem continues, contact your admin."}
        </div>
      )}
      {lockActive && (
        <div className="mb-4 rounded-md border border-signal/30 bg-[#EEF5FF] px-4 py-3 text-sm text-[#1D4ED8]">
          <strong>{job.openedBy?.name}</strong> opened this job {relativeDate(job.openedAt)} — they may still be completing the application.
        </div>
      )}
      {alreadyAppliedByOther && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-brand/30 bg-[#ECF7F4] px-4 py-3 text-sm text-[#186A5E]">
          <ShieldCheck size={16} />
          Applied by <strong className="ml-1">{app.appliedBy?.name}</strong>
          {app.appliedDateTime && <span className="ml-1 text-muted">on {shortDate(app.appliedDateTime)}</span>}
          {app.verifiedByGmail && <span className="ml-2 font-semibold">· ✓ Gmail verified</span>}
        </div>
      )}

      {/* Employee workflow guide — shown only when job is still actionable */}
      {!isAdmin && !isApplied && !alreadyAppliedByOther && (
        <div className="mb-4 rounded-lg border border-brand/20 bg-[#F0FAF7] px-4 py-3 text-sm text-[#186A5E]">
          <div className="font-semibold mb-1">How to apply for this job:</div>
          <ol className="list-decimal list-inside space-y-0.5 text-xs leading-5">
            <li>Click <strong>Open Job</strong> to open the company&apos;s careers page in a new tab.</li>
            <li>Find the role and submit the application manually on the employer&apos;s website.</li>
            <li>Copy the <strong>confirmation number</strong> or save a <strong>screenshot link</strong> as proof.</li>
            <li>Come back here and fill in the proof, then click <strong>Mark as Applied</strong>.</li>
          </ol>
        </div>
      )}

      {/* Client banner — important context for non-technical employees */}
      <div className="mb-4 rounded-lg border border-line bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-base font-bold text-white">
            {job.client.clientName[0]}
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Applying for client</div>
            <div className="font-semibold text-ink">{job.client.clientName}</div>
          </div>
          {recommendedResume && (
            <div className="ml-auto flex items-center gap-1.5 rounded-md border border-brand/20 bg-[#ECF7F4] px-3 py-1.5 text-xs font-semibold text-[#186A5E]">
              <FileText size={12} />
              Use: {recommendedResume.name}
              {recommendedResume.fileUrl && (
                <a href={recommendedResume.fileUrl} target="_blank" rel="noreferrer" className="ml-1 hover:underline">
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}
        </div>
        {job.client.applicationNotes && (
          <div className="mt-3 rounded-md bg-canvas px-3 py-2 text-sm text-ink">
            <span className="font-medium">Client instructions: </span>{job.client.applicationNotes}
          </div>
        )}
      </div>

      {/* Main header with apply button */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{job.companyName}</div>
            <h1 className="mt-1 text-2xl font-semibold text-ink">{job.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span>{job.location}</span>
              <span>·</span>
              <span>{workModeLabel(job.workMode)}</span>
              {(job.salaryMin || job.salaryMax) && (
                <>
                  <span>·</span>
                  <span>{money(job.salaryMin, job.salaryMax)}</span>
                </>
              )}
              <span>·</span>
              <span>{relativeDate(job.postedDate)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <ApplyButton
              jobId={job.id}
              applyUrl={job.applyUrl}
              isApplied={isApplied}
              alreadyAppliedByOther={alreadyAppliedByOther}
              appliedByName={app?.appliedBy?.name}
            />
            {needsResumeWork && !isApplied && (
              <ResumeHandoffButton jobId={job.id} hasWebhook={hasWebhook} />
            )}
          </div>
        </div>
      </div>

      {/* Status badges */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={job.matchScore >= 75 ? "brand" : job.matchScore >= 55 ? "signal" : "warn"}>
          {job.matchScore}% match
        </Badge>
        <Badge tone={
          job.status === JobStatus.APPLIED ? "brand"
          : job.status === JobStatus.IN_PROGRESS ? "signal"
          : job.status === JobStatus.DUPLICATE ? "warn"
          : "neutral"
        }>
          {statusLabel(job.status)}
        </Badge>
        {app?.flaggedFast && !app.verifiedByGmail && !(app as any).flagDismissed && (
          <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
            <AlertTriangle size={11} /> Applied in {app.timeSpentMinutes} min — flagged
          </span>
        )}
        {app?.verifiedByGmail && (
          <span className="inline-flex items-center gap-1 rounded bg-[#DDF3ED] px-2 py-1 text-xs font-semibold text-[#14544B]">
            <ShieldCheck size={11} /> Gmail verified
          </span>
        )}
        {needsResumeWork && (
          <Badge tone="warn">
            {job.resumeRecommendation === "NEW_VERSION" ? "📄 Needs new resume version" : "🔄 Resume rewrite needed"}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Why this job */}
          <Panel title="Why this job matches the client">
            <p className="text-sm leading-6 text-ink">{job.matchExplanation}</p>
            {job.matchWarnings.length > 0 && (
              <div className="mt-4 space-y-2">
                {job.matchWarnings.map((w) => (
                  <div key={w} className="flex items-start gap-2 rounded-md border border-warn/30 bg-[#FFF6EB] px-3 py-2 text-sm text-[#8A4604]">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Resume decision */}
          <ResumeRecommendationPanel job={job} />

          {/* Resume recommendation — best master resume or AI rewrite */}
          <BestResumePanel job={job} />

          {/* Job details */}
          <Panel title="Job details">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="font-medium text-muted">Work mode</dt><dd>{workModeLabel(job.workMode)}</dd></div>
              <div><dt className="font-medium text-muted">Employment type</dt><dd>{job.employmentType}</dd></div>
              <div><dt className="font-medium text-muted">Salary</dt><dd>{money(job.salaryMin, job.salaryMax)}</dd></div>
              <div><dt className="font-medium text-muted">Source</dt><dd>{job.sourceName}</dd></div>
              <div><dt className="font-medium text-muted">ATS platform</dt><dd>{job.atsPlatform || "Unknown"}</dd></div>
              <div>
                <dt className="font-medium text-muted">Assigned to</dt>
                <dd>{job.assignments.map((a) => a.user.name).join(", ") || "Unassigned"}</dd>
              </div>
            </dl>
            {job.applyUrl && (
              <a href={job.applyUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                Direct apply link <ExternalLink size={13} />
              </a>
            )}
            <div className="mt-5 border-t border-line pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Full job description</div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{job.description}</p>
            </div>
          </Panel>
        </div>

        {/* Right column — action workstation */}
        <div className="space-y-6">

          {/* Action form — employees see this unless someone else applied */}
          {!alreadyAppliedByOther ? (
            <>
              <Panel title="Cover letter support">
                <div className="space-y-3 text-sm">
                  <p className="text-muted">
                    Use this when the job asks for a cover letter or has an optional message field. Review before submitting.
                  </p>
                  <CoverLetterButton jobId={job.id} />
                </div>
              </Panel>

              <Panel title="Record what you did">
                <ActionForm
                  jobId={job.id}
                  clientId={job.clientId}
                  currentStatus={app?.status || job.status}
                  resumes={job.client.resumes}
                  defaultResumeId={app?.resumeId}
                  defaultNotes={app?.notes}
                  defaultConfirmation={app?.confirmationNumber}
                  defaultProof={app?.proofUrl}
                  defaultReasonSkipped={app?.reasonSkipped}
                  defaultCoverLetter={app?.coverLetterUsed}
                  hasProof={hasProof}
                />
              </Panel>
            </>
          ) : (
            <Panel title="Application proof">
              <div className="space-y-3 text-sm">
                {app?.confirmationNumber && (
                  <div>
                    <div className="font-medium text-muted">Confirmation #</div>
                    <div className="mt-1 font-mono text-sm">{app.confirmationNumber}</div>
                  </div>
                )}
                {app?.proofUrl && (
                  <div>
                    <div className="font-medium text-muted">Screenshot proof</div>
                    <a href={app.proofUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand hover:underline">
                      View screenshot <ExternalLink size={13} />
                    </a>
                  </div>
                )}
                {app?.timeSpentMinutes != null && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Clock size={14} className="text-muted" />
                    <span className="text-muted">Time spent: {app.timeSpentMinutes} minutes</span>
                    {app.flaggedFast && !(app as any).flagDismissed && (
                      <Badge tone="danger">Flagged — too fast</Badge>
                    )}
                    {(app as any).flagDismissed && (
                      <span className="inline-flex items-center gap-1 rounded bg-[#ECF7F4] px-2 py-0.5 text-xs text-[#186A5E]">
                        ✓ Flag reviewed by admin
                      </span>
                    )}
                  </div>
                )}
                {app?.flaggedFast && !(app as any).flagDismissed && isAdmin && (
                  <DismissFlagButton applicationId={app.id} />
                )}
                {app?.resume && (
                  <div>
                    <div className="font-medium text-muted">Resume used</div>
                    <div className="mt-1">{app.resume.name}</div>
                  </div>
                )}
                {app?.reasonSkipped && (
                  <div>
                    <div className="font-medium text-muted">Reason</div>
                    <div className="mt-1">{app.reasonSkipped}</div>
                  </div>
                )}
                {app?.notes && (
                  <div>
                    <div className="font-medium text-muted">Notes</div>
                    <div className="mt-1">{app.notes}</div>
                  </div>
                )}
                {app?.coverLetterUsed && (
                  <div>
                    <div className="font-medium text-muted">Cover letter used</div>
                    <pre className="mt-1 whitespace-pre-wrap rounded-md bg-canvas p-2 text-xs leading-5 text-ink">{app.coverLetterUsed}</pre>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Duplicate group */}
          {job.duplicateGroup && job.duplicateGroup.jobs.filter((d) => d.id !== job.id).length > 0 && (
            <Panel title="Same job — other sources">
              <div className="space-y-2">
                {job.duplicateGroup.jobs
                  .filter((d) => d.id !== job.id)
                  .map((d) => (
                    <a key={d.id} href={`/jobs/${d.id}`} className="block rounded-md border border-line p-3 text-sm hover:bg-canvas">
                      <strong>{d.sourceName}</strong>
                      <div className="text-muted">{statusLabel(d.status)}</div>
                    </a>
                  ))}
              </div>
            </Panel>
          )}

          {/* Status history */}
          <Panel title="History">
            <div className="space-y-3 text-sm">
              {app?.statusHistory.length ? (
                app.statusHistory.map((h) => (
                  <div key={h.id} className="border-b border-line pb-3 last:border-0">
                    <div className="font-medium">{statusLabel(h.status)}</div>
                    <div className="text-xs text-muted">{relativeDate(h.createdAt)}</div>
                    {h.note && <div className="mt-1 text-muted">{h.note}</div>}
                  </div>
                ))
              ) : (
                <div className="text-muted">No history yet.</div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

const REC_CONFIG = {
  AS_IS: { bg: "bg-[#ECF7F4]", border: "border-brand/30", text: "text-[#186A5E]", label: "✅ Good news — apply with the current resume" },
  MINOR_TAILORING: { bg: "bg-[#EEF5FF]", border: "border-signal/30", text: "text-[#1D4ED8]", label: "✏️ Small tweaks recommended before applying" },
  FULL_REWRITE: { bg: "bg-[#FFF6EB]", border: "border-warn/30", text: "text-[#8A4604]", label: "🔄 Resume needs a rewrite — use resume builder first" },
  NEW_VERSION: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "📄 Need a new resume version for this type of role" },
} as const;

function ResumeRecommendationPanel({
  job
}: {
  job: {
    resumeRecommendation: string | null;
    resumeCoverageScore: number | null;
    missingKeywords: string[];
    coveredKeywords: string[];
    resumeClusterId: string | null;
  };
}) {
  if (!job.resumeRecommendation) return null;
  const cfg = REC_CONFIG[job.resumeRecommendation as keyof typeof REC_CONFIG];
  if (!cfg) return null;

  return (
    <Panel title="Resume decision">
      <div className={`rounded-md border ${cfg.border} ${cfg.bg} px-4 py-3`}>
        <div className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</div>
        {job.resumeCoverageScore !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>How much of the job requirements are already in the resume</span>
              <span className="font-semibold">{job.resumeCoverageScore}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/60 border border-white">
              <div
                className={`h-2 rounded-full transition-all ${
                  job.resumeCoverageScore >= 75 ? "bg-brand"
                  : job.resumeCoverageScore >= 55 ? "bg-blue-500"
                  : "bg-warn"
                }`}
                style={{ width: `${job.resumeCoverageScore}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {job.missingKeywords.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Missing from resume — need to add
          </div>
          <div className="flex flex-wrap gap-1.5">
            {job.missingKeywords.map((kw) => (
              <span key={kw} className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                − {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {job.coveredKeywords.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Already in resume ✓</div>
          <div className="flex flex-wrap gap-1.5">
            {job.coveredKeywords.slice(0, 8).map((kw) => (
              <span key={kw} className="rounded border border-brand/20 bg-[#ECF7F4] px-2 py-0.5 text-xs font-medium text-[#186A5E]">
                ✓ {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function BestResumePanel({ job }: {
  job: {
    id: string;
    bestResumeId?: string | null;
    bestResumeName?: string | null;
    resumeRecommendation: string | null;
    resumeCoverageScore: number | null;
    client: {
      cvText?: string | null;
      resumes: { id: string; name: string; fileUrl?: string | null; resumeText?: string | null }[];
    };
  }
}) {
  const recommendation = job.resumeRecommendation;
  const needsRewrite = recommendation === "FULL_REWRITE" || recommendation === "NEW_VERSION";
  const hasResumes = job.client.resumes.length > 0;
  const hasCvText = !!job.client.cvText?.trim();

  // Find the best resume object from the client's resume list
  const bestResume = job.bestResumeId
    ? job.client.resumes.find((r) => r.id === job.bestResumeId)
    : null;

  // No resumes and no cvText — nothing to show
  if (!hasResumes && !hasCvText) return null;

  return (
    <Panel title="Resume to use">
      {bestResume ? (
        <div className="space-y-3">
          {/* Best resume card */}
          <div className={`rounded-md border px-4 py-3 ${
            needsRewrite
              ? "border-warn/40 bg-[#FFF6EB]"
              : recommendation === "MINOR_TAILORING"
              ? "border-blue-200 bg-blue-50"
              : "border-brand/30 bg-[#ECF7F4]"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${needsRewrite ? "text-[#8A4604]" : "text-[#186A5E]"}`}>
                  {needsRewrite ? "⚠ Rewrite recommended" : recommendation === "MINOR_TAILORING" ? "✏️ Minor tailoring" : "✅ Use as-is"}
                </div>
                <div className="font-semibold text-sm text-ink">{bestResume.name}</div>
                {job.resumeCoverageScore !== null && (
                  <div className="mt-1 text-xs text-muted">{job.resumeCoverageScore}% of job requirements covered</div>
                )}
              </div>
              {bestResume.fileUrl && (
                bestResume.fileUrl.startsWith("data:") ? (
                  <a href={bestResume.fileUrl} download={`${bestResume.name}.pdf`} className="shrink-0 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas">
                    Download
                  </a>
                ) : (
                  <a href={bestResume.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas">
                    Open resume
                  </a>
                )
              )}
            </div>
          </div>

          {/* Other resumes for reference */}
          {job.client.resumes.length > 1 && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer hover:text-ink">Other resume versions ({job.client.resumes.length - 1})</summary>
              <div className="mt-2 space-y-1 pl-2">
                {job.client.resumes.filter((r) => r.id !== bestResume.id).map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span>{r.name}</span>
                    {r.fileUrl && (
                      <a href={r.fileUrl} target={r.fileUrl.startsWith("data:") ? undefined : "_blank"} rel="noreferrer"
                        download={r.fileUrl.startsWith("data:") ? `${r.name}.pdf` : undefined}
                        className="text-brand hover:underline">
                        {r.fileUrl.startsWith("data:") ? "Download" : "View"}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Only show AI rewrite when genuinely needed */}
          {needsRewrite && (
            <div className="border-t border-line pt-3">
              <p className="mb-2 text-xs text-muted">
                The best resume only covers {job.resumeCoverageScore}% of this job&apos;s requirements. Use AI to tailor it — then review before sending.
              </p>
              <ResumeRewriteButton jobId={job.id} hasCvText={hasCvText || !!bestResume.resumeText} />
            </div>
          )}
        </div>
      ) : (
        // No best resume matched — fall back to AI rewrite if cvText exists
        <div className="space-y-3">
          <p className="text-sm text-muted">
            No master resume versions have been added for this client yet, or their resume text hasn&apos;t been pasted in.
            {hasCvText ? " Using CV text for AI rewrite." : " Add resumes on the Resumes page."}
          </p>
          {hasCvText && (
            <ResumeRewriteButton jobId={job.id} hasCvText={true} />
          )}
        </div>
      )}
    </Panel>
  );
}
