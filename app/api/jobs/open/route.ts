import { NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { canAccessClient, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await requireUser();

  let body: { jobId?: string };
  try {
    body = await request.json() as { jobId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { jobId } = body;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!(await canAccessClient(user, job.clientId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check if already applied
  const applied = await prisma.application.findFirst({
    where: { jobId, clientId: job.clientId, status: JobStatus.APPLIED },
    include: { appliedBy: { select: { name: true } } }
  });
  if (applied) {
    return NextResponse.json({
      blocked: true,
      reason: `Already applied by ${applied.appliedBy?.name || "a team member"}`
    });
  }

  // Check if another team member has an active IN_PROGRESS lock
  const now = new Date();
  if (
    job.status === JobStatus.IN_PROGRESS &&
    job.lockExpiresAt &&
    job.lockExpiresAt > now &&
    job.openedById !== user.id
  ) {
    const locker = job.openedById
      ? await prisma.user.findUnique({ where: { id: job.openedById }, select: { name: true } })
      : null;
    return NextResponse.json({
      blocked: false,
      warning: `${locker?.name || "Another team member"} opened this job ${Math.round((now.getTime() - (job.openedAt?.getTime() || now.getTime())) / 60000)} min ago. They may still be applying.`
    });
  }

  const lockExpiresAt = new Date(now.getTime() + 45 * 60 * 1000); // 45-minute lock

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.IN_PROGRESS,
        openedAt: job.openedAt ?? now,
        openedById: user.id,
        lockExpiresAt
      }
    });

    await tx.application.upsert({
      where: { clientId_jobId: { clientId: job.clientId, jobId } },
      update: { openedAt: job.openedAt ?? now },
      create: {
        clientId: job.clientId,
        jobId,
        status: JobStatus.IN_PROGRESS,
        assignedTeamMemberId: user.id,
        lastUpdatedById: user.id,
        openedAt: now
      }
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "JOB_LINK_OPENED",
        entity: "Job",
        entityId: jobId,
        metadata: { applyUrl: job.applyUrl }
      }
    });
  });

  return NextResponse.json({ ok: true, applyUrl: job.applyUrl });
}
