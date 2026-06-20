import { EmploymentType, WorkMode } from "@prisma/client";
import { JobProvider, JobProviderSearch, NormalizedJob } from "@/lib/job-providers/types";

export class ApifyJobProvider implements JobProvider {
  name: string;
  private actorId: string;
  private token: string;

  constructor(options: { name: string; actorId: string; token: string }) {
    this.name = options.name;
    this.actorId = options.actorId;
    this.token = options.token;
  }

  async fetchJobs(search: JobProviderSearch): Promise<NormalizedJob[]> {
    if (!this.token) {
      throw new Error("APIFY_API_TOKEN is required for Apify job discovery.");
    }

    const response = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(this.actorId)}/run-sync-get-dataset-items?token=${this.token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(search)
    });

    if (!response.ok) {
      throw new Error(`Apify actor failed with ${response.status}`);
    }

    const items = (await response.json()) as Array<Record<string, unknown>>;
    return items.map((item) => ({
      externalId: String(item.id || item.jobId || item.url || ""),
      sourceName: this.name,
      sourceUrl: String(item.sourceUrl || item.url || ""),
      originalJobUrl: String(item.url || item.jobUrl || ""),
      companyName: String(item.companyName || item.company || "Unknown Company"),
      title: String(item.title || item.jobTitle || "Untitled Job"),
      location: String(item.location || "Unknown"),
      workMode: inferWorkMode(String(item.location || item.workplaceType || "")),
      employmentType: inferEmployment(String(item.employmentType || item.jobType || "")),
      salaryMin: toNumber(item.salaryMin),
      salaryMax: toNumber(item.salaryMax),
      description: String(item.description || item.jobDescription || ""),
      requiredSkills: toStringArray(item.requiredSkills),
      preferredSkills: toStringArray(item.preferredSkills),
      postedDate: item.postedDate ? new Date(String(item.postedDate)) : undefined,
      applyUrl: String(item.applyUrl || item.url || ""),
      companyCareerPageUrl: item.companyCareerPageUrl ? String(item.companyCareerPageUrl) : undefined,
      atsPlatform: item.atsPlatform ? String(item.atsPlatform) : undefined
    }));
  }
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function inferWorkMode(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("remote")) return WorkMode.REMOTE;
  if (normalized.includes("hybrid")) return WorkMode.HYBRID;
  if (normalized.includes("onsite") || normalized.includes("on-site")) return WorkMode.ONSITE;
  return WorkMode.FLEXIBLE;
}

function inferEmployment(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("contract")) return EmploymentType.CONTRACT;
  if (normalized.includes("c2c")) return EmploymentType.C2C;
  if (normalized.includes("w2")) return EmploymentType.W2;
  if (normalized.includes("part")) return EmploymentType.PART_TIME;
  if (normalized.includes("intern")) return EmploymentType.INTERNSHIP;
  if (normalized.includes("full")) return EmploymentType.FULL_TIME;
  return EmploymentType.UNKNOWN;
}
