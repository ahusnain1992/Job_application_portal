import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type GlassdoorItem = {
  job_id?: string;
  job_title?: string;
  job_url?: string;
  job_location?: { unknown?: string; city?: string; country?: string };
  job_description?: string;
  job_remote?: boolean;
  job_posted_date?: string;
  job_salary?: string;
  job_type?: string;
  employer?: { name?: string };
  company?: string;
  companyName?: string;
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
          const jobTitle = item.job_title || "";
          const company = item.employer?.name || item.company || item.companyName || "Unknown Company";
          if (!jobTitle) continue;

          const applyUrl = item.job_url || "";
          if (!applyUrl) continue;

          const locationStr = item.job_location?.unknown ||
            [item.job_location?.city, item.job_location?.country].filter(Boolean).join(", ") ||
            location;

          const workMode = item.job_remote
            ? WorkMode.REMOTE
            : inferWorkMode(locationStr);

          results.push({
            externalId: `glassdoor-${item.job_id || encodeURIComponent(jobTitle + company)}`,
            sourceName: this.name,
            sourceUrl: "https://www.glassdoor.com",
            originalJobUrl: item.job_url,
            companyName: company,
            title: jobTitle,
            location: locationStr,
            workMode,
            employmentType: inferEmployment(item.job_type || ""),
            description: item.job_description || "",
            requiredSkills: [],
            preferredSkills: [],
            postedDate: item.job_posted_date ? new Date(item.job_posted_date) : undefined,
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
