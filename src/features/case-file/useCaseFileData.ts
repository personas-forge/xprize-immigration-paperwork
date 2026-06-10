"use client";

import { useEffect, useState } from "react";
import { getCaseFacts, getCriteria, getOutstandingTasks, getPetitionExcerpt } from "@/lib/data";
import {
  type CaseFileData,
  type CaseFileDataDeps,
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
}

/**
 * Single owner of the case-file dashboard's data. Fetches the three sources
 * concurrently (see `fetchCaseFileData`) and exposes unified loading/error
 * state, replacing the three independent `useEffect` fetches the dashboard and
 * side panels used to run. Results are drilled into the child cards as props.
 */
export function useCaseFileData(caseId?: string): CaseFileDataState {
  const [state, setState] = useState<CaseFileDataState>({
    data: null,
    isLoading: true,
    error: null,
  });

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
  }, [caseId]);

  return state;
}
