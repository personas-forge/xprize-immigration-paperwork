"use client";

import { useCallback, useEffect, useState } from "react";
import { getCaseFacts, getCriteria, getOutstandingTasks, getPetitionExcerpt } from "@/lib/data";
import {
  type CaseFileData,
  type CaseFileDataDeps,
  clearCaseFileDataCache,
  fetchCaseFileData,
} from "./caseFileData";

export { type CaseFileData } from "./caseFileData";

/** The real data-layer reads — the single place the hook touches `@/lib/data`. */
const liveDeps: CaseFileDataDeps = {
  getCaseFacts,
  getOutstandingTasks,
  getPetitionExcerpt,
  getCriteria,
};

export interface CaseFileDataState {
  data: CaseFileData | null;
  isLoading: boolean;
  error: Error | null;
  /** Bust the cache and re-fetch — wired to the dashboard's error-state retry. */
  reload: () => void;
}

/**
 * Single owner of the case-file dashboard's data. Fetches the three sources
 * concurrently (see `fetchCaseFileData`) and exposes unified loading/error
 * state, replacing the three independent `useEffect` fetches the dashboard and
 * side panels used to run. Results are drilled into the child cards as props.
 *
 * NOTE: `caseId` is reserved — there is no live per-case data source yet (the
 * in-memory fixtures ignore it), and the sole caller (CaseFileDashboard) invokes
 * this with no argument, so `caseId` is always `undefined` in production. The
 * param + cache-key seam are kept for the eventual per-case source; don't expand
 * them further until one lands.
 */
export function useCaseFileData(caseId?: string): CaseFileDataState {
  const [state, setState] = useState<Omit<CaseFileDataState, "reload">>({
    data: null,
    isLoading: true,
    error: null,
  });
  // Bumped by reload() to re-run the fetch effect after busting the cache.
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    clearCaseFileDataCache(caseId);
    setState((s) => ({ ...s, isLoading: true, error: null }));
    setNonce((n) => n + 1);
  }, [caseId]);

  useEffect(() => {
    let active = true;
    // No synchronous setState here (react-hooks/set-state-in-effect — it would
    // trigger cascading renders). Initial state is `isLoading: true`, and the
    // terminal state is set from the fetch callbacks. On a caseId change the
    // previous snapshot is shown until the new fetch resolves (the data layer
    // is an instant in-memory read, so there is no perceptible stale window).
    fetchCaseFileData(liveDeps, caseId)
      .then((data) => {
        if (active) setState({ data, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setState({
            data: null,
            isLoading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [caseId, nonce]);

  return { ...state, reload };
}
