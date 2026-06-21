import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRole(Role.ADMIN);

  const client = await prisma.clientProfile.findUnique({
    where: { id: params.id },
    select: { id: true, clientName: true, status: true }
  });

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (client.status !== "INACTIVE") {
    return NextResponse.json(
      { error: "Only archived (inactive) clients can be permanently deleted. Archive the client first." },
      { status: 400 }
    );
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "CLIENT_DELETED",
      entity: "ClientProfile",
      entityId: client.id
    }
  });

  // Prisma cascade deletes all related records (jobs, applications, resumes, assignments)
  await prisma.clientProfile.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
