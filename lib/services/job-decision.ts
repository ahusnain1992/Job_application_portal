/**
 * Single source of truth for the combined job + resume recommendation decision.
 *
 * The raw `resumeRecommendation` stored on a Job is the output of keyword
 * analysis ONLY — it has no knowledge of overall job match. This module
 * applies the business rules that combine both signals into one actionable
 * recommendation for employees and admin alike.
 *
 * Rule summary:
 *   matchScore < 45  → "do-not-apply" (or "wrong-location" if location warning)
 *   matchScore 45-69 → apply-as-is (if resume=AS_IS) / tailor / rewrite
 *   matchScore 70+   → check resume: apply-as-is / tailor / rewrite / find-apply-link
 *   No resume text   → "missing-resume-text" (can't make a good decision)
 *   No applyUrl      → "find-apply-link" (only matters when would otherwise apply)
 */

export type NextAction =
  | "apply-as-is"        // Ready — go apply now
  | "tailor-resume"      // Good match, small resume tweaks first
  | "rewrite-resume"     // Good/medium match, resume needs major work
  | "do-not-apply"       // Poor match — skip this job
  | "find-apply-link"    // Strong match but no apply URL found
  | "wrong-location"     // Location doesn't match client preferences
  | "missing-resume-text"; // No resume text to analyse

export type JobFitLabel = "High" | "Medium" | "Low";
export type ResumeFitLabel = "Strong" | "Medium" | "Weak" | "Missing";

export type JobDecision = {
  nextAction: NextAction;
  jobFitLabel: JobFitLabel;
  jobFitScore: number;
  resumeFitLabel: ResumeFitLabel;
  resumeFitScore: number | null;
  /** true only when nextAction === "apply-as-is" */
  isEmployeeReady: boolean;
  /** true when the job needs a full resume rewrite before applying */
  needsRewrite: boolean;
  /** true when job should be skipped / is not worth pursuing */
  shouldSkip: boolean;
  /** Human-readable label for the next action */
  actionLabel: string;
  /** UI colour tone */
  actionTone: "brand" | "signal" | "warn" | "danger" | "neutral";
  /** Lower number = higher priority in the employee queue */
  queuePriority: number;
};

// ── Thresholds ───────────────────────────────────────────────────────────────
const HIGH_MATCH = 70;
const LOW_MATCH = 45;

// ── Decision helper ───────────────────────────────────────────────────────────
export function deriveJobDecision(params: {
  matchScore: number;
  resumeRecommendation: string | null | undefined;
  resumeCoverageScore?: number | null;
  applyUrl: string | null | undefined;
  matchWarnings?: string[];
}): JobDecision {
  const {
    matchScore,
    resumeRecommendation,
    resumeCoverageScore,
    applyUrl,
    matchWarnings = [],
  } = params;

  // ── Job fit label ─────────────────────────────────────────────────────────
  const jobFitLabel: JobFitLabel =
    matchScore >= HIGH_MATCH ? "High" : matchScore >= LOW_MATCH ? "Medium" : "Low";

  // ── Resume fit label ──────────────────────────────────────────────────────
  const resumeFitLabel: ResumeFitLabel = !resumeRecommendation
    ? "Missing"
    : resumeCoverageScore != null
    ? resumeCoverageScore >= 75
      ? "Strong"
      : resumeCoverageScore >= 55
      ? "Medium"
      : "Weak"
    : resumeRecommendation === "AS_IS"
    ? "Strong"
    : resumeRecommendation === "MINOR_TAILORING"
    ? "Medium"
    : "Weak";

  // ── Location signal ───────────────────────────────────────────────────────
  const hasLocationWarning = matchWarnings.some(
    (w) =>
      w.toLowerCase().includes("location") ||
      w.toLowerCase().includes("onsite") ||
      w.toLowerCase().includes("does not clearly match")
  );

  // ── Core decision tree ────────────────────────────────────────────────────
  let nextAction: NextAction;

  if (matchScore < LOW_MATCH) {
    nextAction = hasLocationWarning ? "wrong-location" : "do-not-apply";
  } else if (!resumeRecommendation) {
    nextAction = "missing-resume-text";
  } else if (matchScore < HIGH_MATCH) {
    // Medium match — if resume already covers all keywords, let them apply as-is
    if (resumeRecommendation === "AS_IS") {
      nextAction = applyUrl ? "apply-as-is" : "find-apply-link";
    } else if (resumeRecommendation === "FULL_REWRITE" || resumeRecommendation === "NEW_VERSION") {
      nextAction = "rewrite-resume";
    } else {
      nextAction = "tailor-resume";
    }
  } else {
    // High match (70%+)
    if (resumeRecommendation === "AS_IS") {
      nextAction = applyUrl ? "apply-as-is" : "find-apply-link";
    } else if (resumeRecommendation === "MINOR_TAILORING") {
      nextAction = "tailor-resume";
    } else {
      // FULL_REWRITE or NEW_VERSION
      nextAction = "rewrite-resume";
    }
  }

  // ── Display metadata ──────────────────────────────────────────────────────
  const ACTION_META: Record<
    NextAction,
    { label: string; tone: JobDecision["actionTone"]; priority: number }
  > = {
    "apply-as-is":        { label: "Apply now",            tone: "brand",    priority: 0 },
    "tailor-resume":      { label: "Tailor resume first",  tone: "signal",   priority: 1 },
    "rewrite-resume":     { label: "Rewrite resume",       tone: "warn",     priority: 2 },
    "find-apply-link":    { label: "Find apply link",      tone: "neutral",  priority: 3 },
    "missing-resume-text":{ label: "Add resume text",      tone: "neutral",  priority: 4 },
    "do-not-apply":       { label: "Poor match — skip",    tone: "danger",   priority: 5 },
    "wrong-location":     { label: "Wrong location",       tone: "danger",   priority: 5 },
  };

  const meta = ACTION_META[nextAction];

  return {
    nextAction,
    jobFitLabel,
    jobFitScore: matchScore,
    resumeFitLabel,
    resumeFitScore: resumeCoverageScore ?? null,
    isEmployeeReady: nextAction === "apply-as-is",
    needsRewrite: nextAction === "rewrite-resume",
    shouldSkip: nextAction === "do-not-apply" || nextAction === "wrong-location",
    actionLabel: meta.label,
    actionTone: meta.tone,
    queuePriority: meta.priority,
  };
}

// Convenience: derive from a plain job-shaped object
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
