/**
 * Pure, composited case-file fetch (ADR-0009).
 *
 * The case dashboard used to issue independent `useEffect` fetches —
 * `getCaseFacts` (CaseFileDashboard), `getOutstandingTasks` /
 * `getPetitionExcerpt` (SidePanels), and `getCriteria` (CriteriaTable) — each
 * with its own loading state. This module collapses them into ONE concurrent
 * `Promise.all` behind a module-level promise cache, exposing a single
 * `{ caseFacts, tasks, petitionExcerpt, criteria }` snapshot.
 *
 * Why this file has no `@/lib/data` import: the test harness is `tsx --test`
 * (node:test) with no jsdom/RTL, so a hook can't be rendered in a unit test.
 * The fetch logic is therefore factored out as a pure, dependency-injected
 * function and tested directly; the thin `useCaseFileData` wrapper supplies the
 * real `@/lib/data` functions. (See ADR-0009 / usePersistentQuery for the
 * native-React, no-new-dependency convention.)
 */
import { type CaseFact, type CaseTask, type Criterion } from "./types";

/** The unified snapshot every case-file consumer reads from. */
export interface CaseFileData {
  caseFacts: readonly CaseFact[];
  tasks: readonly CaseTask[];
  petitionExcerpt: string;
  criteria: readonly Criterion[];
}

/**
 * The three data-layer reads, injected so the pure fetch stays decoupled from
 * the server-only `@/lib/data` boundary (and thus unit-testable). `caseId` is
 * plumbed through for the eventual per-case data source, but the current
 * in-memory fixtures ignore it — signatures are intentionally unchanged.
 */
export interface CaseFileDataDeps {
  getCaseFacts: (caseId?: string) => Promise<readonly CaseFact[]>;
  getOutstandingTasks: (caseId?: string) => Promise<readonly CaseTask[]>;
  getPetitionExcerpt: (caseId?: string) => Promise<string>;
  getCriteria: (caseId?: string) => Promise<readonly Criterion[]>;
}

// Module-level promise cache keyed by case. Two consumers mounting in the same
// tick (e.g. the dashboard header + the side panels) share ONE in-flight
// Promise.all instead of racing three fetches each. A rejected fetch is evicted
// so a later mount can retry rather than re-throwing a stale failure.
const LIVE_KEY = "__live__";

interface CacheEntry {
  data: Promise<CaseFileData>;
  at: number;
}
const cache = new Map<string, CacheEntry>();

// A SUCCESSFUL fetch was previously pinned for the whole SPA session (evict only
// on rejection), so once the fixtures become real per-case reads, a user who
// mutates evidence/criteria and returns to the dashboard would see pre-mutation
// data until a full reload. Two invalidation seams guard that:
//   • a short TTL auto-expires entries (a safety net if a write path forgets), and
//   • clearCaseFileDataCache(caseId?) for explicit busting from mutation actions.
const CACHE_TTL_MS = 30_000;

/**
 * Fetch the three case-file data sources concurrently and return the unified
 * snapshot. Idempotent per `caseId` within the TTL via the module cache.
 */
export function fetchCaseFileData(
  deps: CaseFileDataDeps,
  caseId?: string,
): Promise<CaseFileData> {
  const key = caseId ?? LIVE_KEY;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const pending = Promise.all([
    deps.getCaseFacts(caseId),
    deps.getOutstandingTasks(caseId),
    deps.getPetitionExcerpt(caseId),
    deps.getCriteria(caseId),
  ]).then(
    ([caseFacts, tasks, petitionExcerpt, criteria]): CaseFileData => ({
      caseFacts,
      tasks,
      petitionExcerpt,
      criteria,
    }),
  );

  // Evict on failure so the cache never pins a rejected promise.
  pending.catch(() => cache.delete(key));
  cache.set(key, { data: pending, at: Date.now() });
  return pending;
}

/**
 * Bust cached fetches. Pass a `caseId` to invalidate that case (the LIVE board
 * uses the no-arg key); omit it to clear everything (tests / forced refresh).
 * Any write path that mutates a case's facts/tasks/criteria/evidence should call
 * this for the affected case so the dashboard doesn't serve a stale snapshot.
 */
export function clearCaseFileDataCache(caseId?: string): void {
  if (caseId === undefined) cache.clear();
  else cache.delete(caseId);
}
