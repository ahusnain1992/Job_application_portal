"use client";

import { useState } from "react";
import { Check, Copy, FileText } from "lucide-react";

export function CoverLetterButton({ jobId }: { jobId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [coverLetter, setCoverLetter] = useState("");
  const [error, setError] = useState("");

  async function handleGenerate() {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Could not generate cover letter");
      }

      const data = await res.json() as { coverLetter: string };
      setCoverLetter(data.coverLetter);
      await navigator.clipboard.writeText(data.coverLetter);
      setState("copied");
      setTimeout(() => setState("idle"), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate cover letter");
      setState("error");
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={state === "loading"}
        className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-60"
      >
        {state === "loading" ? (
          <span className="animate-spin">...</span>
        ) : state === "copied" ? (
          <Check size={14} />
        ) : coverLetter ? (
          <Copy size={14} />
        ) : (
          <FileText size={14} />
        )}
        {state === "loading" ? "Writing..." : state === "copied" ? "Copied!" : coverLetter ? "Copy cover letter again" : "Write cover letter"}
      </button>

      {state === "error" && error ? <p className="text-xs text-red-600">{error}</p> : null}
      {state === "copied" ? (
        <p className="text-xs text-muted">Cover letter copied. Paste it into the job application, then paste the final submitted version into the form below.</p>
      ) : null}
      {coverLetter ? (
        <textarea
          readOnly
          value={coverLetter}
          className="min-h-56 w-full rounded-md border border-line bg-canvas px-3 py-2 text-xs leading-5 text-ink"
        />
      ) : null}
    </div>
  );
}
