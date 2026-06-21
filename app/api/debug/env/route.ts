import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Safe diagnostics endpoint — exposes only non-secret metadata.
 * Remove or restrict this route after confirming the deployment is healthy.
 */
export async function GET() {
  let dbOk = false;
  let dbError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasAppUrl: !!process.env.APP_URL,
    hasCronSecret: !!process.env.CRON_SECRET,
    appUrl: process.env.APP_URL ?? null,
    db: { ok: dbOk, error: dbError },
    buildId: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 8) ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "unknown",
    ts: new Date().toISOString()
  });
}
