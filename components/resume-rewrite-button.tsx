"use client";

import { useState } from "react";
import { Wand2, Copy, Check, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

type State = "idle" | "loading" | "done" | "error";

export function ResumeRewriteButton({ jobId, hasCvText }: { jobId: string; hasCvText: boolean }) {
  const [state, setState] = useState<State>("idle");
  const [resume, setResume] = useState("");
  const [changes, setChanges] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showChanges, setShowChanges] = useState(false);

  if (!hasCvText) {
    return (
      <div className="rounded-md border border-warn/30 bg-[#FFF6EB] px-3 py-2 text-xs text-[#8A4604]">
        No CV text on file for this client — add it in the client profile to enable AI resume rewrite.
      </div>
    );
  }

  async function handleRewrite() {
    setState("loading");
    setResume("");
    setChanges("");
    setError("");
    try {
      const res = await fetch("/api/resume-rewrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId })
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setError(data.error || "Rewrite failed");
        return;
      }
      setResume(data.rewrittenResume);
      setChanges(data.changesSummary);
      setState("done");
    } catch {
      setState("error");
      setError("Network error — try again");
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(resume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      {state !== "done" && (
        <button
          onClick={handleRewrite}
          disabled={state === "loading"}
          className="focus-ring inline-flex items-center gap-2 rounded-md border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-[#12564C] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <Wand2 size={15} className={state === "loading" ? "animate-pulse" : ""} />
          {state === "loading" ? "Rewriting resume with AI…" : "Rewrite Resume for This Job"}
        </button>
      )}

      {state === "loading" && (
        <p className="text-xs text-muted">This takes ~15 seconds. Claude Haiku is tailoring the resume to this job description.</p>
      )}

      {state === "error" && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {state === "done" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Tailored resume — ready to use</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
              >
                {copied ? <><Check size={12} className="text-brand" /> Copied!</> : <><Copy size={12} /> Copy resume</>}
              </button>
              <button
                onClick={handleRewrite}
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
              >
                <Wand2 size={12} /> Regenerate
              </button>
            </div>
          </div>

          <textarea
            readOnly
            value={resume}
            rows={20}
            className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-xs font-mono leading-5 text-ink resize-y focus:outline-none"
          />

          {changes && (
            <div>
              <button
                onClick={() => setShowChanges((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink transition-colors"
              >
                {showChanges ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showChanges ? "Hide" : "Show"} what changed
              </button>
              {showChanges && (
                <div className="mt-2 rounded-md border border-line bg-canvas px-3 py-2 text-xs text-muted whitespace-pre-wrap leading-5">
                  {changes}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted">
            ⚠ Always review before use. AI may rephrase experience — verify accuracy before submitting to employer.
          </p>
        </div>
      )}
    </div>
  );
}
