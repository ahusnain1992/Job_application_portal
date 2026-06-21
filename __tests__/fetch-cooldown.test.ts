import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

function isCoolingDown(lastRunAt: string | null): boolean {
  if (!lastRunAt) return false;
  return Date.now() - new Date(lastRunAt).getTime() < COOLDOWN_MS;
}

function timeLeftMs(lastRunAt: string | null): number {
  if (!lastRunAt) return 0;
  const elapsed = Date.now() - new Date(lastRunAt).getTime();
  return Math.max(0, COOLDOWN_MS - elapsed);
}

function formatTimeLeft(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

describe("fetch cooldown logic", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("not cooling down when lastRunAt is null", () => {
    expect(isCoolingDown(null)).toBe(false);
  });

  it("cooling down immediately after a run", () => {
    const now = new Date().toISOString();
    expect(isCoolingDown(now)).toBe(true);
  });

  it("cooling down 5 hours after a run", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(isCoolingDown(fiveHoursAgo)).toBe(true);
  });

  it("not cooling down exactly 6 hours after a run", () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    expect(isCoolingDown(sixHoursAgo)).toBe(false);
  });

  it("not cooling down 7 hours after a run", () => {
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    expect(isCoolingDown(sevenHoursAgo)).toBe(false);
  });

  it("timeLeftMs returns ~6h when just run", () => {
    const now = new Date().toISOString();
    const left = timeLeftMs(now);
    expect(left).toBeGreaterThan(COOLDOWN_MS - 1000);
    expect(left).toBeLessThanOrEqual(COOLDOWN_MS);
  });

  it("timeLeftMs returns 0 when cooldown expired", () => {
    const oldRun = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    expect(timeLeftMs(oldRun)).toBe(0);
  });

  it("timeLeftMs returns 0 when lastRunAt is null", () => {
    expect(timeLeftMs(null)).toBe(0);
  });

  it("formatTimeLeft shows hours and minutes for > 60 min", () => {
    expect(formatTimeLeft(3 * 60 * 60 * 1000 + 22 * 60 * 1000)).toBe("3h 22m");
    expect(formatTimeLeft(1 * 60 * 60 * 1000)).toBe("1h 0m");
  });

  it("formatTimeLeft shows only minutes when < 1 hour", () => {
    expect(formatTimeLeft(45 * 60 * 1000)).toBe("45m");
    expect(formatTimeLeft(5 * 60 * 1000)).toBe("5m");
  });

  it("formatTimeLeft handles 0", () => {
    expect(formatTimeLeft(0)).toBe("0m");
  });
});
