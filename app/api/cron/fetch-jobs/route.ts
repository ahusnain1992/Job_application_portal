export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildProviders } from "@/lib/job-providers/registry";
import { fetchJobsForClient, FetchSummary } from "@/lib/services/fetch-jobs-for-client";

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
    noApplyLink: 0,
    filteredOut: 0,
    errors: [] as string[],
    providerStats: {} as Record<string, { fetched: number; error?: string }>
  };

  // Early check: if no providers are configured, surface error immediately
  const providers = buildProviders();
  if (providers.length === 0) {
    summary.errors.push("No job providers are configured. Add Adzuna or Apify credentials in Railway environment variables.");
    await prisma.auditLog.create({
      data: { action: "CRON_FETCH_JOBS", entity: "JobSource", metadata: summary }
    });
    return NextResponse.json({ ok: false, ...summary });
  }

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

    for (const client of activeClients) {
      summary.clientsProcessed++;

      let clientSummary: FetchSummary;
      try {
        clientSummary = await fetchJobsForClient(client, { postedWithinDays: 7 });
      } catch (err) {
        summary.errors.push(`Client ${client.clientName ?? client.id}: ${String(err)}`);
        continue;
      }

      // Aggregate into cron summary
      summary.jobsFetched += clientSummary.jobsFetched;
      summary.jobsSaved += clientSummary.jobsSaved;
      summary.duplicatesSkipped += clientSummary.duplicatesSkipped;
      summary.noApplyLink += clientSummary.noApplyLink;
      summary.filteredOut += clientSummary.filteredOut;
      summary.errors.push(...clientSummary.errors.map((e) => `[${client.clientName ?? client.id}] ${e}`));

      // Merge provider stats
      for (const [providerName, stats] of Object.entries(clientSummary.providerStats)) {
        const prev = summary.providerStats[providerName];
        summary.providerStats[providerName] = {
          fetched: (prev?.fetched ?? 0) + stats.fetched,
          ...(stats.error ? { error: stats.error } : {})
        };
      }
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
