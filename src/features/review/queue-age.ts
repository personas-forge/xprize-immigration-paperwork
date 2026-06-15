/**
 * Pure presentation-layer helpers for attorney review queue age badges.
 * All functions take explicit `nowMs` so they are deterministic in tests.
 * No wall-clock dependency, no DB, no store — safe to import anywhere.
 */

export type AgeBucket = "fresh" | "warning" | "overdue";

export type BadgeTone = "success" | "warning" | "danger";

export const BUCKET_TONE: Record<AgeBucket, BadgeTone> = {
  fresh: "success",
  warning: "warning",
  overdue: "danger",
};

const H = 3_600_000; // ms per hour

/**
 * Classify a queue item's age into a badge bucket.
 * Returns null for unparseable or future timestamps.
 *  fresh   — age < 12h
 *  warning — 12h ≤ age ≤ 24h
 *  overdue — age > 24h
 */
export function ageBucket(
  submittedAtIso: string | null | undefined,
  nowMs: number,
): AgeBucket | null {
  if (!submittedAtIso) return null;
  const ms = Date.parse(submittedAtIso);
  if (isNaN(ms)) return null;
  const ageMs = nowMs - ms;
  if (ageMs < 0) return null; // future timestamp
  if (ageMs < 12 * H) return "fresh";
  if (ageMs <= 24 * H) return "warning";
  return "overdue";
}

/**
 * Compact human label for elapsed time, e.g. "45m", "3h", "2d 4h".
 * Returns null for unparseable or future timestamps.
 */
export function formatAge(
  submittedAtIso: string | null | undefined,
  nowMs: number,
): string | null {
  if (!submittedAtIso) return null;
  const ms = Date.parse(submittedAtIso);
  if (isNaN(ms)) return null;
  const ageMs = nowMs - ms;
  if (ageMs < 0) return null;
  const totalMins = Math.floor(ageMs / 60_000);
  const totalHours = Math.floor(ageMs / H);
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  if (days > 0) return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  if (totalHours > 0) return `${totalHours}h`;
  return `${Math.max(totalMins, 1)}m`;
}

/**
 * Sort a list of queue items oldest-first by submittedAt, non-mutating.
 * Items with null/unparseable timestamps sort last.
 */
export function sortOldestFirst<T extends { submittedAt: string | null }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const ta = a.submittedAt ? Date.parse(a.submittedAt) : Infinity;
    const tb = b.submittedAt ? Date.parse(b.submittedAt) : Infinity;
    return ta - tb;
  });
}
