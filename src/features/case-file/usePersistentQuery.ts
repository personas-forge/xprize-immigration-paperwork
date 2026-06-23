"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  type CaseQuery,
  type CaseSortKey,
  type SortDirection,
  DEFAULT_CASE_QUERY,
} from "./case-list";
import { CLASSIFICATION_OPTIONS, STATUS_OPTIONS } from "./types";

// Persist the case-list query (search + filters + sort) to localStorage via
// useSyncExternalStore — the same FOUC-free, lint-clean pattern the theme
// toggle uses. The server snapshot is the default query (no hydration
// mismatch); the client snapshot reads localStorage. Writes are best-effort
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

// Cache the parsed query so getSnapshot returns a stable reference between
// writes — useSyncExternalStore requires snapshot identity to be stable.
let cache: { raw: string | null; value: CaseQuery } = {
  raw: null,
  value: DEFAULT_CASE_QUERY,
};

function parse(raw: string | null): CaseQuery {
  if (!raw) return DEFAULT_CASE_QUERY;
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_CASE_QUERY;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): CaseQuery {
  const raw = readRaw();
  if (raw !== cache.raw) {
    cache = { raw, value: parse(raw) };
  }
  return cache.value;
}

function getServerSnapshot(): CaseQuery {
  return DEFAULT_CASE_QUERY;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function write(next: CaseQuery): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Persistence failed (private mode / quota). Don't notify subscribers:
    // getSnapshot re-reads localStorage, so a change event here would just make
    // them re-render the OLD value. The session continues without persistence.
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePersistentQuery(): {
  query: CaseQuery;
  setQuery: (patch: Partial<CaseQuery>) => void;
  reset: () => void;
} {
  const query = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setQuery = useCallback(
    (patch: Partial<CaseQuery>) => write({ ...query, ...patch }),
    [query],
  );

  const reset = useCallback(() => write(DEFAULT_CASE_QUERY), []);

  return { query, setQuery, reset };
}
