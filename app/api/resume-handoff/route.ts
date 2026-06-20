import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, canAccessClient } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const Schema = z.object({ jobId: z.string().cuid() });

export async function POST(request: NextRequest) {
  const user = await requireUser();

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const { jobId } = parsed.data;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      client: { select: { clientName: true, cvText: true, applicationNotes: true, resumeUrl: true } }
    }
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!(await canAccessClient(user, job.clientId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = buildPayload(job);
  const payloadText = JSON.stringify(payload, null, 2);

  // Send to N8N webhook if configured
  const webhookUrl = process.env.N8N_RESUME_WEBHOOK_URL;
  let webhookSent = false;

  if (webhookUrl) {
    try {
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadText,
        signal: AbortSignal.timeout(8000)
      });
      webhookSent = webhookRes.ok;
    } catch {
      // Webhook failure is non-fatal — client still gets the clipboard payload
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "RESUME_HANDOFF",
      entity: "Job",
      entityId: jobId,
      metadata: { webhookSent, clientId: job.clientId }
    }
  });

  return NextResponse.json({ payload: payloadText, webhookSent });
}

function buildPayload(job: {
  title: string;
  companyName: string;
  location: string;
  description: string;
  applyUrl: string | null;
  missingKeywords: string[];
  resumeRecommendation: string | null;
  resumeCoverageScore: number | null;
  client: { clientName: string; cvText: string | null; resumeUrl: string | null; applicationNotes: string | null };
}) {
  return {
    task: "resume_rewrite",
    client_name: job.client.clientName,
    job_title: job.title,
    company: job.companyName,
    location: job.location,
    apply_url: job.applyUrl ?? "",
    recommendation: job.resumeRecommendation ?? "FULL_REWRITE",
    coverage_score: job.resumeCoverageScore ?? 0,
    missing_keywords: job.missingKeywords,
    instructions: buildInstructions(job.resumeRecommendation, job.missingKeywords),
    resume_text_or_link: job.client.cvText ?? job.client.resumeUrl ?? "(not provided)",
    application_notes: job.client.applicationNotes ?? "",
    job_description: job.description.slice(0, 4000)
  };
}

function buildInstructions(recommendation: string | null, missing: string[]): string {
  if (recommendation === "NEW_VERSION") {
    return `Create a new resume version targeting this specific role. The existing resume has low coverage. Focus on incorporating these missing keywords naturally: ${missing.join(", ")}.`;
  }
  if (recommendation === "FULL_REWRITE") {
    return `Rewrite the resume to better match this job. Incorporate the following missing keywords and skills: ${missing.join(", ")}. Keep the candidate's authentic experience but reframe it to align with the job requirements.`;
  }
  if (recommendation === "MINOR_TAILORING") {
    return `Make minor tailoring to the existing resume. Add or emphasize these keywords where relevant: ${missing.join(", ")}.`;
  }
  return `Review the resume against the job description. Current coverage is good but you may want to add: ${missing.join(", ")}.`;
}
