"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteResumeButton({ resumeId, resumeName }: {
  resumeId: string;
  resumeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/resumes/${resumeId}/delete`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Delete failed.");
        setLoading(false);
        return;
      }
      setOpen(false);
      window.location.reload();
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-red-500 hover:text-red-700 hover:underline"
        title="Delete resume"
      >
        <Trash2 size={12} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-line bg-white p-6 shadow-xl">
            <div className="text-base font-semibold text-ink">Delete resume?</div>
            <p className="mt-2 text-sm text-muted">
              Delete <strong>{resumeName}</strong>? This cannot be undone. Resumes linked to existing applications cannot be deleted.
            </p>
            {error && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => { setOpen(false); setError(null); }}
                disabled={loading}
                className="flex-1 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
