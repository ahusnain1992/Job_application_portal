import { NextRequest, NextResponse } from "next/server";
import { Role, SourceType } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: NextRequest) {
  const user = await requireRole(Role.ADMIN);
  const form = await request.formData();
  let searchParams = {};
  const rawParams = String(form.get("searchParams") || "").trim();
  if (rawParams) {
    try {
      searchParams = JSON.parse(rawParams);
    } catch {
      searchParams = { raw: rawParams };
    }
  }

  const name = String(form.get("name") || "Job Source");
  const sourceData = {
    name,
    type: String(form.get("type") || "APIFY") as SourceType,
    actorId: String(form.get("actorId") || "") || null,
    apiTokenRef: String(form.get("apiTokenRef") || "") || null,
    schedule: String(form.get("schedule") || "MANUAL"),
    searchParams
  };

  const existing = await prisma.jobSource.findFirst({ where: { name } });
  const source = existing
    ? await prisma.jobSource.update({ where: { id: existing.id }, data: sourceData })
    : await prisma.jobSource.create({ data: sourceData });

  await prisma.auditLog.create({ data: { actorId: user.id, action: "JOB_SOURCE_CONFIGURED", entity: "JobSource", entityId: source.id } });
  return redirectTo("/settings");
}
