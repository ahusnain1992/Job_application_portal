import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { signState } from "@/lib/crypto";
import { redirectTo } from "@/lib/redirect";

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"].join(" ");

export async function GET(request: NextRequest) {
  const user = await requireRole(Role.ADMIN);
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) return redirectTo("/clients?error=missing-client");

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return redirectTo(`/clients/${clientId}?error=google-not-configured`);
  }

  const redirectUri = `${process.env.APP_URL}/api/gmail/callback`;
  const state = signState({ clientId, adminUserId: user.id, issuedAt: Date.now() });

  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
