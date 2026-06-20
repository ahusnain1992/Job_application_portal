export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto";

const ATS_SENDERS = [
  "greenhouse.io", "lever.co", "myworkday.com", "smartrecruiters.com",
  "ashby.io", "jobvite.com", "icims.com", "taleo.net", "successfactors.com",
  "bamboohr.com", "recruitee.com", "workable.com", "brassring.com"
];

const CONFIRMATION_SUBJECTS = [
  "application received",
  "thank you for applying",
  "we received your application",
  "application submitted",
  "application confirmation",
  "thanks for applying",
  "your application to",
  "application for"
];

function authorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // In production, fail closed if secret is missing
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  return (
    req.headers.get("x-cron-secret") === cronSecret ||
    req.headers.get("authorization") === `Bearer ${cronSecret}`
  );
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = { scanned: 0, verified: 0, errors: [] as string[] };

  const clients = await prisma.clientProfile.findMany({
    where: { gmailAccessToken: { not: null }, status: "ACTIVE" },
    include: {
      applications: {
        where: { status: JobStatus.APPLIED, verifiedByGmail: false },
        include: { job: true }
      }
    }
  });

  for (const client of clients) {
    if (!client.gmailAccessToken) continue;
    summary.scanned++;

    try {
      const accessToken = await refreshIfNeeded(client);
      if (!accessToken) continue;

      const query = [
        `newer_than:7d`,
        `(${ATS_SENDERS.map((d) => `from:${d}`).join(" OR ")}`,
        ` OR subject:(${CONFIRMATION_SUBJECTS.slice(0, 4).map((s) => `"${s}"`).join(" OR ")}))`
      ].join(" ");

      const searchRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!searchRes.ok) continue;
      const searchData = (await searchRes.json()) as { messages?: { id: string }[] };
      const messages = searchData.messages || [];

      for (const msg of messages) {
        const detail = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!detail.ok) continue;

        const data = (await detail.json()) as {
          payload?: { headers?: { name: string; value: string }[] };
          internalDate?: string;
        };

        const headers = data.payload?.headers || [];
        const subject = headers.find((h) => h.name === "Subject")?.value || "";
        const from = headers.find((h) => h.name === "From")?.value || "";
        const emailDate = data.internalDate ? new Date(parseInt(data.internalDate)) : new Date();

        for (const app of client.applications) {
          if (emailMatchesApplication(subject, from, app.job.companyName, app.job.title)) {
            await prisma.application.update({
              where: { id: app.id },
              data: { verifiedByGmail: true, flaggedFast: false }
            });

            await prisma.applicationStatusHistory.create({
              data: {
                applicationId: app.id,
                status: JobStatus.APPLIED,
                note: `Auto-verified via Gmail confirmation email from ${from} on ${emailDate.toLocaleDateString()}`
              }
            });

            await prisma.auditLog.create({
              data: {
                action: "GMAIL_AUTO_VERIFIED",
                entity: "Application",
                entityId: app.id,
                metadata: { subject, from, emailDate }
              }
            });

            summary.verified++;
          }
        }
      }
    } catch (err) {
      summary.errors.push(`Client ${client.clientName}: ${String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}

function emailMatchesApplication(subject: string, from: string, company: string, jobTitle: string) {
  const s = subject.toLowerCase();
  const f = from.toLowerCase();

  const senderMatchesAts = ATS_SENDERS.some((d) => f.includes(d));
  const subjectMatchesConfirmation = CONFIRMATION_SUBJECTS.some((p) => s.includes(p));

  if (!senderMatchesAts && !subjectMatchesConfirmation) return false;

  const companyWords = company.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const companyInSubject = companyWords.some((w) => s.includes(w));
  const titleWords = jobTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  const titleInSubject = titleWords.some((w) => s.includes(w));

  return companyInSubject || titleInSubject || (senderMatchesAts && subjectMatchesConfirmation);
}

async function refreshIfNeeded(client: {
  id: string;
  gmailAccessToken: string | null;
  gmailRefreshToken: string | null;
}): Promise<string | null> {
  if (!client.gmailAccessToken) return null;

  let accessToken: string;
  try {
    accessToken = decryptToken(client.gmailAccessToken);
  } catch {
    return null;
  }

  const test = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (test.ok) return accessToken;

  if (!client.gmailRefreshToken) return null;

  let refreshToken: string;
  try {
    refreshToken = decryptToken(client.gmailRefreshToken);
  } catch {
    return null;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!res.ok) return null;
  const tokens = (await res.json()) as { access_token?: string };
  if (!tokens.access_token) return null;

  await prisma.clientProfile.update({
    where: { id: client.id },
    data: { gmailAccessToken: encryptToken(tokens.access_token) }
  });

  return tokens.access_token;
}
