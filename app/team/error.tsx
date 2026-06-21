"use client";

import { useEffect } from "react";

export default function TeamError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/team error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <div className="text-2xl mb-2">⚠</div>
        <h2 className="text-lg font-semibold text-red-800">Dashboard failed to load</h2>
        <p className="mt-2 text-sm text-red-600">{error.message || "An unexpected error occurred."}</p>
        {error.digest && (
          <p className="mt-1 text-xs text-red-400">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
