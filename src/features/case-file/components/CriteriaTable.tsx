"use client";

import { Badge, Card, CardHeader, Skeleton } from "@/components/ui";
import { QUALIFYING_THRESHOLD, summarizeCriteria } from "../criteria";
import { type Criterion } from "../types";
import { CriteriaRows } from "./CriteriaRows";

/**
 * The O-1A criteria table. Criteria are no longer fetched here — they arrive as
 * a prop from the coordinated `useCaseFileData` fan-out (ADR-0009), so this card
 * shares the single composited fetch with the rest of the dashboard instead of
 * issuing its own `useEffect` read. `null` means the parent fetch is still in
 * flight (skeleton state).
 */
export function CriteriaTable({
  criteria,
}: {
  criteria: readonly Criterion[] | null;
}) {
  const summary = summarizeCriteria(criteria ?? []);

  return (
    <Card>
      {/* Wrapper clips the header bg to the card's top corners without
          applying overflow-hidden to the whole card, which would clip
          the absolutely-positioned criterion primer popovers. */}
      <div className="overflow-hidden rounded-t-card">
      <CardHeader className="bg-surface-muted/60">
        <div>
          <div className="microprint" style={{ color: "var(--accent-dark)" }}>
            § II — O-1A Criteria
          </div>
          <div className="display mt-1 text-[18px]">
            {summary.total} of {criteria?.length ?? 0} evaluated
            <span className="font-sans text-[15px] italic text-muted-strong">
              {" "}— need {QUALIFYING_THRESHOLD} to qualify, AI-scored from CV + evidence vault.
            </span>
          </div>
        </div>
        <Badge tone={summary.meetsThreshold ? "success" : "warning"}>
          {summary.qualifying} strong · {summary.partial} partial
        </Badge>
      </CardHeader>
      </div>

      {criteria === null ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : (
        <CriteriaRows criteria={criteria} showExhibit showPrimer />
      )}
    </Card>
  );
}
