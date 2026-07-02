import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type FantasticJobsItem = {
  id?: number;
  linkedin_id?: number;
  title?: string;
  organization?: string;
  organization_url?: string;
  url?: string;
  date_posted?: string;
  location_type?: string; // "TELECOMMUTE" | "ONSITE" | etc.
  locations_derived?: string[];
  countries_derived?: string[];
  employment_type?: string[]; // ["FULL_TIME"] | ["PART_TIME"] | ...
  ai_work_arrangement?: string; // "Remote OK" | "On-site" | "Hybrid"
  ai_salary_min_value?: number | null;
  ai_salary_max_value?: number | null;
  description_text?: string;
  ai_key_skills?: string[];
  direct_apply?: boolean; // true = external apply link, false = LinkedIn Easy Apply
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
          titleSearch: [title],
          locationSearch: [locationPart],
          limit: 25,
          timeRange: search.postedWithinDays && search.postedWithinDays <= 7 ? "7d" : "6m"
        };

        console.log(`[linkedin] Fetching: "${title}" in "${locationPart}"`);
        const res = await fetch(
          `https://api.apify.com/v2/acts/fantastic-jobs~advanced-linkedin-job-search-api/run-sync-get-dataset-items?token=${this.token}&timeout=90`,
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

        const items = (await res.json()) as FantasticJobsItem[];

        for (const item of items) {
          if (!item.title || !item.organization) continue;

          // Skip LinkedIn Easy Apply — we want jobs candidates apply to externally.
          if (item.direct_apply === false) continue;

          const applyUrl = item.url || "";
          if (!applyUrl) continue;

          const location = item.locations_derived?.[0] || item.countries_derived?.[0] || "Unknown";

          results.push({
            externalId: `linkedin-${item.linkedin_id || item.id || encodeURIComponent(applyUrl)}`,
            sourceName: this.name,
            sourceUrl: "https://www.linkedin.com/jobs",
            originalJobUrl: item.url,
            companyName: item.organization,
            title: item.title,
            location,
            workMode: inferWorkMode(item.location_type, item.ai_work_arrangement, location),
            employmentType: inferEmployment(item.employment_type),
            salaryMin: item.ai_salary_min_value ?? undefined,
            salaryMax: item.ai_salary_max_value ?? undefined,
            description: item.description_text || "",
            requiredSkills: item.ai_key_skills || [],
            preferredSkills: [],
            postedDate: item.date_posted ? new Date(item.date_posted) : undefined,
            applyUrl,
            companyCareerPageUrl: item.organization_url
          });
        }
      } catch (err) {
        console.error(`[linkedin] Error for "${title}":`, err);
      }
    }

    return results;
  }
}

function inferWorkMode(locationType?: string, aiArrangement?: string, location?: string): WorkMode {
  const v = `${locationType || ""} ${aiArrangement || ""} ${location || ""}`.toLowerCase();
  if (v.includes("telecommute") || v.includes("remote")) return WorkMode.REMOTE;
  if (v.includes("hybrid")) return WorkMode.HYBRID;
  if (v.includes("on-site") || v.includes("onsite")) return WorkMode.ONSITE;
  return WorkMode.FLEXIBLE;
}

function inferEmployment(types?: string[]): EmploymentType {
  const v = (types || []).join(" ").toLowerCase();
  if (v.includes("contract")) return EmploymentType.CONTRACT;
  if (v.includes("part")) return EmploymentType.PART_TIME;
  if (v.includes("intern")) return EmploymentType.INTERNSHIP;
  return EmploymentType.FULL_TIME;
}
