import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/services/csv";

export async function GET() {
  await requireRole(Role.ADMIN);
  const applications = await prisma.application.findMany({
    include: { client: true, job: true, appliedBy: true, resume: true },
    orderBy: { updatedAt: "desc" }
  });

  const csv = toCsv(applications.map((application) => ({
    client: application.client.clientName,
    company: application.job.companyName,
    title: application.job.title,
    location: application.job.location,
    status: application.status,
    appliedBy: application.appliedBy?.name || "",
    appliedDate: application.appliedDateTime,
    resume: application.resume?.name || "",
    notes: application.notes || "",
    applyUrl: application.job.applyUrl || ""
  })));

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="applications.csv"`
    }
  });
}
