import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";
import { buildJobSearchQueries } from "@/lib/job-providers/search-terms";

type HimalayasJob = {
  guid?: string;
  title?: string;
  companyName?: string;
  companySlug?: string;
  locationRestrictions?: string[];
  employmentType?: string;
  description?: string;
  pubDate?: string;
  minSalary?: number;
  maxSalary?: number;
  categories?: string[];
  applicationLink?: string;
};

export class HimalayasJobProvider implements JobProvider {
  name = "Himalayas";

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const results: NormalizedJob[] = [];

    const queries = buildJobSearchQueries({ titles: search.titles, includeKeywords: search.includeKeywords, max: 4 });

    for (const title of queries) {
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
          const applyUrl = job.applicationLink;
          if (!applyUrl) continue;

          // Himalayas q param searches tags/description, not title — filter by title here
          const titleLow = job.title.toLowerCase();
          const domainMatch = search.titles.some((t) =>
            t.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => titleLow.includes(w))
          );
          if (!domainMatch) continue;

          const location = job.locationRestrictions?.join(", ") || "Remote";
          results.push({
            externalId: `himalayas-${job.guid ?? job.companySlug}`,
            sourceName: this.name,
            sourceUrl: "https://himalayas.app",
            originalJobUrl: applyUrl,
            companyName: job.companyName,
            title: job.title,
            location,
            workMode: WorkMode.REMOTE,
            employmentType: inferEmployment(job.employmentType),
            salaryMin: job.minSalary || undefined,
            salaryMax: job.maxSalary || undefined,
            description: job.description || "",
            requiredSkills: job.categories || [],
            preferredSkills: [],
            postedDate: job.pubDate ? new Date(Number(job.pubDate) * 1000) : undefined,
            applyUrl
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
