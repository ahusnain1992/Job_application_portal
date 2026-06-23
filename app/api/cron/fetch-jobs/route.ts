export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { EmploymentType, JobStatus, SourceType, WorkMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildProviders } from "@/lib/job-providers/registry";
import { NormalizedJob } from "@/lib/job-providers/types";
import { duplicateSignature } from "@/lib/services/duplicates";
import { scoreJobForClient } from "@/lib/services/matching";
import { analyzeResumeJobFit } from "@/lib/services/resume-match";
import { isJobRelevant as sharedIsJobRelevant, ClientForFilter } from "@/lib/job-filter";

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
    errors: [] as string[],
    providerStats: {} as Record<string, { fetched: number; error?: string }>
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
        postedWithinDays: 7,
        excludeKeywords: client.keywordsExclude
      };

      const allJobs: NormalizedJob[] = [];

      const providerResults = await Promise.allSettled(
        providers.map(async (provider) => {
          console.log(`[cron] Starting ${provider.name} for ${client.clientName}`);
          const jobs = await provider.fetchJobs(search);
          console.log(`[cron] ${provider.name}: ${jobs.length} jobs for ${client.clientName}`);
          return { provider, jobs };
        })
      );

      for (let i = 0; i < providerResults.length; i++) {
        const result = providerResults[i];
        const provider = providers[i];
        if (result.status === "fulfilled") {
          allJobs.push(...result.value.jobs);
          summary.jobsFetched += result.value.jobs.length;
          const prev = summary.providerStats[provider.name];
          summary.providerStats[provider.name] = { fetched: (prev?.fetched ?? 0) + result.value.jobs.length };
        } else {
          const msg = String(result.reason);
          summary.errors.push(`${provider.name}(${client.clientName}): ${msg}`);
          summary.providerStats[provider.name] = { fetched: summary.providerStats[provider.name]?.fetched ?? 0, error: msg };
          console.error(`[cron] ${provider.name} error:`, msg);
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


// Location + title filtering delegated to shared lib/job-filter.ts
function isJobRelevant(job: NormalizedJob, client: ClientForFilter): boolean {
  return sharedIsJobRelevant(job, client);
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
