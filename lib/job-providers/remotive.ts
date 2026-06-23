import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "@/lib/job-providers/types";
import { buildJobSearchQueries } from "@/lib/job-providers/search-terms";

export class RemotiveJobProvider implements JobProvider {
  name = "Remotive";

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const results: NormalizedJob[] = [];

    const queries = buildJobSearchQueries({ titles: search.titles, includeKeywords: search.includeKeywords, max: 5 });

    for (const title of queries) {
      try {
        const params = new URLSearchParams({ search: title, limit: "20" });
        const res = await fetch(
          `https://remotive.io/api/remote-jobs?${params}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) continue;

        const data = (await res.json()) as { jobs?: RemotiveJob[] };
        const jobs = data.jobs || [];

        for (const job of jobs) {
          results.push(normalizeRemotive(job, this.name));
        }
      } catch {
        // Skip on error
      }
    }

    return results;
  }
}

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

function normalizeRemotive(job: RemotiveJob, sourceName: string): NormalizedJob {
  const location = job.candidate_required_location || "Remote";
  const salary = parseSalary(job.salary);

  return {
    externalId: `remotive-${job.id}`,
    sourceName,
    sourceUrl: job.url,
    originalJobUrl: job.url,
    companyName: job.company_name || "Unknown Company",
    title: job.title,
    location,
    workMode: WorkMode.REMOTE,
    employmentType: inferEmployment(job.job_type),
    salaryMin: salary.min,
    salaryMax: salary.max,
    description: job.description || "",
    requiredSkills: job.tags || [],
    preferredSkills: [],
    postedDate: job.publication_date ? new Date(job.publication_date) : undefined,
    applyUrl: job.url,
  };
}

function inferEmployment(value?: string): EmploymentType {
  if (!value) return EmploymentType.UNKNOWN;
  const v = value.toLowerCase();
  if (v.includes("contract")) return EmploymentType.CONTRACT;
  if (v.includes("part")) return EmploymentType.PART_TIME;
  if (v.includes("internship")) return EmploymentType.INTERNSHIP;
  return EmploymentType.FULL_TIME;
}

function parseSalary(raw?: string): { min?: number; max?: number } {
  if (!raw) return {};
  const nums = raw.replace(/[,$k]/gi, "").match(/\d+/g)?.map(Number) || [];
  const scaled = nums.map((n) => (n < 1000 ? n * 1000 : n));
  if (scaled.length >= 2) return { min: Math.min(...scaled), max: Math.max(...scaled) };
  if (scaled.length === 1) return { min: scaled[0] };
  return {};
}
