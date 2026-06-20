import { z } from "zod";
import { JobStatus } from "@prisma/client";

export const ApplicationUpdateSchema = z.object({
  jobId: z.string().cuid(),
  clientId: z.string().cuid(),
  status: z.nativeEnum(JobStatus),
  notes: z.string().max(5000).optional().nullable(),
  resumeId: z.string().cuid().optional().nullable(),
  confirmationNumber: z.string().max(200).optional().nullable(),
  proofUrl: z.string().url().max(2000).optional().nullable().or(z.literal(""))
});

export const JobImportSchema = z.object({
  clientId: z.string().cuid(),
  title: z.string().min(1).max(200),
  companyName: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  applyUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  requiredSkills: z.string().max(1000).optional(),
  description: z.string().min(1).max(50000)
});

export const JobOpenSchema = z.object({
  jobId: z.string().cuid()
});

