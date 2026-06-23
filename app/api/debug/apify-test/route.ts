export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "No APIFY_API_TOKEN" });

  const actors = [
    { name: "LinkedIn", id: "bebity~linkedin-jobs-scraper", input: { searchUrl: "https://www.linkedin.com/jobs/search/?keywords=data+engineer&location=United+States", resultsLimit: 3, proxy: { useApifyProxy: true } } },
    { name: "Indeed", id: "misceres~indeed-scraper", input: { position: "Data Engineer", country: "US", location: "United States", maxItems: 3 } },
    { name: "Glassdoor", id: "bebity~glassdoor-jobs-scraper", input: { keyword: "Data Engineer", locationName: "United States", maxItems: 3 } },
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
      return { actor: actor.name, status: res.status, itemCount: Array.isArray(parsed) ? parsed.length : null, response: Array.isArray(parsed) ? parsed.slice(0, 1) : parsed };
    } catch (e) {
      return { actor: actor.name, error: String(e) };
    }
  }));

  return NextResponse.json({ results });
}
