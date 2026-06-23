import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/services/csv";

function dateRange(range: string | null): Date {
  const now = new Date();
  if (range === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (range === "quarter") {
    return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  }
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export async function GET(req: NextRequest) {
  await requireRole(Role.ADMIN);

  const { searchParams } = req.nextUrl;
  const clientId = searchParams.get("clientId");
  const memberId = searchParams.get("memberId");
  const range = searchParams.get("range");
  const status = searchParams.get("status");

  const since = dateRange(range);
  const where = {
    ...(clientId ? { clientId } : {}),
    ...(memberId ? { appliedById: memberId } : {}),
    ...(status ? { status: status as any } : {}),
    updatedAt: { gte: since },
  };

  const applications = await prisma.application.findMany({
    where,
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
