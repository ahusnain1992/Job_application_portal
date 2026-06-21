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
      where: { status: "ACTIVE" }
    });

    // Build providers from env
    const providers = buildProviders();

    for (const client of activeClients) {
      summary.clientsProcessed++;

      const search = {
        titles: [...client.targetJobTitles, ...client.alternativeJobTitles].slice(0, 4),
        locations: client.preferredLocations.slice(0, 3),
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

      // Upsert the source records
      await ensureSources(providers.map((p) => p.name));

      const sourceMap = Object.fromEntries(
        (await prisma.jobSource.findMany({ where: { name: { in: providers.map((p) => p.name) } } }))
          .map((s) => [s.name, s.id])
      );

      for (const job of allJobs) {
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

          const resumeAnalysis = client.cvText
            ? analyzeResumeJobFit(
                client.cvText,
                job.description,
                job.requiredSkills,
                job.title,
                client.currentJobTitle
              )
            : null;

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

  // Apify actors for LinkedIn, Indeed, Glassdoor (requires APIFY_API_TOKEN)
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (apifyToken) {
    providers.push(
      new ApifyJobProvider({ name: "LinkedIn", actorId: "bebity/linkedin-jobs-scraper", token: apifyToken })
    );
    providers.push(
      new ApifyJobProvider({ name: "Indeed", actorId: "misceres/indeed-scraper", token: apifyToken })
    );
    providers.push(
      new ApifyJobProvider({ name: "Glassdoor", actorId: "bebity/glassdoor-jobs-scraper", token: apifyToken })
    );
  }

  return providers;
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
