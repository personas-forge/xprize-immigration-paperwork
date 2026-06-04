"use client";

import { useEffect, useState } from "react";
import { fetchCaseFileData, type CaseFileData } from "./caseFileData";

// Re-export the pure fetch + its type so consumers can import everything from
// `useCaseFileData`. The implementation (and its unit tests) live in the
// React-free ./caseFileData module — see that file for why (ADR-0009).
export { fetchCaseFileData, clearCaseFileDataCache } from "./caseFileData";
export type { CaseFileData, CaseFileDataSources } from "./caseFileData";

/** Unified loading/error/data surface for the case-file dashboard. */
export interface UseCaseFileDataResult {
  data: CaseFileData | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetch the case-file dashboard's three data sources as ONE concurrent request
 * with a single loading/error surface (ADR-0009). The dashboard calls this once
 * and drills `tasks` / `excerpt` into the side-panel cards as props, so the
 * cards no longer fetch. `caseId` keys the shared cache and pre-wires the
 * future multi-case seam (the data layer is not caseId-aware yet).
 */
export function useCaseFileData(caseId?: string): UseCaseFileDataResult {
  const [data, setData] = useState<CaseFileData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    fetchCaseFileData(caseId)
      .then((result) => {
        if (!active) return;
        setData(result);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [caseId]);

  return { data, isLoading, error };
}
