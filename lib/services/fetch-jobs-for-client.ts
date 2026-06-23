import { EmploymentType, JobStatus, WorkMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildProviders } from "@/lib/job-providers/registry";
import { NormalizedJob } from "@/lib/job-providers/types";
import { duplicateSignature } from "@/lib/services/duplicates";
import { scoreJobForClient } from "@/lib/services/matching";
import { analyzeResumeJobFit } from "@/lib/services/resume-match";
import { isJobRelevant as sharedIsJobRelevant } from "@/lib/job-filter";

type ClientWithResumes = {
  id: string;
  targetJobTitles: string[];
  alternativeJobTitles: string[];
  preferredLocations: string[];
  preferredCountries: string[];
  preferredCities: string[];
  workModePreference: WorkMode;
  employmentTypePreference: EmploymentType;
  minimumSalary: number | null;
  maximumSalary: number | null;
  keywordsExclude: string[];
  industriesToAvoid: string[];
  mainSkills: string[];
  secondarySkills: string[];
  industriesPreferred: string[];
  currentJobTitle: string;
  cvText: string | null;
  resumes: { id: string; name: string; resumeText: string | null }[];
};

export type FetchSummary = {
  jobsFetched: number;      // raw jobs from providers before filtering
  jobsSaved: number;        // actually written to DB
  duplicatesSkipped: number;
  noApplyLink: number;      // had no applyUrl — skipped
  filteredOut: number;      // failed isJobRelevant — wrong title/location
  search: { titles: string[]; locations: string[]; countries: string[]; remoteOnly: boolean; postedWithinDays: number };
  errors: string[];
  providerStats: Record<string, { fetched: number; error?: string }>;
};

export async function fetchJobsForClient(
  client: ClientWithResumes,
  options: { postedWithinDays?: number } = {}
): Promise<FetchSummary> {
  const summary: FetchSummary = {
    jobsFetched: 0,
    jobsSaved: 0,
    duplicatesSkipped: 0,
    noApplyLink: 0,
    filteredOut: 0,
    search: { titles: [], locations: [], countries: [], remoteOnly: false, postedWithinDays: options.postedWithinDays ?? 7 },
    errors: [],
    providerStats: {}
  };

  const providers = buildProviders();

  if (providers.length === 0) {
    summary.errors.push("No job providers are configured. Add Adzuna or Apify credentials in Railway environment variables.");
    return summary;
  }

  const search = {
    titles: buildSearchTitles(client),
    locations: (client.preferredCities.length ? client.preferredCities : client.preferredLocations).slice(0, 3),
    countries: client.preferredCountries,
    remoteOnly: client.workModePreference === WorkMode.REMOTE,
    postedWithinDays: options.postedWithinDays ?? 7,
    includeKeywords: [...client.mainSkills, ...client.secondarySkills].slice(0, 12),
    excludeKeywords: client.keywordsExclude
  };
  summary.search = {
    titles: search.titles,
    locations: search.locations,
    countries: search.countries,
    remoteOnly: search.remoteOnly,
    postedWithinDays: search.postedWithinDays
  };

  if (search.titles.length === 0) {
    summary.errors.push("Client needs at least one target title, alternative title, or skill before jobs can be fetched.");
    return summary;
  }

  // Run all providers in parallel — Adzuna (~5s) and Apify (~2-5min) run concurrently
  const providerResults = await Promise.allSettled(
    providers.map(async (provider) => {
      console.log(`[fetch-jobs] Starting provider: ${provider.name}`);
      const jobs = await provider.fetchJobs(search);
      console.log(`[fetch-jobs] ${provider.name} returned ${jobs.length} jobs`);
      return { provider, jobs };
    })
  );

  const allJobs: NormalizedJob[] = [];
  for (let i = 0; i < providerResults.length; i++) {
    const result = providerResults[i];
    const provider = providers[i];
    if (result.status === "fulfilled") {
      allJobs.push(...result.value.jobs);
      summary.jobsFetched += result.value.jobs.length;
      summary.providerStats[provider.name] = { fetched: result.value.jobs.length };
    } else {
      const msg = String(result.reason);
      console.error(`[fetch-jobs] Provider error — ${provider.name}: ${msg}`);
      summary.errors.push(`${provider.name}: ${msg}`);
      summary.providerStats[provider.name] = { fetched: 0, error: msg };
    }
  }

  // Filter: must match client preferences AND have an apply link
  const relevantJobs = allJobs.filter((job) => {
    if (!job.applyUrl?.trim()) { summary.noApplyLink++; return false; }
    if (!isJobRelevant(job, client)) { summary.filteredOut++; return false; }
    return true;
  });

  if (summary.jobsFetched === 0) {
    summary.errors.push("Providers returned 0 jobs for this search. Check provider keys and broaden the client's target titles/skills.");
  } else if (relevantJobs.length === 0) {
    summary.errors.push("Providers returned jobs, but none passed the apply-link, title, and location filters.");
  }

  await ensureSources(providers.map((p) => p.name));
  const sourceMap = Object.fromEntries(
    (await prisma.jobSource.findMany({ where: { name: { in: providers.map((p) => p.name) } } }))
      .map((s) => [s.name, s.id])
  );

  for (const job of relevantJobs) {
    try {
      const sig = duplicateSignature({
        companyName: job.companyName,
        title: job.title,
        location: job.location,
        applyUrl: job.applyUrl,
        externalId: job.externalId
      });

      const existingJob = await prisma.job.findFirst({
        where: {
          clientId: client.id,
          OR: [
            { externalId: job.externalId ?? undefined },
            { duplicateGroup: { signature: sig } }
          ]
        }
      });

      if (existingJob) { summary.duplicatesSkipped++; continue; }

      const dupGroup = await prisma.duplicateGroup.upsert({
        where: { signature: sig },
        update: {},
        create: { signature: sig }
      });

      const match = scoreJobForClient(
        {
          title: job.title,
          companyName: job.companyName,
          location: job.location,
          workMode: job.workMode ?? WorkMode.FLEXIBLE,
          employmentType: job.employmentType ?? EmploymentType.UNKNOWN,
          salaryMin: job.salaryMin ?? null,
          salaryMax: job.salaryMax ?? null,
          description: job.description,
          requiredSkills: job.requiredSkills,
          preferredSkills: job.preferredSkills,
          postedDate: job.postedDate ?? null
        },
        client
      );

      const resumeCandidates = client.resumes.filter((r) => r.resumeText?.trim());
      let bestResume: { id: string; name: string } | null = null;
      let resumeAnalysis = null;

      if (resumeCandidates.length > 0) {
        let bestScore = -1;
        for (const resume of resumeCandidates) {
          const analysis = analyzeResumeJobFit(
            resume.resumeText!,
            job.description,
            job.requiredSkills,
            job.title,
            client.currentJobTitle
          );
          if (analysis.coverageScore > bestScore) {
            bestScore = analysis.coverageScore;
            resumeAnalysis = analysis;
            bestResume = { id: resume.id, name: resume.name };
          }
        }
      } else if (client.cvText) {
        resumeAnalysis = analyzeResumeJobFit(
          client.cvText,
          job.description,
          job.requiredSkills,
          job.title,
          client.currentJobTitle
        );
      }

      await prisma.job.create({
        data: {
          externalId: job.externalId,
          sourceName: job.sourceName,
          sourceId: sourceMap[job.sourceName],
          sourceUrl: job.sourceUrl,
          originalJobUrl: job.originalJobUrl,
          companyName: job.companyName,
          title: job.title,
          location: job.location,
          workMode: job.workMode ?? WorkMode.FLEXIBLE,
          employmentType: job.employmentType ?? EmploymentType.UNKNOWN,
          salaryMin: job.salaryMin ?? null,
          salaryMax: job.salaryMax ?? null,
          description: job.description,
          requiredSkills: job.requiredSkills,
          preferredSkills: job.preferredSkills,
          postedDate: job.postedDate,
          applyUrl: job.applyUrl,
          companyCareerPageUrl: job.companyCareerPageUrl,
          atsPlatform: job.atsPlatform,
          duplicateGroupId: dupGroup.id,
          matchScore: match.score,
          matchExplanation: match.explanation,
          matchWarnings: match.warnings,
          resumeRecommendation: resumeAnalysis?.recommendation ?? null,
          resumeCoverageScore: resumeAnalysis?.coverageScore ?? null,
          missingKeywords: resumeAnalysis?.missingKeywords ?? [],
          coveredKeywords: resumeAnalysis?.coveredKeywords ?? [],
          bestResumeId: bestResume?.id ?? null,
          bestResumeName: bestResume?.name ?? null,
          resumeClusterId: resumeAnalysis?.clusterId ?? null,
          status: JobStatus.SUGGESTED,
          clientId: client.id
        }
      });

      summary.jobsSaved++;
    } catch (err) {
      summary.errors.push(`Save error: ${String(err)}`);
    }
  }

  await prisma.jobSource.updateMany({
    where: { name: { in: providers.map((p) => p.name) } },
    data: { lastRunAt: new Date() }
  });

  return summary;
}

function buildSearchTitles(client: ClientWithResumes): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  const add = (value: string) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    values.push(normalized);
  };

  [...client.targetJobTitles, ...client.alternativeJobTitles].forEach(add);
  [...client.mainSkills, ...client.secondarySkills]
    .filter((skill) => skill.trim().length >= 3)
    .slice(0, 4)
    .forEach(add);

  return values.slice(0, 8);
}

// Location filtering is handled by the shared lib/job-filter.ts module.
function isJobRelevant(job: NormalizedJob, client: ClientWithResumes): boolean {
  return sharedIsJobRelevant(job, client);
}

async function ensureSources(names: string[]) {
  const { SourceType } = await import("@prisma/client");
  for (const name of names) {
    const type = name === "Adzuna" ? SourceType.APIFY : name === "JSearch" ? SourceType.SERPAPI : SourceType.MANUAL;
    await prisma.jobSource.upsert({
      where: { id: `auto-${name.toLowerCase()}` },
      update: { lastRunAt: new Date() },
      create: { id: `auto-${name.toLowerCase()}`, name, type, schedule: "DAILY" }
    });
  }
}
