import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200)
});

const UserActionSchema = z.object({
  userId: z.string().cuid()
});

export async function POST(request: NextRequest) {
  const user = await requireRole(Role.ADMIN);
  const form = await request.formData();
  const action = String(form.get("action") || "create");

  if (action === "deactivate") {
    const parsed = UserActionSchema.safeParse({ userId: form.get("userId") });
    if (!parsed.success) {
      return NextResponse.redirect(new URL("/settings?error=invalid-user", request.url), 303);
    }
    const { userId } = parsed.data;
    if (userId === user.id) {
      return NextResponse.redirect(new URL("/settings?error=self-deactivate", request.url), 303);
    }
    await prisma.user.updateMany({ where: { id: userId, role: Role.TEAM_MEMBER }, data: { active: false } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "USER_DEACTIVATED", entity: "User", entityId: userId } });
    return NextResponse.redirect(new URL("/settings", request.url), 303);
  }

  if (action === "reactivate") {
    const parsed = UserActionSchema.safeParse({ userId: form.get("userId") });
    if (!parsed.success) {
      return NextResponse.redirect(new URL("/settings?error=invalid-user", request.url), 303);
    }
    const { userId } = parsed.data;
    await prisma.user.updateMany({ where: { id: userId, role: Role.TEAM_MEMBER }, data: { active: true } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "USER_REACTIVATED", entity: "User", entityId: userId } });
    return NextResponse.redirect(new URL("/settings", request.url), 303);
  }

  const parsed = CreateUserSchema.safeParse({
    name: String(form.get("name") || "").trim(),
    email: String(form.get("email") || "").toLowerCase().trim(),
    password: String(form.get("password") || "").trim()
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/settings?error=missing-fields", request.url), 303);
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return NextResponse.redirect(new URL("/settings?error=email-taken", request.url), 303);
  }

  const newUser = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: Role.TEAM_MEMBER }
  });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "USER_CREATED", entity: "User", entityId: newUser.id } });
  return NextResponse.redirect(new URL("/settings", request.url), 303);
}
