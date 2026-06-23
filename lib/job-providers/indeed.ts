import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type IndeedItem = {
  id?: string;
  url?: string;
  jobUrl?: string;
  positionName?: string;
  title?: string;
  company?: string;
  companyName?: string;
  location?: string;
  salary?: string;
  jobType?: string;
  description?: string;
  postedAt?: string;
  externalApplyLink?: string;
};

export class IndeedJobProvider implements JobProvider {
  name = "Indeed";
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
          position: title,
          country: resolveIndeedCountry(search.countries),
          location,
          maxItems: 25,
          parseCompanyDetails: false,
          saveOnlyUniqueItems: true,
          followApplyRedirects: false
        };

        console.log(`[indeed] Searching: ${title} in ${location}`);
        const res = await fetch(
          `https://api.apify.com/v2/acts/misceres~indeed-scraper/run-sync-get-dataset-items?token=${this.token}&timeout=300`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(360000)
          }
        );

        if (!res.ok) {
          console.error(`[indeed] Apify returned ${res.status}: ${await res.text()}`);
          continue;
        }

        const items = (await res.json()) as IndeedItem[];
        console.log(`[indeed] Got ${items.length} results for "${title}"`);

        for (const item of items) {
          const jobTitle = item.positionName || item.title || "";
          const company = item.company || item.companyName || "";
          if (!jobTitle || !company) continue;

          const applyUrl = item.externalApplyLink || item.url || item.jobUrl || "";

          results.push({
            externalId: `indeed-${item.id || encodeURIComponent(applyUrl || jobTitle + company)}`,
            sourceName: this.name,
            sourceUrl: "https://www.indeed.com",
            originalJobUrl: item.url || item.jobUrl,
            companyName: company,
            title: jobTitle,
            location: item.location || location,
            workMode: inferWorkMode(item.location || ""),
            employmentType: inferEmployment(item.jobType || ""),
            description: item.description || "",
            requiredSkills: [],
            preferredSkills: [],
            postedDate: item.postedAt ? new Date(item.postedAt) : undefined,
            applyUrl
          });
        }
      } catch (err) {
        console.error(`[indeed] Error for "${title}":`, err);
      }
    }

    return results;
  }
}

function resolveIndeedCountry(countries: string[]): string {
  const map: Record<string, string> = {
    usa: "us", "united states": "us",
    uk: "gb", "united kingdom": "gb",
    canada: "ca", australia: "au",
    germany: "de", france: "fr",
    india: "in", netherlands: "nl"
  };
  for (const c of countries) {
    const code = map[c.toLowerCase()];
    if (code) return code;
  }
  return "us";
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
