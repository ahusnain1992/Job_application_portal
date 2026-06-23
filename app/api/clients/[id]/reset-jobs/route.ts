import { NextRequest, NextResponse } from "next/server";
import { Role, JobStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Deletes all SUGGESTED jobs for a client so a fresh fetch can start clean.
// Only deletes SUGGESTED — jobs already APPROVED, ASSIGNED, APPLIED etc. are preserved.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireRole(Role.ADMIN);

  const client = await prisma.clientProfile.findUnique({
    where: { id: params.id },
    select: { id: true, clientName: true }
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { count } = await prisma.job.deleteMany({
    where: {
      clientId: client.id,
      status: JobStatus.SUGGESTED
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "CLIENT_JOBS_RESET",
      entity: "ClientProfile",
      entityId: client.id,
      metadata: { clientName: client.clientName, deletedCount: count }
    }
  });

  return NextResponse.json({ ok: true, deleted: count, clientName: client.clientName });
}
