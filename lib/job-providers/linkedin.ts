import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type ValigLinkedInItem = {
  id?: number;
  url?: string;
  title?: string;
  companyName?: string;
  companyUrl?: string;
  location?: string;
  workType?: string;
  contractType?: string;
  postedDate?: string;
  salary?: string;
  description?: string;
  applyType?: string;  // "EASY_APPLY" | "EXTERNAL"
  experienceLevel?: string;
  sector?: string;
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
        const locationPart = search.locations?.[0] || search.countries?.[0] || "United States";
        const input: Record<string, unknown> = {
          keyword: title,
          location: locationPart,
          maxItems: 25,
          proxy: { useApifyProxy: true }
        };

        console.log(`[linkedin] Fetching: "${title}" in "${locationPart}"`);
        const res = await fetch(
          `https://api.apify.com/v2/acts/valig~linkedin-jobs-scraper/run-sync-get-dataset-items?token=${this.token}&timeout=90`,
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

        const items = (await res.json()) as ValigLinkedInItem[];

        for (const item of items) {
          if (!item.title || !item.companyName) continue;

          // Skip Easy Apply — we want jobs with external apply links only
          if (item.applyType === "EASY_APPLY") continue;

          const applyUrl = item.url || "";
          if (!applyUrl || applyUrl.includes("linkedin.com/jobs/view")) {
            // linkedin.com/jobs/view is the listing page, not an apply URL — skip
            // (EXTERNAL jobs should redirect to company site, but valig doesn't return direct apply URL)
            // Use the job URL as fallback — still better than nothing
          }
          if (!applyUrl) continue;

          results.push({
            externalId: `linkedin-${item.id || encodeURIComponent(item.url || title)}`,
            sourceName: this.name,
            sourceUrl: "https://www.linkedin.com/jobs",
            originalJobUrl: item.url,
            companyName: item.companyName,
            title: item.title,
            location: item.location || "Unknown",
            workMode: inferWorkMode(item.location || ""),
            employmentType: inferEmployment(item.contractType || ""),
            description: item.description || "",
            requiredSkills: [],
            preferredSkills: [],
            postedDate: item.postedDate ? new Date(item.postedDate) : undefined,
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

function inferWorkMode(location: string): WorkMode {
  const v = location.toLowerCase();
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
