import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

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
      return redirectTo("/settings?error=invalid-user");
    }
    const { userId } = parsed.data;
    if (userId === user.id) {
      return redirectTo("/settings?error=self-deactivate");
    }
    await prisma.user.updateMany({ where: { id: userId, role: Role.TEAM_MEMBER }, data: { active: false } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "USER_DEACTIVATED", entity: "User", entityId: userId } });
    return redirectTo("/settings");
  }

  if (action === "reactivate") {
    const parsed = UserActionSchema.safeParse({ userId: form.get("userId") });
    if (!parsed.success) {
      return redirectTo("/settings?error=invalid-user");
    }
    const { userId } = parsed.data;
    await prisma.user.updateMany({ where: { id: userId, role: Role.TEAM_MEMBER }, data: { active: true } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "USER_REACTIVATED", entity: "User", entityId: userId } });
    return redirectTo("/settings");
  }

  if (action === "delete") {
    const parsed = UserActionSchema.safeParse({ userId: form.get("userId") });
    if (!parsed.success) {
      return redirectTo("/settings?error=invalid-user");
    }
    const { userId } = parsed.data;
    if (userId === user.id) {
      return redirectTo("/settings?error=self-delete");
    }
    await prisma.user.delete({ where: { id: userId } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "USER_DELETED", entity: "User", entityId: userId } });
    return redirectTo("/settings");
  }

  if (action === "create-admin") {
    const parsed = CreateUserSchema.safeParse({
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").toLowerCase().trim(),
      password: String(form.get("password") || "").trim()
    });
    if (!parsed.success) {
      return redirectTo("/settings?error=missing-fields");
    }
    const { name, email, password } = parsed.data;
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      return redirectTo("/settings?error=email-taken");
    }
    const newAdmin = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role: Role.ADMIN }
    });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "ADMIN_CREATED", entity: "User", entityId: newAdmin.id } });
    return redirectTo("/settings");
  }

  const parsed = CreateUserSchema.safeParse({
    name: String(form.get("name") || "").trim(),
    email: String(form.get("email") || "").toLowerCase().trim(),
    password: String(form.get("password") || "").trim()
  });

  if (!parsed.success) {
    return redirectTo("/settings?error=missing-fields");
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return redirectTo("/settings?error=email-taken");
  }

  const newUser = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: Role.TEAM_MEMBER }
  });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "USER_CREATED", entity: "User", entityId: newUser.id } });
  return redirectTo("/settings");
}
