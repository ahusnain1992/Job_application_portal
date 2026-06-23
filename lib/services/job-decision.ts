/**
 * Single source of truth for the combined job + resume decision.
 *
 * The decision combines job fit, apply-link readiness, and resume/ATS fit.
 * Resume coverage can never override poor job fit.
 *
 * Rule summary:
 *   matchScore < 45   → skip (poor job fit)
 *   matchScore 45–69  → tailor/rewrite first, never apply as-is
 *   matchScore ≥ 70   → resume ATS check determines action:
 *     LEVERAGE     → apply as-is
 *     REWRITE      → rewrite resume (40–69% keyword coverage)
 *     NEW_VERSION  → new version from scratch (<40% or domain shift)
 *   No resume text  → "missing-resume-text"
 *   No applyUrl     → "find-apply-link"
 */

export type NextAction =
  | "apply-as-is"         // High job fit + strong resume + apply link exists
  | "tailor-resume"       // ATS: ≥70% match — tailor existing resume, add missing keywords
  | "rewrite-resume"      // ATS: 40–69% match — rewrite around the JD to pass ATS
  | "new-resume-version"  // ATS: <40% or domain shift — new targeted version from scratch
  | "do-not-apply"        // Poor job fit — skip
  | "find-apply-link"     // Good fit but no apply URL found
  | "wrong-location"      // Location mismatch
  | "missing-resume-text"; // No resume text to analyse

export type JobFitLabel = "High" | "Medium" | "Low";
export type ATSLabel = "High" | "Medium" | "Low" | "Missing";

export type JobDecision = {
  nextAction: NextAction;
  jobFitLabel: JobFitLabel;
  jobFitScore: number;
  /** ATS pass likelihood label based on keyword coverage */
  atsLabel: ATSLabel;
  /** Raw keyword coverage score 0–100 (ATS match score) */
  resumeFitScore: number | null;
  /** @deprecated use atsLabel */
  resumeFitLabel: ATSLabel;
  needsRewrite: boolean;
  shouldSkip: boolean;
  actionLabel: string;
  actionTone: "brand" | "signal" | "warn" | "danger" | "neutral";
  queuePriority: number;
};

const HIGH_MATCH = 70;
const LOW_MATCH = 45;

export function deriveJobDecision(params: {
  matchScore: number;
  resumeRecommendation: string | null | undefined;
  resumeCoverageScore?: number | null;
  applyUrl: string | null | undefined;
  matchWarnings?: string[];
}): JobDecision {
  // Normalize old DB values to new ATS-framed values
  const legacyMap: Record<string, string> = {
    "AS_IS": "LEVERAGE",
    "FULL_REWRITE": "REWRITE",
  };
  const rawRec = params.resumeRecommendation;
  const resumeRecommendation = rawRec && legacyMap[rawRec] ? legacyMap[rawRec] : rawRec;
  const { matchScore, resumeCoverageScore, applyUrl, matchWarnings = [] } = params;

  const jobFitLabel: JobFitLabel =
    matchScore >= HIGH_MATCH ? "High" : matchScore >= LOW_MATCH ? "Medium" : "Low";

  // ATS label based on keyword coverage score
  const atsLabel: ATSLabel = !resumeRecommendation
    ? "Missing"
    : resumeCoverageScore != null
    ? resumeCoverageScore >= 70 ? "High" : resumeCoverageScore >= 40 ? "Medium" : "Low"
    : resumeRecommendation === "LEVERAGE" ? "High"
    : resumeRecommendation === "REWRITE"  ? "Medium"
    : "Low";

  const hasLocationWarning = matchWarnings.some(
    (w) => w.toLowerCase().includes("location") || w.toLowerCase().includes("onsite") || w.toLowerCase().includes("does not clearly match")
  );

  let nextAction: NextAction;

  if (matchScore < LOW_MATCH) {
    nextAction = hasLocationWarning ? "wrong-location" : "do-not-apply";
  } else if (!resumeRecommendation) {
    nextAction = "missing-resume-text";
  } else if (!applyUrl) {
    nextAction = "find-apply-link";
  } else {
    // Medium job fit should never be presented as apply-ready.
    // Even with strong resume coverage, the business action is to tailor first.
    if (resumeRecommendation === "LEVERAGE") {
      nextAction = matchScore >= HIGH_MATCH ? "apply-as-is" : "tailor-resume";
    } else if (resumeRecommendation === "MINOR_TAILORING") {
      nextAction = "tailor-resume";
    } else if (resumeRecommendation === "REWRITE") {
      nextAction = "rewrite-resume";
    } else {
      // NEW_VERSION
      nextAction = "new-resume-version";
    }
  }

  const ACTION_META: Record<NextAction, { label: string; tone: JobDecision["actionTone"]; priority: number }> = {
    "apply-as-is":         { label: "Apply as-is",               tone: "brand",   priority: 0 },
    "tailor-resume":       { label: "Tailor resume first",       tone: "signal",  priority: 1 },
    "rewrite-resume":      { label: "Rewrite resume",           tone: "warn",    priority: 2 },
    "new-resume-version":  { label: "New resume version needed", tone: "warn",    priority: 3 },
    "find-apply-link":     { label: "Find apply link",           tone: "neutral", priority: 4 },
    "missing-resume-text": { label: "Add resume text",           tone: "neutral", priority: 5 },
    "do-not-apply":        { label: "Poor match — skip",         tone: "danger",  priority: 6 },
    "wrong-location":      { label: "Wrong location",            tone: "danger",  priority: 6 },
  };

  const meta = ACTION_META[nextAction];

  return {
    nextAction,
    jobFitLabel,
    jobFitScore: matchScore,
    atsLabel,
    resumeFitLabel: atsLabel,
    resumeFitScore: resumeCoverageScore ?? null,
    needsRewrite: nextAction === "rewrite-resume" || nextAction === "new-resume-version",
    shouldSkip: nextAction === "do-not-apply" || nextAction === "wrong-location",
    actionLabel: meta.label,
    actionTone: meta.tone,
    queuePriority: meta.priority,
  };
}

export function jobDecisionFromRow(job: {
  matchScore: number;
  resumeRecommendation: string | null;
  resumeCoverageScore?: number | null;
  applyUrl: string | null;
  matchWarnings: string[];
}): JobDecision {
  return deriveJobDecision({
    matchScore: job.matchScore,
    resumeRecommendation: job.resumeRecommendation,
    resumeCoverageScore: job.resumeCoverageScore,
    applyUrl: job.applyUrl,
    matchWarnings: job.matchWarnings,
  });
}
