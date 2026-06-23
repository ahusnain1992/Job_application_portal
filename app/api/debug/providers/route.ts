export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getProviderManifest } from "@/lib/job-providers/registry";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function GET(_req: NextRequest) {
  try {
    await requireRole(Role.ADMIN);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const manifest = getProviderManifest();
  const enabledCount = manifest.filter((p) => p.enabled).length;
  const hasPaid = manifest.some((p) => p.enabled && (p.type === "paid" || p.type === "apify"));

  const warnings: string[] = [];
  if (enabledCount === 0) {
    warnings.push("No providers are enabled. No jobs will be fetched.");
  } else if (!hasPaid) {
    warnings.push("Only free providers are active. Add ADZUNA_APP_ID/ADZUNA_APP_KEY or APIFY_API_TOKEN to Railway environment variables for better coverage.");
  }

  return NextResponse.json({
    providers: manifest,
    enabledCount,
    totalCount: manifest.length,
    warnings
  });
}
