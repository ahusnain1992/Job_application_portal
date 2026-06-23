export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

const ACTORS = {
  linkedin:  "bebity~linkedin-jobs-scraper",
  indeed:    "misceres~indeed-scraper",
  glassdoor: "bebity~glassdoor-jobs-scraper",
};

export async function GET() {
  await requireRole(Role.ADMIN);

  const token = process.env.APIFY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_API_TOKEN not set" }, { status: 400 });

  const results: Record<string, unknown> = { tokenPrefix: token.slice(0, 8) + "…" };

  // 1. Check which actors exist / are accessible
  for (const [name, actorId] of Object.entries(ACTORS)) {
    try {
      const res = await fetch(`https://api.apify.com/v2/acts/${actorId}?token=${token}`, {
        signal: AbortSignal.timeout(10000),
      });
      const body = await res.json();
      results[`${name}_actor`] = {
        status: res.status,
        name: body?.data?.name ?? body?.error?.message ?? "unknown",
        ok: res.ok,
      };
    } catch (err) {
      results[`${name}_actor`] = { error: String(err) };
    }
  }

  // 2. Quick test run on Indeed (cheapest / fastest actor)
  try {
    const indeedInput = {
      position: "Data Engineer",
      country: "US",
      location: "United States",
      maxItems: 3,
      parseCompanyDetails: false,
      saveOnlyUniqueItems: true,
      followApplyRedirects: false,
    };
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTORS.indeed}/run-sync-get-dataset-items?token=${token}&timeout=60`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(indeedInput),
        signal: AbortSignal.timeout(75000),
      }
    );
    const runBody = runRes.ok ? await runRes.json() : await runRes.text();
    results["indeed_test_run"] = {
      status: runRes.status,
      ok: runRes.ok,
      itemCount: Array.isArray(runBody) ? runBody.length : null,
      preview: Array.isArray(runBody) ? runBody.slice(0, 2).map((j: Record<string, unknown>) => ({ title: j.positionName ?? j.title, company: j.company })) : runBody,
    };
  } catch (err) {
    results["indeed_test_run"] = { error: String(err) };
  }

  return NextResponse.json(results, { status: 200 });
}
