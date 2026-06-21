import { describe, it, expect } from "vitest";
import { WorkMode } from "@prisma/client";
import type { NormalizedJob } from "../lib/job-providers/types";

// Mirror of isJobRelevant from the cron route — tested in isolation
type ClientForFilter = {
  targetJobTitles: string[];
  alternativeJobTitles: string[];
  preferredLocations: string[];
  workModePreference: WorkMode;
};

function isJobRelevant(job: NormalizedJob, client: ClientForFilter): boolean {
  const allTitles = [...client.targetJobTitles, ...client.alternativeJobTitles];
  const jobTitleLower = job.title.toLowerCase();

  const titleMatch = allTitles.some((t) => {
    const tl = t.toLowerCase();
    const words = tl.split(/\s+/).filter((w) => w.length > 2 && !["and", "the", "for", "with"].includes(w));
    return words.some((w) => jobTitleLower.includes(w));
  });
  if (!titleMatch) return false;

  if (client.workModePreference === WorkMode.REMOTE) {
    return job.workMode === WorkMode.REMOTE || job.workMode === WorkMode.FLEXIBLE ||
      job.location.toLowerCase().includes("remote") || job.location.toLowerCase().includes("worldwide");
  }

  if (job.workMode === WorkMode.REMOTE || job.workMode === WorkMode.HYBRID) return true;
  if (job.location.toLowerCase().includes("remote")) return true;

  const jobLocationLower = job.location.toLowerCase();
  return client.preferredLocations.some((loc) => {
    const locLower = loc.toLowerCase();
    const parts = locLower.split(/[\s,]+/).filter((p) => p.length > 1);
    return parts.some((p) => jobLocationLower.includes(p));
  });
}

const makeJob = (overrides: Partial<NormalizedJob>): NormalizedJob => ({
  externalId: "test-1",
  sourceName: "Test",
  sourceUrl: "https://test.com",
  companyName: "Test Co",
  title: "Senior Data Engineer",
  location: "Chicago, IL",
  workMode: WorkMode.ONSITE,
  employmentType: "FULL_TIME" as never,
  description: "",
  requiredSkills: [],
  preferredSkills: [],
  ...overrides
});

const ahsanClient: ClientForFilter = {
  targetJobTitles: ["Senior Data Engineer", "Data Engineer"],
  alternativeJobTitles: ["Analytics Engineer", "ETL Developer"],
  preferredLocations: ["Chicago, IL", "Illinois", "Remote"],
  workModePreference: WorkMode.HYBRID
};

describe("isJobRelevant — title filtering", () => {
  it("accepts job whose title contains a client target title word", () => {
    expect(isJobRelevant(makeJob({ title: "Senior Data Engineer" }), ahsanClient)).toBe(true);
  });

  it("accepts job whose title contains an alternative title word", () => {
    expect(isJobRelevant(makeJob({ title: "Analytics Engineer III" }), ahsanClient)).toBe(true);
  });

  it("rejects completely unrelated job title", () => {
    expect(isJobRelevant(makeJob({ title: "Marketing Manager" }), ahsanClient)).toBe(false);
  });

  it("rejects job title with no matching significant word", () => {
    expect(isJobRelevant(makeJob({ title: "Software Quality Assurance Analyst" }), ahsanClient)).toBe(false);
  });

  it("accepts partial title match (ETL in ETL Developer)", () => {
    expect(isJobRelevant(makeJob({ title: "ETL Pipeline Developer" }), ahsanClient)).toBe(true);
  });
});

describe("isJobRelevant — location filtering (Arbeitnow / EU board scenario)", () => {
  it("rejects German job for Chicago client", () => {
    expect(isJobRelevant(makeJob({ title: "Data Engineer", location: "Berlin, Germany", workMode: WorkMode.ONSITE }), ahsanClient)).toBe(false);
  });

  it("rejects Frankfurt job for Chicago client", () => {
    expect(isJobRelevant(makeJob({ title: "Data Engineer", location: "Frankfurt am Main, Germany", workMode: WorkMode.ONSITE }), ahsanClient)).toBe(false);
  });

  it("accepts Chicago job for Chicago client", () => {
    expect(isJobRelevant(makeJob({ title: "Data Engineer", location: "Chicago, IL", workMode: WorkMode.ONSITE }), ahsanClient)).toBe(true);
  });

  it("accepts Illinois job for Chicago client", () => {
    expect(isJobRelevant(makeJob({ title: "Data Engineer", location: "Naperville, Illinois", workMode: WorkMode.ONSITE }), ahsanClient)).toBe(true);
  });

  it("accepts Remote job for any client regardless of location", () => {
    expect(isJobRelevant(makeJob({ title: "Data Engineer", location: "Berlin, Germany", workMode: WorkMode.REMOTE }), ahsanClient)).toBe(true);
  });

  it("accepts Hybrid job for any client regardless of location", () => {
    expect(isJobRelevant(makeJob({ title: "Data Engineer", location: "Amsterdam, NL", workMode: WorkMode.HYBRID }), ahsanClient)).toBe(true);
  });

  it("accepts job with 'Remote' in location string even if workMode is ONSITE", () => {
    expect(isJobRelevant(makeJob({ title: "Data Engineer", location: "Remote / US", workMode: WorkMode.ONSITE }), ahsanClient)).toBe(true);
  });
});

describe("isJobRelevant — remote-only client", () => {
  const remoteClient: ClientForFilter = {
    targetJobTitles: ["Data Engineer"],
    alternativeJobTitles: [],
    preferredLocations: ["Remote"],
    workModePreference: WorkMode.REMOTE
  };

  it("accepts REMOTE job anywhere in the world", () => {
    expect(isJobRelevant(makeJob({ title: "Data Engineer", location: "Worldwide", workMode: WorkMode.REMOTE }), remoteClient)).toBe(true);
  });

  it("rejects ONSITE job in Chicago for remote-only client", () => {
    expect(isJobRelevant(makeJob({ title: "Data Engineer", location: "Chicago, IL", workMode: WorkMode.ONSITE }), remoteClient)).toBe(false);
  });

  it("accepts FLEXIBLE job for remote-only client", () => {
    expect(isJobRelevant(makeJob({ title: "Data Engineer", location: "USA", workMode: WorkMode.FLEXIBLE }), remoteClient)).toBe(true);
  });
});
