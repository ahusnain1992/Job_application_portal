import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { signState } from "@/lib/crypto";

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"].join(" ");

export async function GET(request: NextRequest) {
  const user = await requireRole(Role.ADMIN);
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.redirect(new URL("/clients?error=missing-client", request.url));

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return NextResponse.redirect(new URL(`/clients/${clientId}?error=google-not-configured`, request.url));
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
