/**
 * One-shot cross-page prefill for the Instant Verdict → full screening handoff.
 *
 * The anonymous hero screener (<InstantVerdict>) stashes the just-entered
 * profile in sessionStorage; the authenticated <QualifyPanel> reads it ONCE on
 * mount so "go deeper" carries everything over and nothing is re-typed. Pure and
 * client-safe (storage is injectable), so the read/write contract is unit-tested
 * without a DOM and can't drift between the writer and the reader.
 */

export const QUALIFY_PREFILL_KEY = "instantVerdict:prefill";

/** The canonical demo CV behind the "Use a sample" buttons on every screening
 *  surface (QualifyPanel, InstantVerdict, BestPathFinder) — ONE copy so an edit
 *  to the sample can't diverge between them. */
export const SAMPLE_PROFILE =
  "Senior research engineer. 6 peer-reviewed papers (412 citations), best-paper " +
  "award at a top ML conference, one granted US patent. Featured in TechCrunch. " +
  "Founding engineer at a Series B startup; $320K salary plus equity.";

export interface QualifyPrefill {
  name: string;
  profile: string;
  classification: string;
}

function defaultStorage(): Storage | undefined {
  return typeof sessionStorage !== "undefined" ? sessionStorage : undefined;
}

/**
 * Read and CLEAR the stashed prefill (one-shot, so a refresh of /qualify doesn't
 * keep re-filling). Returns null when absent, unreadable, or malformed.
 */
export function readQualifyPrefill(storage?: Storage): QualifyPrefill | null {
  const store = storage ?? defaultStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(QUALIFY_PREFILL_KEY);
    if (!raw) return null;
    store.removeItem(QUALIFY_PREFILL_KEY);
    const obj = JSON.parse(raw) as Partial<QualifyPrefill> | null;
    if (!obj || typeof obj.profile !== "string") return null;
    return {
      name: typeof obj.name === "string" ? obj.name : "",
      profile: obj.profile,
      classification:
        typeof obj.classification === "string" ? obj.classification : "O-1A",
    };
  } catch {
    return null;
  }
}

/** Stash the prefill for the next /qualify visit. Best-effort: a disabled/full
 *  storage just means the field carries over within the page session only. */
export function writeQualifyPrefill(
  prefill: QualifyPrefill,
  storage?: Storage,
): void {
  const store = storage ?? defaultStorage();
  if (!store) return;
  try {
    store.setItem(QUALIFY_PREFILL_KEY, JSON.stringify(prefill));
  } catch {
    /* storage unavailable / quota — prefill is a convenience, never required */
  }
}
