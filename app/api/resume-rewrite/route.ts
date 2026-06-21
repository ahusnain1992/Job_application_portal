import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessClient, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rewriteResumeForJob } from "@/lib/services/resume-rewrite";

const Schema = z.object({ jobId: z.string().cuid() });

export async function POST(request: NextRequest) {
  const user = await requireUser();

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = await prisma.job.findUnique({
    where: { id: parsed.data.jobId },
    include: {
      client: {
        select: {
          clientName: true,
          currentJobTitle: true,
          cvText: true
        }
      }
    }
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!(await canAccessClient(user, job.clientId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!job.client.cvText?.trim()) {
    return NextResponse.json({ error: "No CV text found for this client. Please add the client's CV text first." }, { status: 422 });
  }

  try {
    const result = await rewriteResumeForJob({
      clientName: job.client.clientName,
      currentJobTitle: job.client.currentJobTitle,
      cvText: job.client.cvText,
      jobTitle: job.title,
      companyName: job.companyName,
      jobDescription: job.description,
      requiredSkills: job.requiredSkills,
      missingKeywords: job.missingKeywords,
      coveredKeywords: job.coveredKeywords
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "RESUME_REWRITE_GENERATED",
        entity: "Job",
        entityId: job.id,
        metadata: {
          clientId: job.clientId,
          jobTitle: job.title,
          companyName: job.companyName,
          tokensUsed: result.tokensUsed
        }
      }
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resume rewrite failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
