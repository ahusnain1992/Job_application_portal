import { EmploymentType, JobStatus, WorkMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildProviders } from "@/lib/job-providers/registry";
import { NormalizedJob } from "@/lib/job-providers/types";
import { duplicateSignature } from "@/lib/services/duplicates";
import { scoreJobForClient } from "@/lib/services/matching";
import { analyzeResumeJobFit } from "@/lib/services/resume-match";

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
  jobsFetched: number;
  jobsSaved: number;
  duplicatesSkipped: number;
  errors: string[];
};

export async function fetchJobsForClient(client: ClientWithResumes): Promise<FetchSummary> {
  const summary: FetchSummary = { jobsFetched: 0, jobsSaved: 0, duplicatesSkipped: 0, errors: [] };

  const providers = buildProviders();

  const search = {
    titles: [...client.targetJobTitles, ...client.alternativeJobTitles].slice(0, 4),
    locations: (client.preferredCities.length ? client.preferredCities : client.preferredLocations).slice(0, 3),
    countries: client.preferredCountries,
    remoteOnly: client.workModePreference === WorkMode.REMOTE,
    postedWithinDays: 3,
    excludeKeywords: client.keywordsExclude
  };

  const allJobs: NormalizedJob[] = [];
  for (const provider of providers) {
    try {
      console.log(`[fetch-jobs] Running provider: ${provider.name}`);
      const jobs = await provider.fetchJobs(search);
      console.log(`[fetch-jobs] ${provider.name} returned ${jobs.length} jobs`);
      allJobs.push(...jobs);
      summary.jobsFetched += jobs.length;
    } catch (err) {
      const msg = `${provider.name}: ${String(err)}`;
      console.error(`[fetch-jobs] Provider error — ${msg}`);
      summary.errors.push(msg);
    }
  }

  const relevantJobs = allJobs.filter((job) => isJobRelevant(job, client));
  summary.jobsFetched -= allJobs.length - relevantJobs.length;

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

// Country → location keywords used for matching job location strings
const COUNTRY_KEYWORDS: Record<string, string[]> = {
  "usa": ["united states", "usa", ", us", "u.s.", "america"],
  "united states": ["united states", "usa", ", us", "u.s.", "america"],
  "uk": ["united kingdom", "england", "london", "manchester", "birmingham", ", uk", "britain", "scotland", "wales"],
  "united kingdom": ["united kingdom", "england", "london", "manchester", ", uk", "britain", "scotland", "wales"],
  "canada": ["canada", "ontario", "toronto", "vancouver", "calgary", "british columbia", "montreal", "québec"],
  "australia": ["australia", "sydney", "melbourne", "brisbane", "perth", "canberra"],
  "germany": ["germany", "berlin", "munich", "frankfurt", "hamburg", "köln", "cologne", "düsseldorf"],
  "india": ["india", "bangalore", "mumbai", "hyderabad", "delhi", "pune", "chennai"],
};

function locationMatchesClient(jobLocation: string, client: ClientWithResumes): boolean {
  const loc = jobLocation.toLowerCase();
  const isRemoteLabel = loc.includes("remote") || loc.includes("worldwide") || loc.includes("anywhere");

  // "worldwide" / no-country remote is fine only if client also wants REMOTE and no country preference
  if (isRemoteLabel && client.preferredCountries.length === 0 && client.preferredCities.length === 0) {
    return true;
  }

  // City-level match (most specific — check first)
  const cities = client.preferredCities;
  if (cities.length > 0) {
    const cityHit = cities.some((city) =>
      city.toLowerCase().split(/[\s,]+/).filter((p) => p.length > 1).some((p) => loc.includes(p))
    );
    if (cityHit) return true;
  }

  // Country-level match
  const countries = client.preferredCountries;
  if (countries.length > 0) {
    const countryHit = countries.some((c) => {
      const keywords = COUNTRY_KEYWORDS[c.toLowerCase()] ?? [c.toLowerCase()];
      return keywords.some((kw) => loc.includes(kw));
    });
    if (countryHit) return true;
    // If the job says "remote" but client has specific country preferences, only allow it
    // when it explicitly says "remote" in the client's preferred country context.
    // Reject pure-worldwide remote for clients with country preferences (avoid Germany/India remote jobs).
    if (isRemoteLabel) return false;
    return false;
  }

  // Fall back to preferredLocations free-text
  if (client.preferredLocations.length > 0) {
    return client.preferredLocations.some((pref) => {
      const parts = pref.toLowerCase().split(/[\s,]+/).filter((p) => p.length > 1);
      return parts.some((p) => loc.includes(p));
    });
  }

  return false;
}

function isJobRelevant(job: NormalizedJob, client: ClientWithResumes): boolean {
  const allTitles = [...client.targetJobTitles, ...client.alternativeJobTitles];
  const jobTitleLower = job.title.toLowerCase();

  const titleMatch = allTitles.some((t) => {
    const words = t.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !["and", "the", "for", "with"].includes(w));
    return words.some((w) => jobTitleLower.includes(w));
  });
  if (!titleMatch) return false;

  // Client strictly wants remote — only keep remote/flexible jobs that also pass location check
  if (client.workModePreference === WorkMode.REMOTE) {
    const isRemoteMode = job.workMode === WorkMode.REMOTE || job.workMode === WorkMode.FLEXIBLE;
    const isRemoteLabel = job.location.toLowerCase().includes("remote") || job.location.toLowerCase().includes("worldwide");
    if (!isRemoteMode && !isRemoteLabel) return false;
  }

  return locationMatchesClient(job.location, client);
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
