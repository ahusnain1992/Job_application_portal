import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "@/lib/job-providers/types";
import { buildJobSearchQueries } from "@/lib/job-providers/search-terms";

export class JSearchJobProvider implements JobProvider {
  name = "JSearch";
  private apiKey: string;

  constructor(options: { apiKey: string }) {
    this.apiKey = options.apiKey;
  }

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const results: NormalizedJob[] = [];
    const searchLocations = search.locations.length ? search.locations : (search.countries.length ? search.countries : [""]);
    const queries = buildJobSearchQueries({ titles: search.titles, includeKeywords: search.includeKeywords, max: 5 });

    for (const title of queries) {
      for (const location of searchLocations.slice(0, 2)) {
        try {
          const query = search.remoteOnly
            ? `${title} remote ${location}`.trim()
            : `${title} in ${location}`.trim();
          const datePosted = search.postedWithinDays
            ? search.postedWithinDays <= 1 ? "today"
            : search.postedWithinDays <= 3 ? "3days"
            : search.postedWithinDays <= 7 ? "week"
            : "month"
            : "week";

          const params = new URLSearchParams({
            query,
            num_pages: "1",
            date_posted: datePosted,
            employment_types: "FULLTIME,CONTRACTOR"
          });

          const res = await fetch(
            `https://jsearch.p.rapidapi.com/search?${params}`,
            {
              headers: {
                "X-RapidAPI-Key": this.apiKey,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
              },
              signal: AbortSignal.timeout(15000)
            }
          );

          if (!res.ok) continue;

          const data = (await res.json()) as { data?: JSearchJob[] };
          const jobs = data.data || [];

          for (const job of jobs) {
            results.push(normalizeJSearch(job, this.name));
          }
        } catch {
          // Skip failed queries, continue with others
        }
      }
    }

    return results;
  }
}

type JSearchJob = {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_website?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_description?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_employment_type?: string;
  job_apply_link?: string;
  job_apply_is_direct?: boolean;
  job_posted_at_datetime_utc?: string;
  job_required_skills?: string[];
  job_highlights?: { Qualifications?: string[]; Responsibilities?: string[] };
  employer_company_type?: string;
};

function normalizeJSearch(job: JSearchJob, sourceName: string): NormalizedJob {
  const location = [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") || "Unknown";
  const workMode = job.job_is_remote ? WorkMode.REMOTE : inferWorkMode(job.job_title + " " + location);

  const qualifications = job.job_highlights?.Qualifications || [];
  const skills = [
    ...(job.job_required_skills || []),
    ...qualifications.slice(0, 5)
  ];

  return {
    externalId: `jsearch-${job.job_id}`,
    sourceName,
    sourceUrl: job.job_apply_link,
    originalJobUrl: job.job_apply_link,
    companyName: job.employer_name || "Unknown Company",
    title: job.job_title,
    location,
    workMode,
    employmentType: inferEmployment(job.job_employment_type),
    salaryMin: job.job_min_salary ? Math.round(job.job_min_salary) : undefined,
    salaryMax: job.job_max_salary ? Math.round(job.job_max_salary) : undefined,
    description: job.job_description || "",
    requiredSkills: skills.slice(0, 10),
    preferredSkills: [],
    postedDate: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : undefined,
    applyUrl: job.job_apply_link,
    companyCareerPageUrl: job.employer_website,
  };
}

function inferWorkMode(text: string): WorkMode {
  const t = text.toLowerCase();
  if (t.includes("remote")) return WorkMode.REMOTE;
  if (t.includes("hybrid")) return WorkMode.HYBRID;
  return WorkMode.ONSITE;
}

function inferEmployment(value?: string): EmploymentType {
  if (!value) return EmploymentType.UNKNOWN;
  const v = value.toLowerCase();
  if (v.includes("contract") || v.includes("contractor")) return EmploymentType.CONTRACT;
  if (v.includes("part")) return EmploymentType.PART_TIME;
  if (v.includes("intern")) return EmploymentType.INTERNSHIP;
  if (v.includes("full")) return EmploymentType.FULL_TIME;
  return EmploymentType.UNKNOWN;
}
