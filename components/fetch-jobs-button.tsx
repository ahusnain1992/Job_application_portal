"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, AlertTriangle, Clock, Zap } from "lucide-react";

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
      const providerLines = data.providerStats
        ? Object.entries(data.providerStats as Record<string, { fetched: number; error?: string }>)
            .map(([name, s]) => s.error ? `${name}: ❌ ${s.error.slice(0, 80)}` : `${name}: ${s.fetched} jobs`)
            .join(" | ")
        : "";
      setSummary(
        `${data.jobsSaved ?? 0} saved · ${data.jobsFetched ?? 0} fetched · ${data.filteredOut ?? 0} filtered · ${data.noApplyLink ?? 0} no-link · ${data.duplicatesSkipped ?? 0} dupes${providerLines ? " — " + providerLines : ""}${data.errors?.length ? " ⚠ " + data.errors.slice(0, 3).join("; ") : ""}`
      );
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      setState("error");
      setSummary("Network error — check console");
    }
  }

  const isCooldown = state === "cooldown";
  const isLoading = state === "loading";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {/* Primary button — disabled during cooldown */}
        <button
          onClick={!isLoading && !isCooldown ? handleFetch : undefined}
          disabled={isLoading || isCooldown}
          title={isCooldown ? "Cooldown active — use Force Refresh to override" : "Fetch new jobs from all sources"}
          className="focus-ring inline-flex items-center gap-2 rounded-md border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-[#12564C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCooldown ? <Clock size={15} /> : <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />}
          {isLoading ? "Fetching jobs…" : isCooldown ? `Cooldown — ${formatTimeLeft(timeLeft)} left` : "Fetch Jobs Now"}
        </button>

        {/* Force refresh — always available to admin, bypasses client-side cooldown timer */}
        {isCooldown && !isLoading && (
          <button
            onClick={handleFetch}
            title="Force refresh now — bypasses the 6-hour cooldown. Will use Apify/Adzuna API credits."
            className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-warn/60 bg-[#FFF6EB] px-3 py-2 text-xs font-semibold text-[#8A4604] hover:bg-[#FFECD0] transition-colors"
          >
            <Zap size={12} />
            Force refresh
          </button>
        )}
      </div>

      {isCooldown && !isLoading && (
        <div className="text-xs text-muted text-right">
          6-hour cooldown active · Force refresh uses API credits
        </div>
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
