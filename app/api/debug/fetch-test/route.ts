export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { buildProviders } from "@/lib/job-providers/registry";
import { isJobRelevant } from "@/lib/job-filter";
import { WorkMode } from "@prisma/client";

export async function POST(req: NextRequest) {
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

  // Also test Apify token directly
  const apifyToken = process.env.APIFY_API_TOKEN;
  let apifyTokenStatus = "not set";
  if (apifyToken) {
    try {
      const r = await fetch(`https://api.apify.com/v2/users/me?token=${apifyToken}`, { signal: AbortSignal.timeout(10000) });
      const d = await r.json() as { username?: string; plan?: { id?: string } };
      apifyTokenStatus = r.ok ? `valid (user: ${d.username}, plan: ${d.plan?.id})` : `error ${r.status}`;
    } catch (e) {
      apifyTokenStatus = `fetch failed: ${String(e)}`;
    }
  }

  const providers = buildProviders();
  const startTime = Date.now();

  const providerResults = await Promise.allSettled(
    providers.map(async (provider) => {
      const t0 = Date.now();
      const jobs = await provider.fetchJobs(search);
      const elapsed = Date.now() - t0;
      const withLink = jobs.filter((j) => j.applyUrl?.trim());
      const relevant = withLink.filter((j) => isJobRelevant(j, mockClient));
      const allSamples = jobs.slice(0, 2).map((j) => ({
        title: j.title, company: j.companyName, location: j.location,
        workMode: j.workMode, hasApplyUrl: !!j.applyUrl
      }));
      return {
        provider: provider.name,
        fetched: jobs.length,
        withApplyUrl: withLink.length,
        relevant: relevant.length,
        elapsedMs: elapsed,
        rawSamples: allSamples,
        relevantSamples: relevant.slice(0, 3).map((j) => ({
          title: j.title, company: j.companyName, location: j.location,
          workMode: j.workMode, applyUrl: j.applyUrl
        }))
      };
    })
  );

  const results = providerResults.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { provider: providers[i].name, error: String(r.reason), fetched: 0, relevant: 0 };
  });

  return NextResponse.json({
    apifyTokenStatus,
    adzunaConfigured: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    searchParams: search,
    totalElapsedMs: Date.now() - startTime,
    results
  });
}
