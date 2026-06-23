import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchJobsForClient } from "@/lib/services/fetch-jobs-for-client";

const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2-hour per-client cooldown (shorter than global 6h)

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireRole(Role.ADMIN);

  const client = await prisma.clientProfile.findUnique({
    where: { id: params.id },
    include: {
      resumes: { where: { active: true }, select: { id: true, name: true, resumeText: true } }
    }
  });

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (client.status !== "ACTIVE") return NextResponse.json({ error: "Client is not active" }, { status: 422 });

  // Per-client cooldown — check when jobs were last fetched for this client
  const lastJob = await prisma.job.findFirst({
    where: { clientId: client.id },
    orderBy: { discoveredAt: "desc" },
    select: { discoveredAt: true }
  });

  const isFirstFetch = !lastJob;

  if (lastJob) {
    const elapsed = Date.now() - lastJob.discoveredAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const minutesLeft = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      return NextResponse.json(
        { error: `Jobs were refreshed recently. Try again in ${minutesLeft} minutes.`, cooldown: true },
        { status: 429 }
      );
    }
  }

  // First fetch: look back 30 days so a new client gets a full backfill
  // Subsequent refreshes: look back 7 days to pick up recent postings
  const summary = await fetchJobsForClient(client, {
    postedWithinDays: isFirstFetch ? 30 : 7
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "CLIENT_JOBS_REFRESHED",
      entity: "ClientProfile",
      entityId: client.id,
      metadata: { clientName: client.clientName, ...summary }
    }
  });

  return NextResponse.json({ ok: true, clientName: client.clientName, ...summary });
}
