"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function QueueRefresh({ intervalMs = 300_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setRefreshing(true);
      router.refresh();
      setLastRefresh(new Date());
      setTimeout(() => setRefreshing(false), 1000);
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  function manualRefresh() {
    setRefreshing(true);
    router.refresh();
    setLastRefresh(new Date());
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <button
      onClick={manualRefresh}
      title={`Last updated ${lastRefresh.toLocaleTimeString()}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-muted hover:bg-canvas hover:text-ink transition-colors"
    >
      <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
}
