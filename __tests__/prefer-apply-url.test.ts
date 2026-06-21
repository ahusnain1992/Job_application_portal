import { describe, it, expect } from "vitest";
import { preferApplyUrl } from "../lib/services/duplicates";

describe("preferApplyUrl — job board vs company portal preference", () => {
  it("prefers company portal over LinkedIn", () => {
    expect(preferApplyUrl("https://linkedin.com/jobs/123", "https://stripe.com/careers/456")).toBe("https://stripe.com/careers/456");
  });

  it("prefers company portal over Indeed", () => {
    expect(preferApplyUrl("https://indeed.com/viewjob?jk=abc", "https://shopify.com/jobs/abc")).toBe("https://shopify.com/jobs/abc");
  });

  it("prefers company portal over Glassdoor", () => {
    expect(preferApplyUrl("https://glassdoor.com/job/123", "https://airbnb.com/careers/123")).toBe("https://airbnb.com/careers/123");
  });

  it("prefers company portal over ZipRecruiter", () => {
    expect(preferApplyUrl("https://ziprecruiter.com/jobs/x", "https://company.io/apply")).toBe("https://company.io/apply");
  });

  it("keeps existing company URL when candidate is LinkedIn", () => {
    expect(preferApplyUrl("https://acme.com/jobs/7", "https://linkedin.com/jobs/apply/7")).toBe("https://acme.com/jobs/7");
  });

  it("uses candidate when existing is null", () => {
    expect(preferApplyUrl(null, "https://company.com/apply")).toBe("https://company.com/apply");
  });

  it("keeps existing when candidate is null", () => {
    expect(preferApplyUrl("https://existing.com/job", null)).toBe("https://existing.com/job");
  });

  it("returns null when both are null", () => {
    expect(preferApplyUrl(null, null)).toBeNull();
  });

  it("does not replace a good company URL with another job board", () => {
    const result = preferApplyUrl("https://netflix.com/jobs/99", "https://indeed.com/viewjob?jk=99");
    expect(result).toBe("https://netflix.com/jobs/99");
  });
});
