"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";

export function DismissFlagButton({ applicationId }: { applicationId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleDismiss() {
    setState("loading");
    try {
      const res = await fetch(`/api/applications/${applicationId}/dismiss-flag`, { method: "POST" });
      if (res.ok) {
        setState("done");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="flex items-center gap-1 rounded-md border border-brand/30 bg-[#ECF7F4] px-3 py-1.5 text-xs text-[#186A5E]">
        <CheckCircle size={12} /> Flag dismissed
      </div>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3">
      <p className="text-xs text-red-700 mb-2">
        <strong>Flag review required.</strong> This application was submitted in under 1 minute, which may indicate the employee did not properly apply. Review with the employee before dismissing.
      </p>
      <button
        onClick={state === "idle" ? handleDismiss : undefined}
        disabled={state === "loading"}
        className="inline-flex items-center gap-1.5 rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {state === "loading" ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
        {state === "loading" ? "Dismissing…" : "Mark as reviewed — dismiss flag"}
      </button>
    </div>
  );
}
