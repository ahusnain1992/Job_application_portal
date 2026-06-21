import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    // db unreachable
  }

  const status = dbOk ? 200 : 503;
  return NextResponse.json({ ok: dbOk, ts: new Date().toISOString() }, { status });
}
