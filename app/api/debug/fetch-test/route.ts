export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — Apify actors need up to 2 min each

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { buildProviders } from "@/lib/job-providers/registry";
import { isJobRelevant } from "@/lib/job-filter";
import { WorkMode, EmploymentType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    await requireRole(Role.ADMIN);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const titles: string[] = body.titles ?? ["Data Engineer", "Senior Data Engineer"];
  const countries: string[] = body.countries ?? ["United States"];
  const remoteOnly: boolean = body.remoteOnly ?? true;

  const search = {
    titles,
    locations: body.locations ?? [],
    countries,
    remoteOnly,
    postedWithinDays: body.postedWithinDays ?? 30,
    excludeKeywords: []
  };

  const mockClient = {
    targetJobTitles: titles,
    alternativeJobTitles: [],
    preferredLocations: [],
    preferredCountries: countries,
    preferredCities: [],
    workModePreference: remoteOnly ? WorkMode.REMOTE : WorkMode.FLEXIBLE,
  };

  const providers = buildProviders();
  const startTime = Date.now();

  const providerResults = await Promise.allSettled(
    providers.map(async (provider) => {
      const t0 = Date.now();
      const jobs = await provider.fetchJobs(search);
      const elapsed = Date.now() - t0;
      const relevant = jobs.filter((j) => j.applyUrl?.trim() && isJobRelevant(j, mockClient));
      return {
        provider: provider.name,
        fetched: jobs.length,
        withApplyUrl: jobs.filter((j) => j.applyUrl?.trim()).length,
        relevant: relevant.length,
        elapsedMs: elapsed,
        samples: relevant.slice(0, 3).map((j) => ({
          title: j.title,
          company: j.companyName,
          location: j.location,
          workMode: j.workMode,
          applyUrl: j.applyUrl
        }))
      };
    })
  );

  const results = providerResults.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { provider: providers[i].name, error: String(r.reason), fetched: 0, relevant: 0 };
  });

  return NextResponse.json({
    searchParams: search,
    totalElapsedMs: Date.now() - startTime,
    results
  });
}
