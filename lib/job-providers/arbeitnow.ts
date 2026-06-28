import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";
import { buildJobSearchQueries } from "@/lib/job-providers/search-terms";

type ArbeitnowJob = {
  slug?: string;
  url?: string;
  title?: string;
  company_name?: string;
  location?: string;
  remote?: boolean;
  tags?: string[];
  description?: string;
  created_at?: number;
  job_types?: string[];
  salary?: string;
};

export class ArbeitnowJobProvider implements JobProvider {
  name = "Arbeitnow";

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const results: NormalizedJob[] = [];

    const queries = buildJobSearchQueries({ titles: search.titles, includeKeywords: search.includeKeywords, max: 4 });

    for (const title of queries) {
      try {
        const params = new URLSearchParams({ q: title });
        const res = await fetch(
          `https://www.arbeitnow.com/api/job-board-api?${params}`,
          { signal: AbortSignal.timeout(12000) }
        );
        if (!res.ok) continue;

        const data = (await res.json()) as { data?: ArbeitnowJob[] };
        const jobs = data.data || [];

        for (const job of jobs.slice(0, 15)) {
          if (!job.title || !job.company_name) continue;

          // Arbeitnow ignores the q param and returns German general feed — filter by title
          const titleLow = job.title.toLowerCase();
          const domainMatch = search.titles.some((t) =>
            t.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => titleLow.includes(w))
          );
          if (!domainMatch) continue;

          const isRemote = job.remote || (job.location || "").toLowerCase().includes("remote");
          results.push({
            externalId: `arbeitnow-${job.slug}`,
            sourceName: this.name,
            sourceUrl: "https://www.arbeitnow.com",
            originalJobUrl: job.url,
            companyName: job.company_name,
            title: job.title,
            location: job.location || (isRemote ? "Remote" : "Unknown"),
            workMode: isRemote ? WorkMode.REMOTE : WorkMode.ONSITE,
            employmentType: inferEmployment(job.job_types),
            description: stripHtml(job.description || ""),
            requiredSkills: job.tags || [],
            preferredSkills: [],
            postedDate: job.created_at ? new Date(job.created_at * 1000) : undefined,
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

function inferEmployment(types?: string[]): EmploymentType {
  if (!types?.length) return EmploymentType.FULL_TIME;
  const t = types.join(" ").toLowerCase();
  if (t.includes("contract")) return EmploymentType.CONTRACT;
  if (t.includes("part")) return EmploymentType.PART_TIME;
  return EmploymentType.FULL_TIME;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
