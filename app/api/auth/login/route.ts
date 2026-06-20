import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { verifyPassword, setSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") || "").toLowerCase().trim();
  const password = String(form.get("password") || "");

  const user = await prisma.user.findFirst({ where: { email, active: true } });
  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !passwordOk) {
    return NextResponse.redirect(new URL("/?error=1", request.url), 303);
  }

  setSession(user.id);
  await prisma.auditLog.create({ data: { actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id } });
  return NextResponse.redirect(new URL(user.role === Role.ADMIN ? "/admin" : "/team", request.url), 303);
}
