import { NextResponse } from "next/server";
import { assignedClientIdsFor, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await requireUser();
  const assignedClientIds = await assignedClientIdsFor(user);
  const jobs = await prisma.job.findMany({
    where: assignedClientIds ? { clientId: { in: assignedClientIds } } : undefined,
    take: 100,
    orderBy: { discoveredAt: "desc" },
    include: { client: { select: { clientName: true } } }
  });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "JOBS_VIEWED_API", entity: "Job" } });
  return NextResponse.json({ jobs });
}
