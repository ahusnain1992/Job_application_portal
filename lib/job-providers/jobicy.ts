import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type JobicyJob = {
  id?: number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobGeo?: string;
  jobType?: string;
  jobIndustry?: string[];
  jobTag?: string[];
  pubDate?: string;
  annualSalaryMin?: number;
  annualSalaryMax?: number;
  jobDescription?: string;
};

export class JobicyJobProvider implements JobProvider {
  name = "Jobicy";

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const results: NormalizedJob[] = [];

    for (const title of search.titles.slice(0, 2)) {
      try {
        const params = new URLSearchParams({
          count: "20",
          tag: title
        });
        const res = await fetch(
          `https://jobicy.com/api/v2/remote-jobs?${params}`,
          { signal: AbortSignal.timeout(12000) }
        );
        if (!res.ok) continue;

        const data = (await res.json()) as { jobs?: JobicyJob[] };
        const jobs = data.jobs || [];

        for (const job of jobs) {
          if (!job.jobTitle || !job.companyName) continue;
          results.push({
            externalId: `jobicy-${job.id}`,
            sourceName: this.name,
            sourceUrl: "https://jobicy.com",
            originalJobUrl: job.url,
            companyName: job.companyName,
            title: job.jobTitle,
            location: job.jobGeo || "Remote",
            workMode: WorkMode.REMOTE,
            employmentType: inferEmployment(job.jobType),
            salaryMin: job.annualSalaryMin || undefined,
            salaryMax: job.annualSalaryMax || undefined,
            description: stripHtml(job.jobDescription || ""),
            requiredSkills: job.jobTag || [],
            preferredSkills: [],
            postedDate: job.pubDate ? new Date(job.pubDate) : undefined,
            applyUrl: job.url
          });
        }
      } catch {
        // Skip on error
      }
    }

    return results;
  }
}

function inferEmployment(type?: string): EmploymentType {
  if (!type) return EmploymentType.FULL_TIME;
  const t = type.toLowerCase();
  if (t.includes("contract") || t.includes("freelance")) return EmploymentType.CONTRACT;
  if (t.includes("part")) return EmploymentType.PART_TIME;
  return EmploymentType.FULL_TIME;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
