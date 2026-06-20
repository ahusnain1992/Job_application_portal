import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessClient, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCoverLetter } from "@/lib/services/cover-letter";

const Schema = z.object({ jobId: z.string().cuid() });

export async function POST(request: NextRequest) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({
    where: { id: parsed.data.jobId },
    include: {
      client: {
        select: {
          clientName: true,
          currentJobTitle: true,
          mainSkills: true,
          secondarySkills: true,
          workAuthorizationNotes: true,
          applicationNotes: true
        }
      }
    }
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!(await canAccessClient(user, job.clientId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const coverLetter = generateCoverLetter({
    clientName: job.client.clientName,
    currentJobTitle: job.client.currentJobTitle,
    mainSkills: job.client.mainSkills,
    secondarySkills: job.client.secondarySkills,
    workAuthorizationNotes: job.client.workAuthorizationNotes,
    applicationNotes: job.client.applicationNotes,
    jobTitle: job.title,
    companyName: job.companyName,
    jobDescription: job.description,
    requiredSkills: job.requiredSkills,
    coveredKeywords: job.coveredKeywords,
    missingKeywords: job.missingKeywords
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "COVER_LETTER_GENERATED",
      entity: "Job",
      entityId: job.id,
      metadata: { clientId: job.clientId, companyName: job.companyName, jobTitle: job.title }
    }
  });

  return NextResponse.json({ coverLetter });
}
