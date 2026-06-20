import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { JobStatus, Prisma } from "@prisma/client";
import { requireUser, canAccessClient } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  jobId: z.string().cuid(),
  clientId: z.string().cuid(),
  status: z.nativeEnum(JobStatus),
  notes: z.string().max(5000).optional().nullable(),
  resumeId: z.string().cuid().optional().nullable(),
  confirmationNumber: z.string().max(200).optional().nullable(),
  proofUrl: z.union([z.string().url().max(2000), z.literal("")]).optional().nullable(),
  reasonSkipped: z.string().max(500).optional().nullable(),
  coverLetterUsed: z.string().max(10000).optional().nullable()
});

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const form = await request.formData();

  const raw = {
    jobId: form.get("jobId") || undefined,
    clientId: form.get("clientId") || undefined,
    status: form.get("status") || undefined,
    notes: form.get("notes") || null,
    resumeId: form.get("resumeId") || null,
    confirmationNumber: form.get("confirmationNumber") || null,
    proofUrl: form.get("proofUrl") || null,
    reasonSkipped: form.get("reasonSkipped") || null,
    coverLetterUsed: form.get("coverLetterUsed") || null
  };

  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return NextResponse.redirect(new URL(`/jobs?error=${encodeURIComponent(msg)}`, request.url), 303);
  }

  const { jobId, clientId, status, notes, resumeId, confirmationNumber, proofUrl, reasonSkipped, coverLetterUsed } = parsed.data;

  // Authorization: team members can only touch their assigned clients
  const hasAccess = await canAccessClient(user, clientId);
  if (!hasAccess) {
    return NextResponse.redirect(new URL("/team", request.url), 303);
  }

  // Validate that the job belongs to the stated client
  const job = await prisma.job.findFirst({ where: { id: jobId, clientId } });
  if (!job) {
    return NextResponse.redirect(new URL(`/jobs?error=invalid-job`, request.url), 303);
  }

  // Validate that resumeId (if provided) belongs to the same client
  if (resumeId) {
    const resume = await prisma.resume.findFirst({ where: { id: resumeId, clientId } });
    if (!resume) {
      return NextResponse.redirect(new URL(`/jobs/${jobId}?error=invalid-resume`, request.url), 303);
    }
  }

  const existingApp = await prisma.application.findFirst({ where: { clientId, jobId } });

  const now = new Date();
  const isApplied = status === JobStatus.APPLIED;
  const isSkipped = status === JobStatus.SKIPPED || status === JobStatus.NOT_RELEVANT || status === JobStatus.ERROR_COULD_NOT_APPLY;
  const cleanConfirmation = confirmationNumber?.trim() || null;
  const cleanProofUrl = proofUrl?.trim() || null;
  const cleanReasonSkipped = reasonSkipped?.trim() || null;
  const cleanNotes = notes?.trim() || null;
  const cleanCoverLetter = coverLetterUsed?.trim() || null;

  if (isApplied && !cleanConfirmation && !cleanProofUrl && !existingApp?.verifiedByGmail) {
    return NextResponse.redirect(new URL(`/jobs/${jobId}?error=proof-required`, request.url), 303);
  }

  if (isSkipped && !cleanReasonSkipped) {
    return NextResponse.redirect(new URL(`/jobs/${jobId}?error=skip-reason-required`, request.url), 303);
  }

  let timeSpentMinutes: number | null = null;
  let flaggedFast = false;

  if (isApplied && existingApp?.openedAt) {
    timeSpentMinutes = Math.round((now.getTime() - existingApp.openedAt.getTime()) / 60000);
    flaggedFast = timeSpentMinutes < 3;
  }

  const resume = resumeId ? await prisma.resume.findUnique({ where: { id: resumeId } }) : null;

  let duplicateApplied = false;

  try {
    await prisma.$transaction(async (tx) => {
    const currentApp = await tx.application.findUnique({
      where: { clientId_jobId: { clientId, jobId } },
      select: { status: true, appliedById: true }
    });

    if (
      currentApp?.status === JobStatus.APPLIED &&
      currentApp.appliedById &&
      currentApp.appliedById !== user.id
    ) {
      duplicateApplied = true;
      return;
    }

    const app = await tx.application.upsert({
      where: { clientId_jobId: { clientId, jobId } },
      update: {
        status,
        notes: cleanNotes,
        resumeId: resumeId || null,
        confirmationNumber: cleanConfirmation,
        proofUrl: cleanProofUrl,
        reasonSkipped: cleanReasonSkipped,
        coverLetterUsed: cleanCoverLetter,
        appliedById: isApplied ? user.id : undefined,
        appliedDateTime: isApplied ? now : undefined,
        lastUpdatedById: user.id,
        ...(isApplied && timeSpentMinutes !== null ? { timeSpentMinutes, flaggedFast } : {})
      },
      create: {
        clientId,
        jobId,
        status,
        notes: cleanNotes,
        resumeId: resumeId || null,
        confirmationNumber: cleanConfirmation,
        proofUrl: cleanProofUrl,
        reasonSkipped: cleanReasonSkipped,
        coverLetterUsed: cleanCoverLetter,
        assignedTeamMemberId: user.id,
        appliedById: isApplied ? user.id : null,
        appliedDateTime: isApplied ? now : null,
        lastUpdatedById: user.id,
        ...(isApplied && timeSpentMinutes !== null ? { timeSpentMinutes, flaggedFast } : {})
      }
    });

    await tx.job.update({
      where: { id: jobId },
      data: {
        status,
        appliedById: isApplied ? user.id : undefined,
        appliedDate: isApplied ? now : undefined,
        resumeVersionUsed: resume?.name,
        notesText: cleanNotes || undefined
      }
    });

    await tx.applicationStatusHistory.create({
      data: { applicationId: app.id, status, changedById: user.id, note: cleanNotes }
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "APPLICATION_UPDATED",
        entity: "Application",
        entityId: app.id,
        metadata: {
          status,
          timeSpentMinutes,
          flaggedFast,
          hasProof: !!cleanProofUrl,
          hasConfirmation: !!cleanConfirmation,
          hasCoverLetter: !!cleanCoverLetter,
          reasonSkipped: cleanReasonSkipped
        }
      }
    });

    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.redirect(new URL(`/jobs/${jobId}?duplicateApplied=1`, request.url), 303);
    }
    throw error;
  }

  if (duplicateApplied) {
    return NextResponse.redirect(new URL(`/jobs/${jobId}?duplicateApplied=1`, request.url), 303);
  }

  return NextResponse.redirect(new URL(`/jobs/${jobId}`, request.url), 303);
}
