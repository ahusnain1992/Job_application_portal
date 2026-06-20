"use client";

import { useState } from "react";
import { Copy, Check, Send } from "lucide-react";

type Props = {
  jobId: string;
  hasWebhook: boolean;
};

export function ResumeHandoffButton({ jobId, hasWebhook }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleClick() {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/resume-handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed");
      }
      const data = await res.json() as { payload: string; webhookSent?: boolean };

      // Always copy to clipboard
      await navigator.clipboard.writeText(data.payload);

      setState(data.webhookSent ? "sent" : "copied");
      setTimeout(() => setState("idle"), 4000);
    } catch (err) {
      setErrorMsg(String(err));
      setState("error");
      setTimeout(() => setState("idle"), 5000);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        className="focus-ring inline-flex items-center gap-2 rounded-md border border-warn/50 bg-[#FFF6EB] px-3 py-2 text-sm font-medium text-[#8A4604] hover:bg-[#FDEBD0] disabled:opacity-50"
      >
        {state === "loading" ? (
          <span className="animate-spin">⋯</span>
        ) : state === "copied" || state === "sent" ? (
          <Check size={14} />
        ) : hasWebhook ? (
          <Send size={14} />
        ) : (
          <Copy size={14} />
        )}
        {state === "loading" ? "Preparing…"
          : state === "copied" ? "Copied to clipboard!"
          : state === "sent" ? "Sent to resume builder!"
          : state === "error" ? "Error — try again"
          : hasWebhook ? "Send to Resume Builder"
          : "Copy Resume Builder Payload"}
      </button>
      {state === "error" && errorMsg && (
        <p className="mt-1 text-xs text-red-600">{errorMsg}</p>
      )}
      {(state === "copied" || state === "sent") && (
        <p className="mt-1 text-xs text-muted">
          {state === "sent"
            ? "Payload sent to resume builder webhook and copied to clipboard."
            : "Paste this into your resume builder tool."}
        </p>
      )}
    </div>
  );
}
