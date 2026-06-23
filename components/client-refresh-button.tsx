"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertTriangle, Clock, Trash2 } from "lucide-react";

type State = "idle" | "loading" | "success" | "error" | "cooldown";

export function ClientRefreshButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [resetting, setResetting] = useState(false);

  async function handleRefresh() {
    setState("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/clients/${clientId}/refresh-jobs`, { method: "POST" });
      const data = await res.json();

      if (res.status === 429) {
        setState("cooldown");
        setMessage(data.error || "Please wait before refreshing again.");
        return;
      }
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Refresh failed");
        return;
      }
      setState("success");
      setMessage(`${data.jobsSaved ?? 0} new jobs found for ${clientName}`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setState("error");
      setMessage("Network error — try again");
    }
  }

  async function handleReset() {
    if (!confirm(`Delete all suggested jobs for ${clientName} and start fresh?\n\nOnly SUGGESTED jobs will be removed. Applied/approved jobs are kept.`)) return;
    setResetting(true);
    setMessage("");
    try {
      const res = await fetch(`/api/clients/${clientId}/reset-jobs`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Reset failed");
        setResetting(false);
        return;
      }
      setMessage(`Cleared ${data.deleted} jobs — fetching fresh…`);
      // Auto-trigger a fresh fetch after reset
      const refreshRes = await fetch(`/api/clients/${clientId}/refresh-jobs`, { method: "POST" });
      const refreshData = await refreshRes.json();
      if (refreshRes.ok) {
        setMessage(`Reset complete — ${refreshData.jobsSaved ?? 0} fresh jobs fetched`);
      }
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setMessage("Network error during reset");
    } finally {
      setResetting(false);
    }
  }

  const isLoading = state === "loading";
  const isCooldown = state === "cooldown";
  const busy = isLoading || resetting;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          onClick={!busy && !isCooldown ? handleRefresh : undefined}
          disabled={busy || isCooldown}
          className="focus-ring inline-flex items-center gap-2 rounded-md border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#12564C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCooldown
            ? <><Clock size={13} /> Recently refreshed</>
            : <><RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              {isLoading ? "Fetching jobs…" : "Refresh Jobs"}</>
          }
        </button>

        <button
          onClick={!busy ? handleReset : undefined}
          disabled={busy}
          title="Delete all suggested jobs and fetch fresh — use when jobs are irrelevant"
          className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 size={13} className={resetting ? "animate-spin" : ""} />
          {resetting ? "Resetting…" : "Reset & Refresh"}
        </button>
      </div>

      {state === "success" && (
        <div className="flex items-center gap-1 text-xs text-brand">
          <CheckCircle size={11} /> {message}
        </div>
      )}
      {(state === "error" || state === "cooldown") && (
        <div className="flex items-center gap-1 text-xs text-warn">
          <AlertTriangle size={11} /> {message}
        </div>
      )}
      {message && resetting === false && state === "idle" && (
        <div className="flex items-center gap-1 text-xs text-brand">
          <CheckCircle size={11} /> {message}
        </div>
      )}
    </div>
  );
}
