import { NextRequest, NextResponse } from "next/server";
import { redirectTo } from "@/lib/redirect";

export async function GET(request: NextRequest) {
  return redirectTo("/");
}

export async function POST(request: NextRequest) {
  const [{ Role }, { verifyPassword, setSession }, { prisma }] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/auth"),
    import("@/lib/prisma")
  ]);

  const form = await request.formData();
  const email = String(form.get("email") || "").toLowerCase().trim();
  const password = String(form.get("password") || "");

  const user = await prisma.user.findFirst({ where: { email, active: true } });
  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !passwordOk) {
    return redirectTo("/?error=1");
  }

  setSession(user.id);
  await prisma.auditLog.create({ data: { actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id } });
  return redirectTo(user.role === Role.ADMIN ? "/admin" : "/team");
}
