import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EmploymentType, WorkMode } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { redirectTo } from "@/lib/redirect";

const UpdateSchema = z.object({
  clientName: z.string().min(1).max(200),
  currentJobTitle: z.string().min(1).max(200),
  targetJobTitles: z.string().min(1).max(1000),
  alternativeJobTitles: z.string().max(1000).optional(),
  mainSkills: z.string().min(1).max(2000),
  secondarySkills: z.string().max(2000).optional(),
  preferredLocations: z.string().min(1).max(1000),
  workModePreference: z.nativeEnum(WorkMode),
  employmentTypePreference: z.nativeEnum(EmploymentType),
  minimumSalary: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  maximumSalary: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  cvText: z.string().max(50000).optional().nullable(),
  resumeUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  linkedinUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  portfolioUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  workAuthorizationNotes: z.string().max(1000).optional().nullable(),
  sponsorshipRequirement: z.string().max(500).optional().nullable(),
  industriesPreferred: z.string().max(1000).optional(),
  industriesToAvoid: z.string().max(1000).optional(),
  keywordsInclude: z.string().max(2000).optional(),
  keywordsExclude: z.string().max(2000).optional(),
  applicationNotes: z.string().max(5000).optional().nullable(),
  resumePdfLimit: z.coerce.number().int().min(1).max(500).optional()
});

function splitLines(value?: string | null): string[] {
  if (!value) return [];
  return value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
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
      resumePdfLimit: d.resumePdfLimit ?? 50
    }
  });

  return redirectTo(`/clients/${params.id}?updated=1`);
}
