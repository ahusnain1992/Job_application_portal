import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireRole(Role.ADMIN);

  const client = await prisma.clientProfile.findUnique({
    where: { id: params.id },
    select: { id: true, clientName: true, status: true }
  });

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const newStatus = client.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  await prisma.clientProfile.update({
    where: { id: params.id },
    data: { status: newStatus }
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: newStatus === "INACTIVE" ? "CLIENT_ARCHIVED" : "CLIENT_REACTIVATED",
      entity: "ClientProfile",
      entityId: client.id,
      metadata: { clientName: client.clientName }
    }
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
