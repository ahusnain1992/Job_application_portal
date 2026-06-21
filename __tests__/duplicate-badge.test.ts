import { describe, it, expect } from "vitest";

// Replicate buildDupSet from job-table.tsx for unit testing
function buildDupSet(jobs: { duplicateGroupId: string | null }[]): Set<string> {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    if (j.duplicateGroupId) counts.set(j.duplicateGroupId, (counts.get(j.duplicateGroupId) ?? 0) + 1);
  }
  const set = new Set<string>();
  counts.forEach((count, id) => { if (count > 1) set.add(id); });
  return set;
}

describe("buildDupSet — duplicate badge logic", () => {
  it("returns empty set when all jobs have unique group IDs", () => {
    const jobs = [
      { duplicateGroupId: "group-a" },
      { duplicateGroupId: "group-b" },
      { duplicateGroupId: "group-c" },
    ];
    expect(buildDupSet(jobs).size).toBe(0);
  });

  it("flags group IDs that appear more than once", () => {
    const jobs = [
      { duplicateGroupId: "group-a" },
      { duplicateGroupId: "group-a" }, // duplicate
      { duplicateGroupId: "group-b" },
    ];
    const set = buildDupSet(jobs);
    expect(set.has("group-a")).toBe(true);
    expect(set.has("group-b")).toBe(false);
  });

  it("ignores null duplicateGroupId", () => {
    const jobs = [
      { duplicateGroupId: null },
      { duplicateGroupId: null },
      { duplicateGroupId: "group-x" },
    ];
    const set = buildDupSet(jobs);
    expect(set.size).toBe(0);
  });

  it("handles 3+ jobs in the same group", () => {
    const jobs = [
      { duplicateGroupId: "grp" },
      { duplicateGroupId: "grp" },
      { duplicateGroupId: "grp" },
    ];
    const set = buildDupSet(jobs);
    expect(set.has("grp")).toBe(true);
    expect(set.size).toBe(1);
  });

  it("handles empty array", () => {
    expect(buildDupSet([]).size).toBe(0);
  });

  it("correctly handles mixed null and duplicate groups", () => {
    const jobs = [
      { duplicateGroupId: null },
      { duplicateGroupId: "real-dup" },
      { duplicateGroupId: "real-dup" },
      { duplicateGroupId: "unique-one" },
    ];
    const set = buildDupSet(jobs);
    expect(set.has("real-dup")).toBe(true);
    expect(set.has("unique-one")).toBe(false);
    expect(set.size).toBe(1);
  });
});
