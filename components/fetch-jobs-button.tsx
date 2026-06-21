"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

type State = "idle" | "loading" | "success" | "error";

export function FetchJobsButton() {
  const [state, setState] = useState<State>("idle");
  const [summary, setSummary] = useState<string>("");

  async function handleFetch() {
    setState("loading");
    setSummary("");
    try {
      const res = await fetch("/api/cron/fetch-jobs", {
        method: "GET",
        headers: { "x-triggered-from-ui": "1" }
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setSummary(data.error || "Fetch failed");
        return;
      }
      setState("success");
      setSummary(
        `${data.jobsSaved ?? 0} new jobs saved · ${data.jobsFetched ?? 0} fetched · ${data.duplicatesSkipped ?? 0} duplicates skipped`
      );
      // Refresh page data after a short delay
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setState("error");
      setSummary("Network error — check console");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleFetch}
        disabled={state === "loading"}
        className="focus-ring inline-flex items-center gap-2 rounded-md border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-[#12564C] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw size={15} className={state === "loading" ? "animate-spin" : ""} />
        {state === "loading" ? "Fetching jobs…" : "Fetch Jobs Now"}
      </button>

      {state === "success" && (
        <div className="flex items-center gap-1.5 text-xs text-brand">
          <CheckCircle size={12} /> {summary}
        </div>
      )}
      {state === "error" && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle size={12} /> {summary}
        </div>
      )}
    </div>
  );
}
