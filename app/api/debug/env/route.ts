import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  // Admin-only: used to verify env vars and DB connectivity after a deploy
  await requireRole(Role.ADMIN);

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
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasApifyToken: !!process.env.APIFY_API_TOKEN,
    appUrl: process.env.APP_URL ?? null,
    db: { ok: dbOk, error: dbError },
    buildId: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 8) ?? "unknown",
    ts: new Date().toISOString()
  });
}
