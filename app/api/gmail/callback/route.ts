import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { verifyState, encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const user = await requireRole(Role.ADMIN);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code || !state) {
    return redirectTo("/clients?error=gmail-denied");
  }

  let clientId: string;
  try {
    const verified = verifyState<{ clientId: string; adminUserId: string; issuedAt: number }>(state);
    if (verified.adminUserId !== user.id || Date.now() - verified.issuedAt > STATE_MAX_AGE_MS) {
      throw new Error("Expired or mismatched state");
    }
    clientId = verified.clientId;
  } catch {
    return redirectTo("/clients?error=invalid-state");
  }

  const client = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) {
    return redirectTo("/clients?error=missing-client");
  }

  const redirectUri = `${process.env.APP_URL}/api/gmail/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!tokenRes.ok) {
    return redirectTo(`/clients/${clientId}?error=gmail-token-failed`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
  };

  const profileRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  const profile = profileRes.ok
    ? ((await profileRes.json()) as { emailAddress?: string })
    : {};

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      gmailEmail: profile.emailAddress,
      gmailAccessToken: encryptToken(tokens.access_token),
      gmailRefreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
      gmailConnectedAt: new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "GMAIL_CONNECTED",
      entity: "ClientProfile",
      entityId: clientId,
      metadata: { email: profile.emailAddress }
    }
  });

  return redirectTo(`/clients/${clientId}?gmailConnected=1`);
}
