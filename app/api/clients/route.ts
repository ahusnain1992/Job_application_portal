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
  teamMemberId: z.string().cuid().optional().nullable().or(z.literal("")),
  // Personal info
  dateOfBirth: z.string().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  personalEmail: z.string().email().max(200).optional().nullable().or(z.literal("")),
  streetAddress: z.string().max(300).optional().nullable(),
  addressCity: z.string().max(100).optional().nullable(),
  addressState: z.string().max(100).optional().nullable(),
  addressZip: z.string().max(20).optional().nullable(),
  addressCountry: z.string().max(100).optional().nullable(),
  githubUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  // Education
  highestDegree: z.string().max(100).optional().nullable(),
  fieldOfStudy: z.string().max(200).optional().nullable(),
  university: z.string().max(200).optional().nullable(),
  graduationYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  gpa: z.string().max(20).optional().nullable(),
  // Work preferences
  noticePeriod: z.string().max(100).optional().nullable(),
  availableFrom: z.string().optional().nullable(),
  languages: z.string().max(500).optional(),
  // EEO
  genderEeo: z.string().max(100).optional().nullable(),
  ethnicityEeo: z.string().max(200).optional().nullable(),
  veteranStatus: z.string().max(100).optional().nullable(),
  disabilityStatus: z.string().max(100).optional().nullable(),
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

function parseDate(value?: string | null): Date | null {
  if (!value || String(value).trim() === "") return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
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
    teamMemberId: form.get("teamMemberId") || "",
    dateOfBirth: form.get("dateOfBirth") || null,
    phone: form.get("phone") || null,
    personalEmail: form.get("personalEmail") || null,
    streetAddress: form.get("streetAddress") || null,
    addressCity: form.get("addressCity") || null,
    addressState: form.get("addressState") || null,
    addressZip: form.get("addressZip") || null,
    addressCountry: form.get("addressCountry") || null,
    githubUrl: form.get("githubUrl") || "",
    highestDegree: form.get("highestDegree") || null,
    fieldOfStudy: form.get("fieldOfStudy") || null,
    university: form.get("university") || null,
    graduationYear: form.get("graduationYear") || null,
    gpa: form.get("gpa") || null,
    noticePeriod: form.get("noticePeriod") || null,
    availableFrom: form.get("availableFrom") || null,
    languages: form.get("languages") || "",
    genderEeo: form.get("genderEeo") || null,
    ethnicityEeo: form.get("ethnicityEeo") || null,
    veteranStatus: form.get("veteranStatus") || null,
    disabilityStatus: form.get("disabilityStatus") || null,
  });

  if (!parsed.success) {
    console.error("[/api/clients] Zod validation failed:", JSON.stringify(parsed.error.flatten()));
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

  let client: { id: string };
  try {
    client = await prisma.clientProfile.create({
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
        industriesToAvoid: list(data.industriesToAvoid),
        dateOfBirth: parseDate(data.dateOfBirth),
        phone: data.phone || null,
        personalEmail: data.personalEmail || null,
        streetAddress: data.streetAddress || null,
        addressCity: data.addressCity || null,
        addressState: data.addressState || null,
        addressZip: data.addressZip || null,
        addressCountry: data.addressCountry || null,
        githubUrl: data.githubUrl || null,
        highestDegree: data.highestDegree || null,
        fieldOfStudy: data.fieldOfStudy || null,
        university: data.university || null,
        graduationYear: data.graduationYear || null,
        gpa: data.gpa || null,
        noticePeriod: data.noticePeriod || null,
        availableFrom: parseDate(data.availableFrom),
        languages: list(data.languages),
        genderEeo: data.genderEeo || null,
        ethnicityEeo: data.ethnicityEeo || null,
        veteranStatus: data.veteranStatus || null,
        disabilityStatus: data.disabilityStatus || null,
      }
    });
  } catch (err) {
    console.error("[/api/clients] Prisma create failed:", err);
    return redirectTo("/clients?error=db-error");
  }

  if (data.teamMemberId) {
    await prisma.clientAssignment.create({ data: { clientId: client.id, userId: data.teamMemberId } });
  }

  // Create up to 3 resumes from the per-title resume sections
  for (let i = 0; i < 3; i++) {
    const title = (form.get(`resumeTitle_${i}`) as string | null)?.trim();
    const fileValue = (form.get(`resumeFile_${i}`) as string | null)?.trim();
    const resumeText = (form.get(`resumeText_${i}`) as string | null)?.trim();
    if (!title && !fileValue && !resumeText) continue;
    const labelledTitle = title || `Resume ${i + 1}`;
    await prisma.resume.create({
      data: {
        clientId: client.id,
        name: labelledTitle,
        fileUrl: fileValue && (fileValue.startsWith("data:") || fileValue.startsWith("http")) ? fileValue : null,
        resumeText: resumeText || null,
      }
    });
  }

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "CLIENT_CREATED", entity: "ClientProfile", entityId: client.id }
  });

  return redirectTo(`/clients/${client.id}`);
}
