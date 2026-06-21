import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type FindWorkJob = {
  id?: number;
  role?: string;
  company_name?: string;
  employment_type?: string;
  location?: string;
  remote?: boolean;
  date_posted?: string;
  url?: string;
  keywords?: string[];
  text?: string;
};

export class FindWorkJobProvider implements JobProvider {
  name = "FindWork";

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const apiKey = process.env.FINDWORK_API_KEY;
    if (!apiKey) return [];

    const results: NormalizedJob[] = [];

    for (const title of search.titles.slice(0, 2)) {
      try {
        const params = new URLSearchParams({ search: title, page: "1" });
        const res = await fetch(
          `https://findwork.dev/api/jobs/?${params}`,
          {
            headers: { Authorization: `Token ${apiKey}` },
            signal: AbortSignal.timeout(12000)
          }
        );
        if (!res.ok) continue;

        const data = (await res.json()) as { results?: FindWorkJob[] };
        const jobs = data.results || [];

        for (const job of jobs.slice(0, 15)) {
          if (!job.role || !job.company_name) continue;
          const isRemote = job.remote || (job.location || "").toLowerCase().includes("remote");
          results.push({
            externalId: `findwork-${job.id}`,
            sourceName: this.name,
            sourceUrl: "https://findwork.dev",
            originalJobUrl: job.url,
            companyName: job.company_name,
            title: job.role,
            location: job.location || (isRemote ? "Remote" : "Unknown"),
            workMode: isRemote ? WorkMode.REMOTE : WorkMode.ONSITE,
            employmentType: inferEmployment(job.employment_type),
            description: job.text || "",
            requiredSkills: job.keywords || [],
            preferredSkills: [],
            postedDate: job.date_posted ? new Date(job.date_posted) : undefined,
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
  if (t.includes("contract")) return EmploymentType.CONTRACT;
  if (t.includes("part")) return EmploymentType.PART_TIME;
  return EmploymentType.FULL_TIME;
}
