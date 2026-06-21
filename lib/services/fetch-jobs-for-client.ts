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
      const jobs = await provider.fetchJobs(search);
      allJobs.push(...jobs);
      summary.jobsFetched += jobs.length;
    } catch (err) {
      summary.errors.push(`${provider.name}: ${String(err)}`);
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

function isJobRelevant(job: NormalizedJob, client: ClientWithResumes): boolean {
  const allTitles = [...client.targetJobTitles, ...client.alternativeJobTitles];
  const jobTitleLower = job.title.toLowerCase();

  const titleMatch = allTitles.some((t) => {
    const words = t.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !["and", "the", "for", "with"].includes(w));
    return words.some((w) => jobTitleLower.includes(w));
  });
  if (!titleMatch) return false;

  if (client.workModePreference === WorkMode.REMOTE) {
    return job.workMode === WorkMode.REMOTE || job.workMode === WorkMode.FLEXIBLE ||
      job.location.toLowerCase().includes("remote") || job.location.toLowerCase().includes("worldwide");
  }

  if (job.workMode === WorkMode.REMOTE || job.workMode === WorkMode.HYBRID) return true;
  if (job.location.toLowerCase().includes("remote")) return true;

  const jobLocationLower = job.location.toLowerCase();
  const cities = client.preferredCities;

  if (cities.length > 0) {
    const cityMatch = cities.some((city) =>
      city.toLowerCase().split(/[\s,]+/).filter((p) => p.length > 1).some((p) => jobLocationLower.includes(p))
    );
    if (cityMatch) return true;
  }

  const countryKeywords: Record<string, string[]> = {
    "usa": ["united states", "usa", ", us", "u.s."],
    "united states": ["united states", "usa", ", us"],
    "uk": ["united kingdom", "england", ", uk", "britain"],
    "united kingdom": ["united kingdom", "england", "britain", ", uk"],
    "canada": ["canada", "ontario", "toronto", "vancouver", "calgary"],
    "australia": ["australia", "sydney", "melbourne", "brisbane"],
    "germany": ["germany", "berlin", "munich", "frankfurt"],
  };

  const countries = client.preferredCountries;
  if (countries.length > 0) {
    const countryMatch = countries.some((c) => {
      const keywords = countryKeywords[c.toLowerCase()] || [c.toLowerCase()];
      return keywords.some((kw) => jobLocationLower.includes(kw));
    });
    if (countryMatch) return true;
  }

  if (cities.length === 0 && countries.length === 0) {
    return client.preferredLocations.some((loc) => {
      const parts = loc.toLowerCase().split(/[\s,]+/).filter((p) => p.length > 1);
      return parts.some((p) => jobLocationLower.includes(p));
    });
  }

  return false;
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
