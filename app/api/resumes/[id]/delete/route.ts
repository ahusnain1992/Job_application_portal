import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRole(Role.ADMIN);

  const resume = await prisma.resume.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, clientId: true, _count: { select: { applications: true } } }
  });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (resume._count.applications > 0) {
    return NextResponse.json(
      { error: `This resume is linked to ${resume._count.applications} application(s) and cannot be deleted. Deactivate it instead.` },
      { status: 400 }
    );
  }

  await prisma.job.updateMany({
    where: { bestResumeId: resume.id },
    data: { bestResumeId: null, bestResumeName: null }
  });

  await prisma.resume.delete({ where: { id: params.id } });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "RESUME_DELETED", entity: "Resume", entityId: resume.id }
  });

  return NextResponse.json({ ok: true });
}
