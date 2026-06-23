import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type MuseJob = {
  id?: number;
  short_name?: string;
  name?: string;
  refs?: { landing_page?: string };
  company?: { name?: string; short_name?: string };
  locations?: { name?: string }[];
  levels?: { name?: string; short_name?: string }[];
  categories?: { name?: string }[];
  tags?: { name?: string }[];
  contents?: string;
  publication_date?: string;
};

export class TheMuseJobProvider implements JobProvider {
  name = "TheMuse";

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const results: NormalizedJob[] = [];
    const queryParts = [...search.titles, ...(search.includeKeywords ?? [])]
      .flatMap((value) => value.toLowerCase().split(/\s+/))
      .filter((word) => word.length > 1);

    for (const page of [0, 1]) {
      try {
        const params = new URLSearchParams({
          page: String(page),
          descending: "true"
        });
        const res = await fetch(
          `https://www.themuse.com/api/public/jobs?${params}`,
          { signal: AbortSignal.timeout(12000) }
        );
        if (!res.ok) continue;

        const data = (await res.json()) as { results?: MuseJob[] };
        const jobs = data.results || [];

        for (const job of jobs.slice(0, 15)) {
          if (!job.name || !job.company?.name) continue;
          const haystack = `${job.name} ${job.contents || ""} ${job.tags?.map((t) => t.name).join(" ") || ""}`.toLowerCase();
          if (queryParts.length && !queryParts.some((word) => haystack.includes(word))) continue;

          const location = job.locations?.map((l) => l.name).join(", ") || "Unknown";
          const isRemote = location.toLowerCase().includes("remote") || location.toLowerCase().includes("flexible");

          results.push({
            externalId: `themuse-${job.id}`,
            sourceName: this.name,
            sourceUrl: "https://www.themuse.com",
            originalJobUrl: job.refs?.landing_page,
            companyName: job.company.name,
            title: job.name,
            location,
            workMode: isRemote ? WorkMode.REMOTE : WorkMode.ONSITE,
            employmentType: EmploymentType.FULL_TIME,
            description: stripHtml(job.contents || ""),
            requiredSkills: job.tags?.map((t) => t.name || "").filter(Boolean) || [],
            preferredSkills: [],
            postedDate: job.publication_date ? new Date(job.publication_date) : undefined,
            applyUrl: job.refs?.landing_page
          });
        }
      } catch {
        // Skip on error
      }
    }

    return results;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
