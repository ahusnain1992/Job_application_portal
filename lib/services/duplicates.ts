import crypto from "crypto";

export function normalizeKey(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function duplicateSignature(input: {
  companyName: string;
  title: string;
  location?: string | null;
  applyUrl?: string | null;
  sourceUrl?: string | null;
  externalId?: string | null;
}) {
  const urlKey = normalizeKey(input.applyUrl || input.sourceUrl || input.externalId);
  const companyTitleLocation = [input.companyName, input.title, input.location].map(normalizeKey).join("|");
  const base = urlKey || companyTitleLocation;
  return crypto.createHash("sha256").update(base).digest("hex");
}

export function preferApplyUrl(existing?: string | null, candidate?: string | null) {
  if (!candidate) return existing || null;
  if (!existing) return candidate;
  const candidateLooksCompany = !/linkedin|indeed|glassdoor|ziprecruiter/i.test(candidate);
  const existingLooksBoard = /linkedin|indeed|glassdoor|ziprecruiter/i.test(existing);
  return candidateLooksCompany && existingLooksBoard ? candidate : existing;
}
