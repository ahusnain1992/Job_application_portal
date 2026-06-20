import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AssignSchema = z.object({
  userId: z.string().cuid(),
  action: z.enum(["add", "remove"])
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await requireRole(Role.ADMIN);

  const client = await prisma.clientProfile.findUnique({ where: { id: params.id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const parsed = AssignSchema.safeParse({ userId: form.get("userId"), action: form.get("action") });
  if (!parsed.success) {
    return NextResponse.redirect(new URL(`/clients/${params.id}?error=Invalid+request`, request.url), 303);
  }

  const { userId, action } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.redirect(new URL(`/clients/${params.id}?error=User+not+found`, request.url), 303);
  }

  if (action === "add") {
    await prisma.clientAssignment.upsert({
      where: { clientId_userId: { clientId: params.id, userId } },
      update: {},
      create: { clientId: params.id, userId }
    });
  } else {
    await prisma.clientAssignment.deleteMany({
      where: { clientId: params.id, userId }
    });
  }

  return NextResponse.redirect(new URL(`/clients/${params.id}?updated=1`, request.url), 303);
}
