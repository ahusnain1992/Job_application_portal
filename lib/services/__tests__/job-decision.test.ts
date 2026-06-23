import { deriveJobDecision } from "../job-decision";

// Helper — builds minimal params with sensible defaults
function d(overrides: {
  matchScore: number;
  resumeRecommendation?: string | null;
  resumeCoverageScore?: number | null;
  applyUrl?: string | null;
  matchWarnings?: string[];
}) {
  return deriveJobDecision({
    applyUrl: "https://example.com/apply",
    matchWarnings: [],
    resumeRecommendation: null,
    resumeCoverageScore: null,
    ...overrides,
  });
}

describe("deriveJobDecision", () => {
  // ── Low match gate ────────────────────────────────────────────────────────
  test("20% match + AS_IS + 100% coverage → do-not-apply, NOT tailor-resume", () => {
    const r = d({ matchScore: 20, resumeRecommendation: "AS_IS", resumeCoverageScore: 100 });
    expect(r.nextAction).toBe("do-not-apply");
    expect(r.shouldSkip).toBe(true);
  });

  test("20% match never shows tailor-resume regardless of resume", () => {
    for (const rec of ["AS_IS", "MINOR_TAILORING", "FULL_REWRITE", "NEW_VERSION", null]) {
      const r = d({ matchScore: 20, resumeRecommendation: rec });
      expect(r.nextAction).not.toBe("tailor-resume");
    }
  });

  test("44% match → do-not-apply", () => {
    expect(d({ matchScore: 44 }).nextAction).toBe("do-not-apply");
  });

  test("low match with location warning → wrong-location", () => {
    const r = d({
      matchScore: 30,
      matchWarnings: ["Location does not clearly match the client's preferred locations."],
    });
    expect(r.nextAction).toBe("wrong-location");
    expect(r.shouldSkip).toBe(true);
  });

  // ── Medium match gate (45-69%) ────────────────────────────────────────────
  test("60% match + AS_IS (mapped to LEVERAGE) → tailor-resume", () => {
    const r = d({ matchScore: 60, resumeRecommendation: "AS_IS", resumeCoverageScore: 90 });
    expect(r.nextAction).toBe("tailor-resume");
  });

  test("60% match + MINOR_TAILORING (mapped to LEVERAGE) → tailor-resume", () => {
    expect(d({ matchScore: 60, resumeRecommendation: "MINOR_TAILORING" }).nextAction).toBe("tailor-resume");
  });

  test("60% match + weak resume FULL_REWRITE (mapped to REWRITE) → rewrite-resume", () => {
    const r = d({ matchScore: 60, resumeRecommendation: "FULL_REWRITE", resumeCoverageScore: 40 });
    expect(r.nextAction).toBe("rewrite-resume");
    expect(r.needsRewrite).toBe(true);
  });

  test("65% match + NEW_VERSION → new-resume-version", () => {
    expect(d({ matchScore: 65, resumeRecommendation: "NEW_VERSION" }).nextAction).toBe("new-resume-version");
  });

  test("no resume text at medium match → missing-resume-text", () => {
    expect(d({ matchScore: 60, resumeRecommendation: null }).nextAction).toBe("missing-resume-text");
  });

  // ── High match gate (70%+) ────────────────────────────────────────────────
  test("70% match + AS_IS (LEVERAGE) + applyUrl → tailor-resume", () => {
    const r = d({ matchScore: 70, resumeRecommendation: "AS_IS", applyUrl: "https://example.com" });
    expect(r.nextAction).toBe("tailor-resume");
  });

  test("75% match + AS_IS (LEVERAGE) + applyUrl → tailor-resume", () => {
    const r = d({ matchScore: 75, resumeRecommendation: "AS_IS", applyUrl: "https://example.com" });
    expect(r.nextAction).toBe("tailor-resume");
  });

  test("75% match + MINOR_TAILORING → tailor-resume", () => {
    expect(d({ matchScore: 75, resumeRecommendation: "MINOR_TAILORING" }).nextAction).toBe("tailor-resume");
  });

  test("75% match + FULL_REWRITE → rewrite-resume", () => {
    expect(d({ matchScore: 75, resumeRecommendation: "FULL_REWRITE" }).nextAction).toBe("rewrite-resume");
  });

  test("80% match + AS_IS + missing applyUrl → find-apply-link", () => {
    const r = d({ matchScore: 80, resumeRecommendation: "AS_IS", applyUrl: null });
    expect(r.nextAction).toBe("find-apply-link");
    expect(r.shouldSkip).toBe(false);
  });

  test("no resume text at high match → missing-resume-text", () => {
    expect(d({ matchScore: 80, resumeRecommendation: null }).nextAction).toBe("missing-resume-text");
  });

  // ── Labels ────────────────────────────────────────────────────────────────
  test("job fit labels", () => {
    expect(d({ matchScore: 80 }).jobFitLabel).toBe("High");
    expect(d({ matchScore: 60 }).jobFitLabel).toBe("Medium");
    expect(d({ matchScore: 30 }).jobFitLabel).toBe("Low");
  });

  test("resume fit labels (atsLabel) from coverageScore", () => {
    expect(d({ matchScore: 75, resumeRecommendation: "AS_IS", resumeCoverageScore: 80 }).atsLabel).toBe("High");
    expect(d({ matchScore: 75, resumeRecommendation: "MINOR_TAILORING", resumeCoverageScore: 60 }).atsLabel).toBe("Medium");
    expect(d({ matchScore: 75, resumeRecommendation: "FULL_REWRITE", resumeCoverageScore: 40 }).atsLabel).toBe("Medium");
    expect(d({ matchScore: 75, resumeRecommendation: null }).atsLabel).toBe("Missing");
  });

  // ── needsRewrite ─────────────────────────────────────────────────────────
  test("needsRewrite is true for rewrite-resume and new-resume-version actions", () => {
    expect(d({ matchScore: 80, resumeRecommendation: "AS_IS", applyUrl: "https://x.com" }).needsRewrite).toBe(false);
    expect(d({ matchScore: 80, resumeRecommendation: "FULL_REWRITE", applyUrl: "https://x.com" }).needsRewrite).toBe(true);
    expect(d({ matchScore: 80, resumeRecommendation: "NEW_VERSION", applyUrl: "https://x.com" }).needsRewrite).toBe(true);
    expect(d({ matchScore: 40, resumeRecommendation: "AS_IS" }).needsRewrite).toBe(false);
  });

  // ── shouldSkip ────────────────────────────────────────────────────────────
  test("shouldSkip for do-not-apply and wrong-location only", () => {
    expect(d({ matchScore: 20 }).shouldSkip).toBe(true);
    expect(d({ matchScore: 20, matchWarnings: ["Location does not clearly match"] }).shouldSkip).toBe(true);
    expect(d({ matchScore: 75, resumeRecommendation: "AS_IS" }).shouldSkip).toBe(false);
  });

  // ── Queue priorities ──────────────────────────────────────────────────────
  test("tailor-resume has highest queue priority (0)", () => {
    const r = d({ matchScore: 80, resumeRecommendation: "AS_IS" });
    expect(r.queuePriority).toBe(0);
  });

  test("do-not-apply has lowest queue priority (5)", () => {
    expect(d({ matchScore: 20 }).queuePriority).toBe(5);
  });
});
