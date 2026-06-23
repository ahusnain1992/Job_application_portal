import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type LinkedInItem = {
  id?: string;
  jobUrl?: string;
  title?: string;
  companyName?: string;
  location?: string;
  workplaceType?: string;
  employmentType?: string;
  postedAt?: string;
  salary?: string;
  description?: string;
  skills?: string[];
  applyUrl?: string;
  easyApply?: boolean;
  companyUrl?: string;
};

export class LinkedInJobProvider implements JobProvider {
  name = "LinkedIn";
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    if (!this.token) return [];

    const results: NormalizedJob[] = [];

    for (const title of search.titles.slice(0, 2)) {
      try {
        const locationPart = search.remoteOnly
          ? "Remote"
          : (search.locations?.[0] || search.countries?.[0] || "United States");
        // Use structured input (current actor API format)
        const input: Record<string, unknown> = {
          title,
          location: locationPart,
          rows: 25,
          proxy: { useApifyProxy: true }
        };

        console.log(`[linkedin] Fetching: "${title}" in "${locationPart}"`);
        const res = await fetch(
          `https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items?token=${this.token}&timeout=90`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(120000)
          }
        );
        if (!res.ok) {
          console.error(`[linkedin] Apify returned ${res.status}: ${await res.text()}`);
          continue;
        }

        const items = (await res.json()) as LinkedInItem[];

        for (const item of items) {
          if (!item.title || !item.companyName) continue;

          // Skip Easy Apply — employees must go to the company portal directly
          if (item.easyApply === true) continue;

          // Also skip if applyUrl points back to LinkedIn (another sign of Easy Apply)
          const applyUrl = item.applyUrl || item.jobUrl || "";
          if (applyUrl.includes("linkedin.com/jobs/apply")) continue;

          results.push({
            externalId: `linkedin-${item.id || encodeURIComponent(item.jobUrl || title)}`,
            sourceName: this.name,
            sourceUrl: "https://www.linkedin.com/jobs",
            originalJobUrl: item.jobUrl,
            companyName: item.companyName,
            title: item.title,
            location: item.location || "Unknown",
            workMode: inferWorkMode(item.workplaceType || item.location || ""),
            employmentType: inferEmployment(item.employmentType || ""),
            description: item.description || "",
            requiredSkills: item.skills || [],
            preferredSkills: [],
            postedDate: item.postedAt ? new Date(item.postedAt) : undefined,
            applyUrl,
            companyCareerPageUrl: item.companyUrl
          });
        }
      } catch (err) {
        console.error(`[linkedin] Error for "${title}":`, err);
      }
    }

    return results;
  }
}

function inferWorkMode(value: string): WorkMode {
  const v = value.toLowerCase();
  if (v.includes("remote")) return WorkMode.REMOTE;
  if (v.includes("hybrid")) return WorkMode.HYBRID;
  if (v.includes("on-site") || v.includes("onsite")) return WorkMode.ONSITE;
  return WorkMode.FLEXIBLE;
}

function inferEmployment(value: string): EmploymentType {
  const v = value.toLowerCase();
  if (v.includes("contract")) return EmploymentType.CONTRACT;
  if (v.includes("part")) return EmploymentType.PART_TIME;
  if (v.includes("intern")) return EmploymentType.INTERNSHIP;
  return EmploymentType.FULL_TIME;
}
