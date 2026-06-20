import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const cookieName = "job_portal_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production");
  }
  return s || "dev-secret-change-me";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId: string;
      issuedAt: number;
    };
    if (Date.now() - parsed.issuedAt > SESSION_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(userId: string) {
  cookies().set(cookieName, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000
  });
}

export function clearSession() {
  cookies().delete(cookieName);
}

export async function getCurrentUser() {
  const session = readSessionToken(cookies().get(cookieName)?.value);
  if (!session) return null;

  return prisma.user.findFirst({
    where: { id: session.userId, active: true },
    select: { id: true, name: true, email: true, role: true }
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

export async function requireRole(role: Role) {
  const user = await requireUser();
  if (user.role !== role) redirect(user.role === Role.ADMIN ? "/admin" : "/team");
  return user;
}

/** Returns true if the current user may access the given clientId. */
export async function canAccessClient(
  user: { id: string; role: Role },
  clientId: string
): Promise<boolean> {
  if (user.role === Role.ADMIN) return true;
  const assignment = await prisma.clientAssignment.findFirst({
    where: { userId: user.id, clientId }
  });
  return assignment !== null;
}

/** Throws a redirect to the appropriate home if the user cannot access the client. */
export async function requireClientAccess(
  user: { id: string; role: Role },
  clientId: string
): Promise<void> {
  const ok = await canAccessClient(user, clientId);
  if (!ok) redirect(user.role === Role.ADMIN ? "/admin" : "/team");
}

export async function assignedClientIdsFor(user: { id: string; role: Role }) {
  if (user.role === Role.ADMIN) return undefined;
  const assignments = await prisma.clientAssignment.findMany({
    where: { userId: user.id },
    select: { clientId: true }
  });
  return assignments.map((assignment) => assignment.clientId);
}

export async function canAccessJob(user: { id: string; role: Role }, jobId: string) {
  if (user.role === Role.ADMIN) return true;
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { clientId: true } });
  if (!job) return false;
  return canAccessClient(user, job.clientId);
}

export async function requireJobAccess(user: { id: string; role: Role }, jobId: string) {
  const ok = await canAccessJob(user, jobId);
  if (!ok) redirect(user.role === Role.ADMIN ? "/admin" : "/team");
}
