// Composite case-file data fetch — the pure, testable core behind
// `useCaseFileData` (ADR-0009).
//
// This module is deliberately React-free so it loads under the repo's unit
// harness (`tsx --test` over `src/**/*.test.ts`, node:test). The hook itself
// lives in ./useCaseFileData.ts, which imports React; importing React into the
// test would fail because the test environment has no installed React. Keeping
// the fetch/cache logic here lets the parallel-fetch + cache behaviour be
// unit-tested with no jsdom / React Testing Library, exactly as the ADR intends.
//
// The data layer (`@/lib/data`) is reached through a LAZY dynamic import behind
// an injectable `sources` seam — never a static import — because `@/lib/data`
// transitively pulls in `server-only` (cases.ts → saved-cases.ts →
// petitions.ts), which is unresolvable under the test runner. Tests inject pure
// stubs so the dynamic import is never triggered. This mirrors the repo's
// established testable-boundary convention (executeAiOperation, authorizeRoute).

import { type CaseFact, type CaseTask } from "./types";

/** The three case-file sources, resolved concurrently into one shape. */
export interface CaseFileData {
  caseFacts: readonly CaseFact[];
  tasks: readonly CaseTask[];
  excerpt: string;
}

/**
 * The data-layer functions this fetch depends on. Injectable so the logic is
 * testable without loading the server-only `@/lib/data` chain. Note: per
 * ADR-0009 the underlying `@/lib/data` signatures are NOT changed to accept a
 * `caseId` in this increment — `caseId` is plumbed through the hook/cache key
 * to pre-wire the future multi-case seam only.
 */
export interface CaseFileDataSources {
  getCaseFacts: () => Promise<readonly CaseFact[]>;
  getOutstandingTasks: () => Promise<readonly CaseTask[]>;
  getPetitionExcerpt: () => Promise<string>;
}

// Lazily import the real data layer only when no sources are injected. Keeps
// the static module graph free of `server-only` so tests load.
async function defaultSources(): Promise<CaseFileDataSources> {
  const data = await import("@/lib/data");
  return {
    getCaseFacts: data.getCaseFacts,
    getOutstandingTasks: data.getOutstandingTasks,
    getPetitionExcerpt: data.getPetitionExcerpt,
  };
}

// Module-level promise cache keyed by caseId, so sibling components and
// remounts share ONE in-flight (or settled) request instead of refetching.
const cache = new Map<string, Promise<CaseFileData>>();

function keyFor(caseId?: string): string {
  return caseId ?? "__default__";
}

/**
 * Fetch the three case-file sources concurrently (`Promise.all`) and return one
 * unified object. Memoised per `caseId`; a rejected fetch is evicted so a later
 * call can retry. `sources` is for tests/DI — production callers omit it.
 */
export function fetchCaseFileData(
  caseId?: string,
  sources?: CaseFileDataSources,
): Promise<CaseFileData> {
  const key = keyFor(caseId);
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const src = sources ?? (await defaultSources());
    const [caseFacts, tasks, excerpt] = await Promise.all([
      src.getCaseFacts(),
      src.getOutstandingTasks(),
      src.getPetitionExcerpt(),
    ]);
    return { caseFacts, tasks, excerpt };
  })();

  // Evict on failure so the next call retries rather than re-serving the error.
  promise.catch(() => {
    if (cache.get(key) === promise) cache.delete(key);
  });

  cache.set(key, promise);
  return promise;
}

/** Drop all cached fetches. Test-only seam for isolation between cases. */
export function clearCaseFileDataCache(): void {
  cache.clear();
}
