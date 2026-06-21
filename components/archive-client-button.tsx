"use client";

import { useState } from "react";
import { Archive, RotateCcw } from "lucide-react";

export function ArchiveClientButton({
  clientId,
  clientName,
  currentStatus,
}: {
  clientId: string;
  clientName: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isActive = status === "ACTIVE";

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/archive`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status);
        setConfirming(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5">
        <span className="text-xs text-red-700">
          {isActive ? `Archive ${clientName}?` : `Reactivate ${clientName}?`}
        </span>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
        >
          {loading ? "…" : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
    >
      {isActive ? <><Archive size={12} /> Archive</> : <><RotateCcw size={12} /> Reactivate</>}
    </button>
  );
}
