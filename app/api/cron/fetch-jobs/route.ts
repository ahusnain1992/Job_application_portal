export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { EmploymentType, JobStatus, SourceType, WorkMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdzunaJobProvider } from "@/lib/job-providers/adzuna";
import { JSearchJobProvider } from "@/lib/job-providers/jsearch";
import { RemotiveJobProvider } from "@/lib/job-providers/remotive";
import { RemoteOKJobProvider } from "@/lib/job-providers/remoteok";
import { ArbeitnowJobProvider } from "@/lib/job-providers/arbeitnow";
import { JobicyJobProvider } from "@/lib/job-providers/jobicy";
import { TheMuseJobProvider } from "@/lib/job-providers/themuse";
import { HimalayasJobProvider } from "@/lib/job-providers/himalayas";
import { USAJobsProvider } from "@/lib/job-providers/usajobs";
import { FindWorkJobProvider } from "@/lib/job-providers/findwork";
import { ApifyJobProvider } from "@/lib/job-providers/apify";
import { LinkedInJobProvider } from "@/lib/job-providers/linkedin";
import { NormalizedJob } from "@/lib/job-providers/types";
import { duplicateSignature } from "@/lib/services/duplicates";
import { scoreJobForClient } from "@/lib/services/matching";
import { analyzeResumeJobFit } from "@/lib/services/resume-match";

// Protect cron endpoint: accept cron secret header OR admin session (UI button)
async function authorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Cron secret check (used by cron-job.org and Railway cron)
  if (cronSecret) {
    if (
      req.headers.get("x-cron-secret") === cronSecret ||
      req.headers.get("authorization") === `Bearer ${cronSecret}`
    ) return true;
  }

  // UI-triggered: allow admin session
  if (req.headers.get("x-triggered-from-ui") === "1") {
    const { getCurrentUser } = await import("@/lib/auth");
    const user = await getCurrentUser();
    if (user?.role === "ADMIN") return true;
  }

  // Dev fallback
  if (!cronSecret && process.env.NODE_ENV !== "production") return true;

  return false;
}

export async function GET(req: NextRequest) {
  if (!await authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = {
    clientsProcessed: 0,
    jobsFetched: 0,
    jobsSaved: 0,
    duplicatesSkipped: 0,
    errors: [] as string[]
  };

  try {
    const activeClients = await prisma.clientProfile.findMany({
      where: { status: "ACTIVE" },
      include: {
        resumes: {
          where: { active: true },
          select: { id: true, name: true, resumeText: true }
        }
      }
    });

    // Build providers from env
    const providers = buildProviders();

    for (const client of activeClients) {
      summary.clientsProcessed++;

      const search = {
        titles: [...client.targetJobTitles, ...client.alternativeJobTitles].slice(0, 4),
        // Use structured cities if available, fall back to legacy preferredLocations
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

      // Post-fetch relevance filter — remove jobs that don't match the client's
      // location preferences or job titles. Free providers (Arbeitnow, Jobicy etc.)
      // don't support server-side location filtering so we must do it here.
      const relevantJobs = allJobs.filter((job) => isJobRelevant(job, client));
      summary.jobsFetched = summary.jobsFetched - (allJobs.length - relevantJobs.length);

      // Upsert the source records
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

          // Check if this exact job was already seen for this client
          const existingJob = await prisma.job.findFirst({
            where: {
              clientId: client.id,
              OR: [
                { externalId: job.externalId ?? undefined },
                { duplicateGroup: { signature: sig } }
              ]
            }
          });

          if (existingJob) {
            summary.duplicatesSkipped++;
            continue;
          }

          // Upsert duplicate group
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

          // Score job against every active master resume, pick the best fit
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
            // Fall back to legacy cvText if no master resumes have text yet
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
          summary.errors.push(`Save job error: ${String(err)}`);
        }
      }

      // Update source lastRunAt
      await prisma.jobSource.updateMany({
        where: { name: { in: providers.map((p) => p.name) } },
        data: { lastRunAt: new Date() }
      });
    }
  } catch (err) {
    summary.errors.push(`Fatal: ${String(err)}`);
  }

  await prisma.auditLog.create({
    data: {
      action: "CRON_FETCH_JOBS",
      entity: "JobSource",
      metadata: summary
    }
  });

  return NextResponse.json({ ok: true, ...summary });
}

function buildProviders() {
  const providers = [];

  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    providers.push(
      new AdzunaJobProvider({
        appId: process.env.ADZUNA_APP_ID,
        appKey: process.env.ADZUNA_APP_KEY
      })
    );
  }

  if (process.env.JSEARCH_API_KEY) {
    providers.push(new JSearchJobProvider({ apiKey: process.env.JSEARCH_API_KEY }));
  }

  // Free providers — no API key required, always included
  providers.push(new RemotiveJobProvider());   // remote-only, unlimited
  providers.push(new RemoteOKJobProvider());   // remote tech jobs, unlimited
  providers.push(new ArbeitnowJobProvider());  // EU + remote, unlimited
  providers.push(new JobicyJobProvider());     // remote jobs, unlimited
  providers.push(new TheMuseJobProvider());    // tech companies, unlimited
  providers.push(new HimalayasJobProvider());  // remote tech, unlimited

  // Key-gated free providers
  if (process.env.USAJOBS_API_KEY) {
    providers.push(new USAJobsProvider());    // US government & federal jobs
  }
  if (process.env.FINDWORK_API_KEY) {
    providers.push(new FindWorkJobProvider()); // tech job board, free tier
  }

  // Apify-backed providers (requires APIFY_API_TOKEN)
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (apifyToken) {
    // LinkedIn: dedicated provider that filters out Easy Apply jobs
    // Employees will always land on the company's own career portal
    providers.push(new LinkedInJobProvider(apifyToken));

    // Indeed and Glassdoor via generic Apify actors
    providers.push(
      new ApifyJobProvider({ name: "Indeed", actorId: "misceres/indeed-scraper", token: apifyToken })
    );
    providers.push(
      new ApifyJobProvider({ name: "Glassdoor", actorId: "bebity/glassdoor-jobs-scraper", token: apifyToken })
    );
  }

  return providers;
}

type ClientForFilter = {
  targetJobTitles: string[];
  alternativeJobTitles: string[];
  preferredLocations: string[];
  preferredCountries: string[];
  preferredCities: string[];
  workModePreference: WorkMode;
};

function isJobRelevant(job: NormalizedJob, client: ClientForFilter): boolean {
  const allTitles = [...client.targetJobTitles, ...client.alternativeJobTitles];
  const jobTitleLower = job.title.toLowerCase();

  // Title must contain at least one significant word from the client's titles
  const titleMatch = allTitles.some((t) => {
    const words = t.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !["and", "the", "for", "with"].includes(w));
    return words.some((w) => jobTitleLower.includes(w));
  });
  if (!titleMatch) return false;

  // Remote-only clients: only accept remote/flexible/worldwide jobs
  if (client.workModePreference === WorkMode.REMOTE) {
    return job.workMode === WorkMode.REMOTE || job.workMode === WorkMode.FLEXIBLE ||
      job.location.toLowerCase().includes("remote") || job.location.toLowerCase().includes("worldwide");
  }

  // Remote/hybrid jobs are always acceptable regardless of location
  if (job.workMode === WorkMode.REMOTE || job.workMode === WorkMode.HYBRID) return true;
  if (job.location.toLowerCase().includes("remote")) return true;

  const jobLocationLower = job.location.toLowerCase();

  // Check against structured cities first (most specific)
  const cities = client.preferredCities.length ? client.preferredCities : [];
  if (cities.length > 0) {
    const cityMatch = cities.some((city) =>
      city.toLowerCase().split(/[\s,]+/).filter((p) => p.length > 1).some((p) => jobLocationLower.includes(p))
    );
    if (cityMatch) return true;
  }

  // Check against structured countries (broad match — ensures UK client doesn't see German jobs)
  const countries = client.preferredCountries.length ? client.preferredCountries : [];
  if (countries.length > 0) {
    const countryKeywords: Record<string, string[]> = {
      "usa": ["united states", "usa", ", us", "u.s."],
      "united states": ["united states", "usa", ", us"],
      "uk": ["united kingdom", "england", ", uk", "britain", "gb"],
      "united kingdom": ["united kingdom", "england", "britain", ", uk"],
      "canada": ["canada", ", ca", "ontario", "toronto", "vancouver", "calgary"],
      "australia": ["australia", "sydney", "melbourne", "brisbane"],
      "germany": ["germany", "deutschland", "berlin", "munich", "frankfurt"],
    };
    const countryMatch = countries.some((c) => {
      const keywords = countryKeywords[c.toLowerCase()] || [c.toLowerCase()];
      return keywords.some((kw) => jobLocationLower.includes(kw));
    });
    if (countryMatch) return true;
  }

  // Fall back to legacy preferredLocations if no structured fields set
  if (cities.length === 0 && countries.length === 0) {
    return client.preferredLocations.some((loc) => {
      const parts = loc.toLowerCase().split(/[\s,]+/).filter((p) => p.length > 1);
      return parts.some((p) => jobLocationLower.includes(p));
    });
  }

  return false;
}

async function ensureSources(names: string[]) {
  for (const name of names) {
    const type =
      name === "Adzuna" ? SourceType.APIFY
      : name === "JSearch" ? SourceType.SERPAPI
      : SourceType.MANUAL;

    await prisma.jobSource.upsert({
      where: { id: `auto-${name.toLowerCase()}` },
      update: { lastRunAt: new Date() },
      create: { id: `auto-${name.toLowerCase()}`, name, type, schedule: "DAILY" }
    });
  }
}
