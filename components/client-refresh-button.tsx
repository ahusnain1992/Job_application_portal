"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertTriangle, Clock } from "lucide-react";

type State = "idle" | "loading" | "success" | "error" | "cooldown";

export function ClientRefreshButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

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

  const isLoading = state === "loading";
  const isCooldown = state === "cooldown";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={!isLoading && !isCooldown ? handleRefresh : undefined}
        disabled={isLoading || isCooldown}
        className="focus-ring inline-flex items-center gap-2 rounded-md border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#12564C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isCooldown
          ? <><Clock size={13} /> Recently refreshed</>
          : <><RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            {isLoading ? "Fetching jobs…" : "Refresh Jobs"}</>
        }
      </button>
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
    </div>
  );
}
