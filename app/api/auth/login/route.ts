import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { verifyPassword, setSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

// GET: someone navigated directly to this endpoint — send them to the login page
export async function GET() {
  return redirectTo("/");
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").toLowerCase().trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) return redirectTo("/?error=1");

    const user = await prisma.user.findFirst({ where: { email, active: true } });
    const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !passwordOk) return redirectTo("/?error=1");

    setSession(user.id);

    // Non-fatal — audit log must never block a successful login
    try {
      await prisma.auditLog.create({
        data: { actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id }
      });
    } catch {
      // intentionally swallowed
    }

    return redirectTo(user.role === Role.ADMIN ? "/admin" : "/team");
  } catch (err) {
    console.error("[login] POST error:", err);
    return redirectTo("/?error=1");
  }
}
