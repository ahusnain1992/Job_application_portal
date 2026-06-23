import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";
import { buildProviderTags } from "@/lib/job-providers/search-terms";

type RemoteOKJob = {
  id?: string;
  url?: string;
  position?: string;
  company?: string;
  location?: string;
  tags?: string[];
  date?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
};

export class RemoteOKJobProvider implements JobProvider {
  name = "RemoteOK";

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const results: NormalizedJob[] = [];

    const tags = buildProviderTags({ titles: search.titles, includeKeywords: search.includeKeywords, max: 5 });

    for (const title of tags) {
      try {
        const res = await fetch(
          `https://remoteok.com/api?tags=${encodeURIComponent(title)}`,
          {
            headers: { "User-Agent": "JobPortal/1.0 (job aggregator)" },
            signal: AbortSignal.timeout(12000)
          }
        );
        if (!res.ok) continue;

        const data = (await res.json()) as RemoteOKJob[];
        // First element is metadata, skip it
        const jobs = data.filter((j) => j.position && j.company);

        for (const job of jobs.slice(0, 15)) {
          results.push({
            externalId: `remoteok-${job.id}`,
            sourceName: this.name,
            sourceUrl: "https://remoteok.com",
            originalJobUrl: job.url,
            companyName: job.company || "Unknown",
            title: job.position || "",
            location: job.location || "Remote",
            workMode: WorkMode.REMOTE,
            employmentType: EmploymentType.FULL_TIME,
            salaryMin: job.salary_min || undefined,
            salaryMax: job.salary_max || undefined,
            description: stripHtml(job.description || ""),
            requiredSkills: job.tags || [],
            preferredSkills: [],
            postedDate: job.date ? new Date(job.date) : undefined,
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
