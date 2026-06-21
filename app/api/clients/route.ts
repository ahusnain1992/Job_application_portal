import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role, WorkMode, EmploymentType } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

// Accepts https:// URLs or data: base64 uploads from FileUploadOrUrl component
const urlOrDataUrl = z.string().max(10_000_000).refine(
  (v) => v === "" || v.startsWith("data:") || v.startsWith("http://") || v.startsWith("https://"),
  { message: "Must be a URL or uploaded file" }
).optional().nullable().or(z.literal(""));

const ClientCreateSchema = z.object({
  clientName: z.string().min(1).max(200),
  currentJobTitle: z.string().min(1).max(200),
  targetJobTitles: z.string().min(1).max(1000),
  alternativeJobTitles: z.string().max(1000).optional(),
  mainSkills: z.string().min(1).max(2000),
  secondarySkills: z.string().max(2000).optional(),
  preferredLocations: z.string().max(1000).optional().default(""),
  preferredCountries: z.string().max(500).optional().default(""),
  preferredCities: z.string().max(500).optional().default(""),
  workModePreference: z.nativeEnum(WorkMode),
  employmentTypePreference: z.nativeEnum(EmploymentType),
  minimumSalary: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  maximumSalary: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  cvText: z.string().max(50000).optional().nullable(),
  resumeUrl: urlOrDataUrl,
  linkedinUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  applicationNotes: z.string().max(5000).optional().nullable(),
  keywordsInclude: z.string().max(2000).optional(),
  keywordsExclude: z.string().max(2000).optional(),
  industriesPreferred: z.string().max(1000).optional(),
  industriesToAvoid: z.string().max(1000).optional(),
  teamMemberId: z.string().cuid().optional().nullable().or(z.literal(""))
});

const ResumeCreateSchema = z.object({
  clientId: z.string().cuid(),
  resumeName: z.string().min(1).max(200),
  fileUrl: urlOrDataUrl,
  resumeText: z.string().max(50000).optional().nullable(),
  rewriteToolUrl: z.string().url().max(2000).optional().nullable().or(z.literal(""))
});

function list(value?: string | null) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const user = await requireRole(Role.ADMIN);
  const form = await request.formData();

  // Resume-only sub-action
  if (form.get("resumeOnly") === "true") {
    const parsed = ResumeCreateSchema.safeParse({
      clientId: form.get("clientId") || undefined,
      resumeName: form.get("resumeName") || undefined,
      fileUrl: form.get("fileUrl") || "",
      resumeText: form.get("resumeText") || null,
      rewriteToolUrl: form.get("rewriteToolUrl") || ""
    });

    if (!parsed.success) {
      return redirectTo("/resumes?error=invalid-resume");
    }

    const { clientId, resumeName, fileUrl, resumeText, rewriteToolUrl } = parsed.data;
    const client = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) {
      return redirectTo("/resumes?error=client-not-found");
    }

    await prisma.resume.create({
      data: {
        clientId,
        name: resumeName,
        fileUrl: fileUrl || null,
        resumeText: resumeText?.trim() || null,
        rewriteToolUrl: rewriteToolUrl || null
      }
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "RESUME_CREATED", entity: "ClientProfile", entityId: clientId }
    });
    return redirectTo("/resumes");
  }

  const parsed = ClientCreateSchema.safeParse({
    clientName: form.get("clientName") || undefined,
    currentJobTitle: form.get("currentJobTitle") || undefined,
    targetJobTitles: form.get("targetJobTitles") || undefined,
    alternativeJobTitles: form.get("alternativeJobTitles") || "",
    mainSkills: form.get("mainSkills") || undefined,
    secondarySkills: form.get("secondarySkills") || "",
    preferredLocations: form.get("preferredLocations") || "",
    preferredCountries: form.get("preferredCountries") || "",
    preferredCities: form.get("preferredCities") || "",
    workModePreference: form.get("workModePreference") || "FLEXIBLE",
    employmentTypePreference: form.get("employmentTypePreference") || "UNKNOWN",
    minimumSalary: form.get("minimumSalary") || null,
    maximumSalary: form.get("maximumSalary") || null,
    cvText: form.get("cvText") || null,
    resumeUrl: form.get("resumeUrl") || "",
    linkedinUrl: form.get("linkedinUrl") || "",
    applicationNotes: form.get("applicationNotes") || null,
    keywordsInclude: form.get("keywordsInclude") || "",
    keywordsExclude: form.get("keywordsExclude") || "",
    industriesPreferred: form.get("industriesPreferred") || "",
    industriesToAvoid: form.get("industriesToAvoid") || "",
    teamMemberId: form.get("teamMemberId") || ""
  });

  if (!parsed.success) {
    return redirectTo("/clients?error=invalid-client");
  }

  const data = parsed.data;

  if (data.teamMemberId) {
    const teamMember = await prisma.user.findFirst({
      where: { id: data.teamMemberId, role: Role.TEAM_MEMBER, active: true },
      select: { id: true }
    });
    if (!teamMember) {
      return redirectTo("/clients?error=invalid-team-member");
    }
  }

  const client = await prisma.clientProfile.create({
    data: {
      clientName: data.clientName,
      currentJobTitle: data.currentJobTitle,
      targetJobTitles: list(data.targetJobTitles),
      alternativeJobTitles: list(data.alternativeJobTitles),
      mainSkills: list(data.mainSkills),
      secondarySkills: list(data.secondarySkills),
      preferredLocations: list(data.preferredLocations),
      preferredCountries: list(data.preferredCountries),
      preferredCities: list(data.preferredCities),
      workModePreference: data.workModePreference,
      employmentTypePreference: data.employmentTypePreference,
      minimumSalary: data.minimumSalary || null,
      maximumSalary: data.maximumSalary || null,
      cvText: data.cvText || null,
      resumeUrl: data.resumeUrl || null,
      linkedinUrl: data.linkedinUrl || null,
      applicationNotes: data.applicationNotes || null,
      keywordsInclude: list(data.keywordsInclude),
      keywordsExclude: list(data.keywordsExclude),
      industriesPreferred: list(data.industriesPreferred),
      industriesToAvoid: list(data.industriesToAvoid)
    }
  });

  if (data.teamMemberId) {
    await prisma.clientAssignment.create({ data: { clientId: client.id, userId: data.teamMemberId } });
  }

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "CLIENT_CREATED", entity: "ClientProfile", entityId: client.id }
  });

  return redirectTo(`/clients/${client.id}`);
}
