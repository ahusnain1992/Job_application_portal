import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "@/lib/job-providers/types";

export class AdzunaJobProvider implements JobProvider {
  name = "Adzuna";
  private appId: string;
  private appKey: string;
  private country: string;

  constructor(options: { appId: string; appKey: string; country?: string }) {
    this.appId = options.appId;
    this.appKey = options.appKey;
    this.country = options.country || "us";
  }

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const results: NormalizedJob[] = [];

    // Resolve Adzuna country code from the client's preferred countries.
    // Falls back to constructor default (us) if not recognised.
    const countryCode = resolveAdzunaCountry(search.countries) || this.country;

    for (const title of search.titles.slice(0, 3)) {
      for (const location of (search.locations.length ? search.locations : [""]).slice(0, 2)) {
        try {
          const params = new URLSearchParams({
            app_id: this.appId,
            app_key: this.appKey,
            what: title,
            where: location,
            results_per_page: "20",
            sort_by: "date",
            "content-type": "application/json"
          });

          if (search.postedWithinDays) {
            const maxDaysOld = search.postedWithinDays;
            params.set("max_days_old", String(maxDaysOld));
          }

          const res = await fetch(
            `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?${params}`,
            { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) }
          );

          if (!res.ok) {
            console.error(`[adzuna] API error ${res.status} for "${title}" in "${location}": ${await res.text()}`);
            continue;
          }

          const data = (await res.json()) as { results?: AdzunaJob[] };
          const jobs = data.results || [];
          console.log(`[adzuna] "${title}" in "${location || "any"}" → ${jobs.length} results`);

          for (const job of jobs) {
            results.push(normalizeAdzuna(job, this.name));
          }
        } catch (err) {
          console.error(`[adzuna] Error fetching "${title}" in "${location}":`, err);
        }
      }
    }

    return results;
  }
}

type AdzunaJob = {
  id: string;
  title: string;
  company?: { display_name: string };
  location?: { display_name: string; area?: string[] };
  description?: string;
  salary_min?: number;
  salary_max?: number;
  contract_type?: string;
  redirect_url?: string;
  created?: string;
  category?: { label: string };
};

function normalizeAdzuna(job: AdzunaJob, sourceName: string): NormalizedJob {
  const location = job.location?.display_name || "Unknown";
  const workMode = inferWorkMode(location);

  return {
    externalId: `adzuna-${job.id}`,
    sourceName,
    sourceUrl: job.redirect_url,
    originalJobUrl: job.redirect_url,
    companyName: job.company?.display_name || "Unknown Company",
    title: job.title,
    location,
    workMode,
    employmentType: inferEmployment(job.contract_type),
    salaryMin: job.salary_min ? Math.round(job.salary_min) : undefined,
    salaryMax: job.salary_max ? Math.round(job.salary_max) : undefined,
    description: job.description || "",
    requiredSkills: [],
    preferredSkills: [],
    postedDate: job.created ? new Date(job.created) : undefined,
    applyUrl: job.redirect_url,
  };
}

function inferWorkMode(location: string): WorkMode {
  const l = location.toLowerCase();
  if (l.includes("remote")) return WorkMode.REMOTE;
  if (l.includes("hybrid")) return WorkMode.HYBRID;
  return WorkMode.FLEXIBLE;
}

function inferEmployment(value?: string): EmploymentType {
  if (!value) return EmploymentType.UNKNOWN;
  const v = value.toLowerCase();
  if (v.includes("contract")) return EmploymentType.CONTRACT;
  if (v.includes("part")) return EmploymentType.PART_TIME;
  if (v.includes("intern")) return EmploymentType.INTERNSHIP;
  return EmploymentType.FULL_TIME;
}

// Maps common country names → Adzuna 2-letter country codes
// Full list: https://api.adzuna.com/v1/api/jobs/{country_code}/search/
const ADZUNA_COUNTRY_MAP: Record<string, string> = {
  "usa": "us", "united states": "us", "us": "us", "america": "us",
  "uk": "gb", "united kingdom": "gb", "england": "gb", "britain": "gb", "gb": "gb",
  "canada": "ca", "ca": "ca",
  "australia": "au", "au": "au",
  "germany": "de", "deutschland": "de", "de": "de",
  "france": "fr", "fr": "fr",
  "netherlands": "nl", "nl": "nl", "holland": "nl",
  "india": "in", "in": "in",
  "singapore": "sg", "sg": "sg",
  "new zealand": "nz", "nz": "nz",
  "south africa": "za", "za": "za",
  "brazil": "br", "br": "br",
  "russia": "ru", "ru": "ru",
  "poland": "pl", "pl": "pl",
};

export function resolveAdzunaCountry(countries: string[]): string | null {
  for (const c of countries) {
    const code = ADZUNA_COUNTRY_MAP[c.toLowerCase().trim()];
    if (code) return code;
  }
  return null;
}
