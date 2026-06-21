import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "./types";

type USAJob = {
  MatchedObjectId?: string;
  MatchedObjectDescriptor?: {
    PositionTitle?: string;
    PositionURI?: string;
    ApplyURI?: string[];
    PositionLocation?: { LocationName?: string }[];
    OrganizationName?: string;
    DepartmentName?: string;
    PublicationStartDate?: string;
    PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; RateIntervalCode?: string }[];
    PositionSchedule?: { Code?: string }[];
    UserArea?: { Details?: { JobSummary?: string; MajorDuties?: string[] } };
  };
};

export class USAJobsProvider implements JobProvider {
  name = "USAJobs";

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    const userAgent = process.env.USAJOBS_EMAIL || "jobportal@example.com";
    const apiKey = process.env.USAJOBS_API_KEY;
    if (!apiKey) return [];

    const results: NormalizedJob[] = [];

    for (const title of search.titles.slice(0, 2)) {
      try {
        const params = new URLSearchParams({
          Keyword: title,
          ResultsPerPage: "15",
          ...(search.locations?.[0] ? { LocationName: search.locations[0] } : {})
        });
        const res = await fetch(
          `https://data.usajobs.gov/api/search?${params}`,
          {
            headers: {
              "Authorization-Key": apiKey,
              "User-Agent": userAgent,
              Host: "data.usajobs.gov"
            },
            signal: AbortSignal.timeout(12000)
          }
        );
        if (!res.ok) continue;

        const data = (await res.json()) as { SearchResult?: { SearchResultItems?: USAJob[] } };
        const items = data.SearchResult?.SearchResultItems || [];

        for (const item of items) {
          const d = item.MatchedObjectDescriptor;
          if (!d?.PositionTitle) continue;

          const org = d.OrganizationName || d.DepartmentName || "US Government";
          const loc = d.PositionLocation?.map((l) => l.LocationName).join(", ") || "USA";
          const applyUrl = d.ApplyURI?.[0] || d.PositionURI;
          const rem = d.PositionRemuneration?.[0];
          const salaryMin = rem ? parseFloat(rem.MinimumRange || "0") || undefined : undefined;
          const salaryMax = rem ? parseFloat(rem.MaximumRange || "0") || undefined : undefined;
          const schedCode = d.PositionSchedule?.[0]?.Code;
          const desc = [d.UserArea?.Details?.JobSummary, ...(d.UserArea?.Details?.MajorDuties || [])].filter(Boolean).join("\n");

          results.push({
            externalId: `usajobs-${item.MatchedObjectId}`,
            sourceName: this.name,
            sourceUrl: "https://www.usajobs.gov",
            originalJobUrl: d.PositionURI,
            companyName: org,
            title: d.PositionTitle,
            location: loc,
            workMode: loc.toLowerCase().includes("remote") ? WorkMode.REMOTE : WorkMode.ONSITE,
            employmentType: schedCode === "2" ? EmploymentType.PART_TIME : EmploymentType.FULL_TIME,
            salaryMin,
            salaryMax,
            description: desc,
            requiredSkills: [],
            preferredSkills: [],
            postedDate: d.PublicationStartDate ? new Date(d.PublicationStartDate) : undefined,
            applyUrl
          });
        }
      } catch {
        // Skip on error
      }
    }

    return results;
  }
}
