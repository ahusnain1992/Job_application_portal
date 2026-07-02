export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "No APIFY_API_TOKEN" });

  const actors = [
    // Free actors (no monthly rental fee — pay compute only)
    {
      name: "LinkedIn-Free (valig) — sample fields",
      id: "valig~linkedin-jobs-scraper",
      input: { keyword: "data engineer", location: "United States", maxItems: 3, proxy: { useApifyProxy: true } }
    },
    {
      name: "LinkedIn-FantasticJobs (real filter test)",
      id: "fantastic-jobs~advanced-linkedin-job-search-api",
      input: {
        titleSearch: ["Data Engineer"],
        locationSearch: ["United States"],
        limit: 5,
        timeRange: "7d"
      }
    },
    // Paid actors (require rental)
    {
      name: "LinkedIn-Paid (bebity)",
      id: "bebity~linkedin-jobs-scraper",
      input: { title: "Data Engineer", location: "United States", rows: 3, proxy: { useApifyProxy: true } }
    },
    {
      name: "Glassdoor-Paid (bebity)",
      id: "bebity~glassdoor-jobs-scraper",
      input: { keyword: "Data Engineer", locationName: "United States", maxItems: 3 }
    },
    {
      name: "Indeed-Paid (misceres)",
      id: "misceres~indeed-scraper",
      input: { position: "Data Engineer", country: "US", location: "United States", maxItems: 3 }
    },
  ];

  const results = await Promise.all(actors.map(async (actor) => {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${actor.id}/run-sync-get-dataset-items?token=${token}&timeout=60`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(actor.input), signal: AbortSignal.timeout(90000) }
      );
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 500); }
      const items = Array.isArray(parsed) ? parsed : null;
      return {
        actor: actor.name,
        status: res.status,
        itemCount: items ? items.length : null,
        response: items ? items.slice(0, 1) : parsed
      };
    } catch (e) {
      return { actor: actor.name, error: String(e) };
    }
  }));

  return NextResponse.json({ results });
}
