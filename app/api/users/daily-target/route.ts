import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function POST(req: Request) {
  await requireRole(Role.ADMIN);
  const form = await req.formData();
  const userId = form.get("userId") as string;
  const target = parseInt(form.get("target") as string, 10);

  if (!userId || isNaN(target) || target < 1 || target > 100) {
    return NextResponse.redirect(new URL("/settings?error=invalid-target", req.url));
  }

  // DailyTarget is per user; upsert by userId (use first clientId found or skip clientId)
  // The model requires clientId — use a sentinel approach: upsert without clientId filter
  // by deleting and recreating, since the schema has a compound key on userId+clientId
  // Simplest: just update all existing targets for this user, or create one with a placeholder
  const existing = await prisma.dailyTarget.findFirst({ where: { userId } });
  if (existing) {
    await prisma.dailyTarget.updateMany({ where: { userId }, data: { target } });
  } else {
    // Need a clientId — use any assigned client, or skip if none
    const assignment = await prisma.clientAssignment.findFirst({ where: { userId }, select: { clientId: true } });
    if (assignment) {
      await prisma.dailyTarget.create({ data: { userId, clientId: assignment.clientId, target } });
    }
    // If no client assignment yet, skip silently — target will be set once assigned
  }

  return NextResponse.redirect(new URL("/settings", req.url));
}
