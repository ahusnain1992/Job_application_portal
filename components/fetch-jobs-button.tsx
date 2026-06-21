"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, AlertTriangle, Clock } from "lucide-react";

const COOLDOWN_HOURS = 6;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

type State = "idle" | "cooldown" | "loading" | "success" | "error";

function formatTimeLeft(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function FetchJobsButton({ lastRunAt }: { lastRunAt: string | null }) {
  const [state, setState] = useState<State>("idle");
  const [summary, setSummary] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!lastRunAt) return;

    function tick() {
      const elapsed = Date.now() - new Date(lastRunAt!).getTime();
      const remaining = COOLDOWN_MS - elapsed;
      if (remaining > 0) {
        setTimeLeft(remaining);
        setState("cooldown");
      } else {
        setTimeLeft(0);
        setState((s) => (s === "cooldown" ? "idle" : s));
      }
    }

    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [lastRunAt]);

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
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      setState("error");
      setSummary("Network error — check console");
    }
  }

  const isCooldown = state === "cooldown";
  const isLoading = state === "loading";
  const disabled = isCooldown || isLoading;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={!disabled ? handleFetch : undefined}
        disabled={disabled}
        title={isCooldown ? `Next fetch available in ${formatTimeLeft(timeLeft)}` : "Fetch jobs from all sources"}
        className="focus-ring inline-flex items-center gap-2 rounded-md border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-[#12564C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isCooldown ? <Clock size={15} /> : <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />}
        {isLoading ? "Fetching jobs…" : isCooldown ? `Next fetch in ${formatTimeLeft(timeLeft)}` : "Fetch Jobs Now"}
      </button>

      {isCooldown && (
        <div className="text-xs text-muted">6-hour cooldown · controls Apify spend</div>
      )}
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
