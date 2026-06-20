"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function ApplyButton({
  jobId,
  applyUrl,
  isApplied,
  alreadyAppliedByOther,
  appliedByName
}: {
  jobId: string;
  applyUrl: string | null;
  isApplied: boolean;
  alreadyAppliedByOther: boolean;
  appliedByName?: string | null;
}) {
  const [loading, setLoading] = useState(false);

  if (alreadyAppliedByOther) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-brand/30 bg-[#ECF7F4] px-4 py-2 text-sm font-semibold text-[#186A5E]">
        <ShieldCheck size={15} /> Applied by {appliedByName}
      </div>
    );
  }

  if (!applyUrl) return null;

  async function handleOpen() {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        blocked?: boolean;
        warning?: string;
        reason?: string;
        applyUrl?: string;
      };

      if (data.blocked) {
        alert(data.reason || "This job has already been applied to.");
        return;
      }
      if (data.warning) {
        const proceed = confirm(`${data.warning}\n\nDo you still want to open the job?`);
        if (!proceed) return;
      }
      window.open(applyUrl!, "_blank", "noopener,noreferrer");
    } catch {
      window.open(applyUrl!, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleOpen}
      disabled={loading}
      className="focus-ring inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-[#12564C] disabled:opacity-60"
    >
      {loading ? "Opening..." : "Open job & start applying"} <ExternalLink size={15} />
    </button>
  );
}
