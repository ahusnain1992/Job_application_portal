import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type HimalayasJob = {
  id?: string;
  slug?: string;
  title?: string;
  companyName?: string;
  locationRestrictions?: string[];
  jobType?: string;
  description?: string;
  publishedAt?: string;
  salaryCurrency?: string;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
  url?: string;
  applyUrl?: string;
};

export class HimalayasJobProvider implements JobProvider {
  name = "Himalayas";

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const results: NormalizedJob[] = [];

    for (const title of search.titles.slice(0, 2)) {
      try {
        const params = new URLSearchParams({ q: title, limit: "20" });
        const res = await fetch(
          `https://himalayas.app/jobs/api?${params}`,
          { signal: AbortSignal.timeout(12000) }
        );
        if (!res.ok) continue;

        const data = (await res.json()) as { jobs?: HimalayasJob[] };
        const jobs = data.jobs || [];

        for (const job of jobs) {
          if (!job.title || !job.companyName) continue;

          const location = job.locationRestrictions?.join(", ") || "Remote";
          results.push({
            externalId: `himalayas-${job.id ?? job.slug}`,
            sourceName: this.name,
            sourceUrl: "https://himalayas.app",
            originalJobUrl: job.url,
            companyName: job.companyName,
            title: job.title,
            location,
            workMode: WorkMode.REMOTE,
            employmentType: inferEmployment(job.jobType),
            salaryMin: job.salaryMin || undefined,
            salaryMax: job.salaryMax || undefined,
            description: job.description || "",
            requiredSkills: job.skills || [],
            preferredSkills: [],
            postedDate: job.publishedAt ? new Date(job.publishedAt) : undefined,
            applyUrl: job.applyUrl || job.url
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
