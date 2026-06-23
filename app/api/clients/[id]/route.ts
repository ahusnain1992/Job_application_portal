import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EmploymentType, WorkMode } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { redirectTo } from "@/lib/redirect";

const optUrl = z.string().url().max(2000).optional().nullable().or(z.literal(""));

const UpdateSchema = z.object({
  clientName: z.string().min(1).max(200),
  currentJobTitle: z.string().min(1).max(200),
  targetJobTitles: z.string().min(1).max(1000),
  alternativeJobTitles: z.string().max(1000).optional(),
  mainSkills: z.string().min(1).max(2000),
  secondarySkills: z.string().max(2000).optional(),
  preferredLocations: z.string().max(1000).optional().default(""),
  workModePreference: z.nativeEnum(WorkMode),
  employmentTypePreference: z.nativeEnum(EmploymentType),
  minimumSalary: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  maximumSalary: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  cvText: z.string().max(50000).optional().nullable(),
  resumeUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  linkedinUrl: optUrl,
  portfolioUrl: optUrl,
  workAuthorizationNotes: z.string().max(1000).optional().nullable(),
  sponsorshipRequirement: z.string().max(500).optional().nullable(),
  industriesPreferred: z.string().max(1000).optional(),
  industriesToAvoid: z.string().max(1000).optional(),
  keywordsInclude: z.string().max(2000).optional(),
  keywordsExclude: z.string().max(2000).optional(),
  applicationNotes: z.string().max(5000).optional().nullable(),
  resumePdfLimit: z.coerce.number().int().min(1).max(500).optional(),
  // Personal info
  dateOfBirth: z.string().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  personalEmail: z.string().email().max(200).optional().nullable().or(z.literal("")),
  streetAddress: z.string().max(300).optional().nullable(),
  addressCity: z.string().max(100).optional().nullable(),
  addressState: z.string().max(100).optional().nullable(),
  addressZip: z.string().max(20).optional().nullable(),
  addressCountry: z.string().max(100).optional().nullable(),
  githubUrl: optUrl,
  // Education
  highestDegree: z.string().max(100).optional().nullable(),
  fieldOfStudy: z.string().max(200).optional().nullable(),
  university: z.string().max(200).optional().nullable(),
  graduationYear: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(1950).max(2100).nullable().optional()),
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

function splitLines(value?: string | null): string[] {
  if (!value) return [];
  return value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

function parseDate(value?: string | null): Date | null {
  if (!value || value.trim() === "") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await requireRole(Role.ADMIN);

  const client = await prisma.clientProfile.findUnique({ where: { id: params.id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(UpdateSchema.shape)) {
    const val = form.get(key);
    raw[key] = val !== null ? val : undefined;
  }

  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return redirectTo(`/clients/${params.id}/edit?error=${encodeURIComponent(msg)}`);
  }

  const d = parsed.data;

  await prisma.clientProfile.update({
    where: { id: params.id },
    data: {
      clientName: d.clientName,
      currentJobTitle: d.currentJobTitle,
      targetJobTitles: splitLines(d.targetJobTitles),
      alternativeJobTitles: splitLines(d.alternativeJobTitles),
      mainSkills: splitLines(d.mainSkills),
      secondarySkills: splitLines(d.secondarySkills),
      preferredLocations: splitLines(d.preferredLocations),
      workModePreference: d.workModePreference,
      employmentTypePreference: d.employmentTypePreference,
      minimumSalary: d.minimumSalary || null,
      maximumSalary: d.maximumSalary || null,
      cvText: d.cvText || null,
      resumeUrl: d.resumeUrl || null,
      linkedinUrl: d.linkedinUrl || null,
      portfolioUrl: d.portfolioUrl || null,
      workAuthorizationNotes: d.workAuthorizationNotes || null,
      sponsorshipRequirement: d.sponsorshipRequirement || null,
      industriesPreferred: splitLines(d.industriesPreferred),
      industriesToAvoid: splitLines(d.industriesToAvoid),
      keywordsInclude: splitLines(d.keywordsInclude),
      keywordsExclude: splitLines(d.keywordsExclude),
      applicationNotes: d.applicationNotes || null,
      resumePdfLimit: d.resumePdfLimit ?? 50,
      dateOfBirth: parseDate(d.dateOfBirth),
      phone: d.phone || null,
      personalEmail: d.personalEmail || null,
      streetAddress: d.streetAddress || null,
      addressCity: d.addressCity || null,
      addressState: d.addressState || null,
      addressZip: d.addressZip || null,
      addressCountry: d.addressCountry || null,
      githubUrl: d.githubUrl || null,
      highestDegree: d.highestDegree || null,
      fieldOfStudy: d.fieldOfStudy || null,
      university: d.university || null,
      graduationYear: d.graduationYear || null,
      gpa: d.gpa || null,
      noticePeriod: d.noticePeriod || null,
      availableFrom: parseDate(d.availableFrom),
      languages: splitLines(d.languages),
      genderEeo: d.genderEeo || null,
      ethnicityEeo: d.ethnicityEeo || null,
      veteranStatus: d.veteranStatus || null,
      disabilityStatus: d.disabilityStatus || null,
    }
  });

  return redirectTo(`/clients/${params.id}?updated=1`);
}
