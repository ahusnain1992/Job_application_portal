import { EmploymentType, WorkMode } from "@prisma/client";

export type NormalizedJob = {
  externalId?: string;
  sourceName: string;
  sourceUrl?: string;
  originalJobUrl?: string;
  companyName: string;
  title: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  salaryMin?: number;
  salaryMax?: number;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  postedDate?: Date;
  applyUrl?: string;
  companyCareerPageUrl?: string;
  atsPlatform?: string;
};

export type JobProviderSearch = {
  titles: string[];
  locations: string[];
  countries: string[];   // e.g. ["USA", "United Kingdom"] — used to pick the right API endpoint
  remoteOnly?: boolean;
  postedWithinDays?: number;
  includeKeywords?: string[];
  excludeKeywords?: string[];
};

export interface JobProvider {
  name: string;
  fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]>;
}
