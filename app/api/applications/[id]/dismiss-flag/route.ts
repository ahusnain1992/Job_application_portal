import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireRole(Role.ADMIN);

  const app = await prisma.application.findUnique({
    where: { id: params.id },
    select: { id: true, flaggedFast: true }
  });

  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!app.flaggedFast) return NextResponse.json({ ok: true, message: "Not flagged" });

  await prisma.application.update({
    where: { id: params.id },
    data: {
      flagDismissed: true,
      flagDismissedById: user.id,
      flagDismissedAt: new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "FLAG_DISMISSED",
      entity: "Application",
      entityId: params.id
    }
  });

  return NextResponse.json({ ok: true });
}
