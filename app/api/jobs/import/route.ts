import { NextRequest, NextResponse } from "next/server";
import { EmploymentType, JobStatus, SourceType, WorkMode } from "@prisma/client";
import { canAccessClient, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { duplicateSignature } from "@/lib/services/duplicates";
import { scoreJobForClient } from "@/lib/services/matching";
import { analyzeResumeJobFit } from "@/lib/services/resume-match";
import { JobImportSchema } from "@/lib/validation";
import { redirectTo } from "@/lib/redirect";

function list(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const form = await request.formData();
  const parsed = JobImportSchema.safeParse({
    clientId: form.get("clientId") || undefined,
    title: form.get("title") || undefined,
    companyName: form.get("companyName") || undefined,
    location: form.get("location") || undefined,
    applyUrl: form.get("applyUrl") || "",
    requiredSkills: form.get("requiredSkills") || "",
    description: form.get("description") || undefined
  });

  if (!parsed.success) {
    return redirectTo("/jobs?error=invalid-import");
  }

  const data = parsed.data;
  const clientId = data.clientId;

  if (!(await canAccessClient(user, clientId))) {
    return redirectTo("/jobs?error=unauthorized");
  }

  const client = await prisma.clientProfile.findUnique({ where: { id: clientId } });
  if (!client) return redirectTo("/jobs?error=client");

  const source = await prisma.jobSource.upsert({
    where: { id: "manual-import-source" },
    update: {},
    create: { id: "manual-import-source", name: "Manual Import", type: SourceType.MANUAL, schedule: "MANUAL" }
  });

  const jobInput = {
    sourceName: source.name,
    companyName: data.companyName,
    title: data.title,
    location: data.location,
    workMode: WorkMode.FLEXIBLE,
    employmentType: EmploymentType.UNKNOWN,
    salaryMin: null as null,
    salaryMax: null as null,
    description: data.description,
    requiredSkills: list(data.requiredSkills || ""),
    preferredSkills: [] as string[],
    postedDate: new Date(),
    applyUrl: data.applyUrl || null
  };

  const match = scoreJobForClient(jobInput, client);

  const resumeAnalysis = client.cvText
    ? analyzeResumeJobFit(
        client.cvText,
        jobInput.description,
        jobInput.requiredSkills,
        jobInput.title,
        client.currentJobTitle
      )
    : null;

  const signature = duplicateSignature(jobInput);
  const duplicateGroup = await prisma.duplicateGroup.upsert({
    where: { signature },
    update: {},
    create: { signature }
  });
  const existingInGroup = await prisma.job.count({ where: { duplicateGroupId: duplicateGroup.id, clientId } });

  const job = await prisma.job.create({
    data: {
      ...jobInput,
      status: existingInGroup ? JobStatus.DUPLICATE : JobStatus.SUGGESTED,
      sourceId: source.id,
      clientId,
      duplicateGroupId: duplicateGroup.id,
      matchScore: match.score,
      matchExplanation: match.explanation,
      matchWarnings: match.warnings,
      resumeRecommendation: resumeAnalysis?.recommendation ?? null,
      resumeCoverageScore: resumeAnalysis?.coverageScore ?? null,
      missingKeywords: resumeAnalysis?.missingKeywords ?? [],
      coveredKeywords: resumeAnalysis?.coveredKeywords ?? [],
      resumeClusterId: resumeAnalysis?.clusterId ?? null
    }
  });

  await prisma.auditLog.create({ data: { actorId: user.id, action: "JOB_IMPORTED", entity: "Job", entityId: job.id } });
  return redirectTo(`/jobs/${job.id}`);
}
