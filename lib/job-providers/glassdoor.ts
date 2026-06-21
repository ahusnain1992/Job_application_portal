import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type GlassdoorItem = {
  jobId?: string;
  jobTitle?: string;
  title?: string;
  employer?: { name?: string };
  companyName?: string;
  location?: string;
  jobType?: string;
  description?: string;
  applyUrl?: string;
  jobListingUrl?: string;
  url?: string;
  postedDate?: string;
};

export class GlassdoorJobProvider implements JobProvider {
  name = "Glassdoor";
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    if (!this.token) return [];

    const results: NormalizedJob[] = [];
    const location = search.locations?.[0] || search.countries?.[0] || "United States";

    for (const title of search.titles.slice(0, 2)) {
      try {
        const input = {
          keyword: title,
          locationName: location,
          maxItems: 25
        };

        console.log(`[glassdoor] Searching: ${title} in ${location}`);
        const res = await fetch(
          `https://api.apify.com/v2/acts/bebity~glassdoor-jobs-scraper/run-sync-get-dataset-items?token=${this.token}&timeout=90`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(120000)
          }
        );

        if (!res.ok) {
          console.error(`[glassdoor] Apify returned ${res.status}: ${await res.text()}`);
          continue;
        }

        const items = (await res.json()) as GlassdoorItem[];
        console.log(`[glassdoor] Got ${items.length} results for "${title}"`);

        for (const item of items) {
          const jobTitle = item.jobTitle || item.title || "";
          const company = item.employer?.name || item.companyName || "";
          if (!jobTitle || !company) continue;

          const applyUrl = item.applyUrl || item.jobListingUrl || item.url || "";

          results.push({
            externalId: `glassdoor-${item.jobId || encodeURIComponent(applyUrl || jobTitle + company)}`,
            sourceName: this.name,
            sourceUrl: "https://www.glassdoor.com",
            originalJobUrl: item.jobListingUrl || item.url,
            companyName: company,
            title: jobTitle,
            location: item.location || location,
            workMode: inferWorkMode(item.location || ""),
            employmentType: inferEmployment(item.jobType || ""),
            description: item.description || "",
            requiredSkills: [],
            preferredSkills: [],
            postedDate: item.postedDate ? new Date(item.postedDate) : undefined,
            applyUrl
          });
        }
      } catch (err) {
        console.error(`[glassdoor] Error for "${title}":`, err);
      }
    }

    return results;
  }
}

function inferWorkMode(location: string): WorkMode {
  const v = location.toLowerCase();
  if (v.includes("remote")) return WorkMode.REMOTE;
  if (v.includes("hybrid")) return WorkMode.HYBRID;
  return WorkMode.FLEXIBLE;
}

function inferEmployment(value: string): EmploymentType {
  const v = value.toLowerCase();
  if (v.includes("contract")) return EmploymentType.CONTRACT;
  if (v.includes("part")) return EmploymentType.PART_TIME;
  if (v.includes("intern")) return EmploymentType.INTERNSHIP;
  return EmploymentType.FULL_TIME;
}
