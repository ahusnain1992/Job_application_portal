import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { JobStatus, WorkMode } from "@prisma/client";
import { Badge } from "@/components/ui";
import { money, relativeDate, statusLabel, workModeLabel } from "@/lib/format";

type JobRow = {
  id: string;
  title: string;
  companyName: string;
  location: string;
  workMode: WorkMode;
  status: JobStatus;
  matchScore: number;
  sourceName: string;
  postedDate: Date | null;
  applyUrl: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  client: { clientName: string };
  duplicateGroupId: string | null;
  resumeRecommendation?: string | null;
  resumeCoverageScore?: number | null;
};

function buildDupSet(jobs: JobRow[]): Set<string> {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    if (j.duplicateGroupId) counts.set(j.duplicateGroupId, (counts.get(j.duplicateGroupId) ?? 0) + 1);
  }
  const set = new Set<string>();
  counts.forEach((count, id) => { if (count > 1) set.add(id); });
  return set;
}

const REC_BADGE: Record<string, { tone: "brand" | "signal" | "warn" | "danger" | "neutral"; short: string }> = {
  AS_IS:           { tone: "brand",   short: "✅ As-is" },
  MINOR_TAILORING: { tone: "signal",  short: "✏️ Tailor" },
  FULL_REWRITE:    { tone: "warn",    short: "🔄 Rewrite" },
  NEW_VERSION:     { tone: "danger",  short: "📄 New CV" },
};

export function JobTable({ jobs }: { jobs: JobRow[] }) {
  const dupSet = buildDupSet(jobs);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase text-muted">
            <th className="py-3 pr-4 font-semibold">Job</th>
            <th className="py-3 pr-4 font-semibold">Client</th>
            <th className="py-3 pr-4 font-semibold">Status</th>
            <th className="py-3 pr-4 font-semibold">Match</th>
            <th className="py-3 pr-4 font-semibold">Resume</th>
            <th className="py-3 pr-4 font-semibold">Source</th>
            <th className="py-3 pr-4 font-semibold">Posted</th>
            <th className="py-3 pr-4 font-semibold">Apply</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const rec = job.resumeRecommendation ? REC_BADGE[job.resumeRecommendation] : null;
            return (
              <tr key={job.id} className="border-b border-line/70 align-top last:border-0">
                <td className="py-3 pr-4">
                  <Link href={`/jobs/${job.id}`} className="font-semibold text-ink hover:text-brand">
                    {job.title}
                  </Link>
                  <div className="mt-1 text-muted">
                    {job.companyName} · {job.location} · {workModeLabel(job.workMode)}
                  </div>
                  <div className="mt-1 text-muted">{money(job.salaryMin, job.salaryMax)}</div>
                  {job.duplicateGroupId && dupSet.has(job.duplicateGroupId) ? (
                    <div className="mt-2">
                      <Badge tone="warn">Seen across clients</Badge>
                    </div>
                  ) : null}
                </td>
                <td className="py-3 pr-4 text-muted">{job.client.clientName}</td>
                <td className="py-3 pr-4">
                  <Badge
                    tone={
                      job.status === JobStatus.APPLIED ? "brand"
                      : job.status === JobStatus.DUPLICATE ? "warn"
                      : job.status === JobStatus.IN_PROGRESS ? "signal"
                      : "neutral"
                    }
                  >
                    {statusLabel(job.status)}
                  </Badge>
                </td>
                <td className="py-3 pr-4 font-semibold">{job.matchScore}%</td>
                <td className="py-3 pr-4">
                  {rec ? (
                    <div>
                      <Badge tone={rec.tone}>{rec.short}</Badge>
                      {job.resumeCoverageScore !== null && job.resumeCoverageScore !== undefined ? (
                        <div className="mt-1 text-xs text-muted">{job.resumeCoverageScore}% covered</div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-muted">{job.sourceName}</td>
                <td className="py-3 pr-4 text-muted">{relativeDate(job.postedDate)}</td>
                <td className="py-3 pr-4">
                  {job.applyUrl ? (
                    <a
                      className="inline-flex items-center gap-1 text-brand hover:underline"
                      href={job.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open <ExternalLink size={14} />
                    </a>
                  ) : (
                    <span className="text-muted">Missing</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
