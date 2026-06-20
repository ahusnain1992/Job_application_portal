import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url), 303);
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
    return NextResponse.redirect(new URL("/?error=1", request.url), 303);
  }

  setSession(user.id);
  await prisma.auditLog.create({ data: { actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id } });
  return NextResponse.redirect(new URL(user.role === Role.ADMIN ? "/admin" : "/team", request.url), 303);
}
