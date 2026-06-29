"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  type CaseQuery,
  type CaseSortKey,
  type SortDirection,
  DEFAULT_CASE_QUERY,
} from "./case-list";
import { CLASSIFICATION_OPTIONS, STATUS_OPTIONS } from "./types";
import { createLocalStorageStore } from "@/lib/createLocalStorageStore";

// Persist the case-list query (search + filters + sort) to localStorage,
// exposed through useSyncExternalStore via the shared createLocalStorageStore
// factory. The server snapshot is the default query (no hydration mismatch);
// the client snapshot reads + sanitizes localStorage. Writes are best-effort
// (private modes can throw) and notify subscribers so every consumer stays in
// sync within the tab.

const STORAGE_KEY = "atelier-case-query";
const EVENT = "atelier-case-query-change";

const SORT_KEYS: readonly CaseSortKey[] = [
  "fileNumber",
  "likelihood",
  "targetDate",
  "status",
];
const SORT_DIRS: readonly SortDirection[] = ["asc", "desc"];
/** Coerce unknown (possibly stale/tampered) storage into a valid CaseQuery. */
function sanitize(raw: unknown): CaseQuery {
  if (typeof raw !== "object" || raw === null) return DEFAULT_CASE_QUERY;
  const r = raw as Record<string, unknown>;
  return {
    search: typeof r.search === "string" ? r.search : DEFAULT_CASE_QUERY.search,
    classification: CLASSIFICATION_OPTIONS.includes(r.classification as never)
      ? (r.classification as CaseQuery["classification"])
      : DEFAULT_CASE_QUERY.classification,
    status: STATUS_OPTIONS.includes(r.status as never)
      ? (r.status as CaseQuery["status"])
      : DEFAULT_CASE_QUERY.status,
    sortKey: SORT_KEYS.includes(r.sortKey as never)
      ? (r.sortKey as CaseSortKey)
      : DEFAULT_CASE_QUERY.sortKey,
    sortDir: SORT_DIRS.includes(r.sortDir as never)
      ? (r.sortDir as SortDirection)
      : DEFAULT_CASE_QUERY.sortDir,
  };
}

/** Parse the stored raw string into a sanitized CaseQuery (default on miss). */
function parse(raw: string | null): CaseQuery {
  if (!raw) return DEFAULT_CASE_QUERY;
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_CASE_QUERY;
  }
}

const store = createLocalStorageStore<CaseQuery>({
  key: STORAGE_KEY,
  eventName: EVENT,
  defaultValue: DEFAULT_CASE_QUERY,
  parse,
  serialize: (query) => JSON.stringify(query),
});

export function usePersistentQuery(): {
  query: CaseQuery;
  setQuery: (patch: Partial<CaseQuery>) => void;
  reset: () => void;
} {
  const query = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const setQuery = useCallback(
    (patch: Partial<CaseQuery>) => store.write({ ...query, ...patch }),
    [query],
  );

  const reset = useCallback(() => store.write(DEFAULT_CASE_QUERY), []);

  return { query, setQuery, reset };
}
