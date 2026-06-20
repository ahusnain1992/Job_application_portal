import { describe, it, expect } from "vitest";
import { duplicateSignature, normalizeKey, preferApplyUrl } from "../lib/services/duplicates";

describe("normalizeKey", () => {
  it("strips https:// and www.", () => {
    expect(normalizeKey("https://www.example.com")).toBe("example com");
  });

  it("lowercases and collapses punctuation", () => {
    expect(normalizeKey("Acme Health, Inc.")).toBe("acme health inc");
  });

  it("handles null/undefined gracefully", () => {
    expect(normalizeKey(null)).toBe("");
    expect(normalizeKey(undefined)).toBe("");
  });
});

describe("duplicateSignature", () => {
  it("produces the same hash for equivalent jobs", () => {
    const a = duplicateSignature({ companyName: "Acme", title: "Data Engineer", location: "Remote", applyUrl: null });
    const b = duplicateSignature({ companyName: "Acme", title: "Data Engineer", location: "Remote", applyUrl: null });
    expect(a).toBe(b);
  });

  it("prefers URL-based key over company+title", () => {
    const byUrl = duplicateSignature({ companyName: "Acme", title: "Data Engineer", location: "Remote", applyUrl: "https://acme.com/jobs/123" });
    const alsoByUrl = duplicateSignature({ companyName: "DIFFERENT", title: "OTHER", location: "Anywhere", applyUrl: "https://acme.com/jobs/123" });
    expect(byUrl).toBe(alsoByUrl);
  });

  it("produces different hashes for different jobs", () => {
    const a = duplicateSignature({ companyName: "Acme", title: "Data Engineer", location: "Remote" });
    const b = duplicateSignature({ companyName: "Acme", title: "Analytics Engineer", location: "Remote" });
    expect(a).not.toBe(b);
  });
});

describe("preferApplyUrl", () => {
  it("prefers company career page over LinkedIn", () => {
    const result = preferApplyUrl("https://linkedin.com/jobs/123", "https://acme.com/careers/456");
    expect(result).toBe("https://acme.com/careers/456");
  });

  it("keeps existing when no candidate", () => {
    expect(preferApplyUrl("https://existing.com", null)).toBe("https://existing.com");
  });

  it("returns candidate when existing is null", () => {
    expect(preferApplyUrl(null, "https://new.com")).toBe("https://new.com");
  });

  it("does not replace company URL with LinkedIn", () => {
    const result = preferApplyUrl("https://acme.com/careers", "https://linkedin.com/jobs/999");
    expect(result).toBe("https://acme.com/careers");
  });
});
