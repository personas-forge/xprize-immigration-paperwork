"use client";

import { SAVE_FAILED_MESSAGE } from "@/features/drafting/saveRecovery";

export type CopyState = "idle" | "copied" | "failed";
export type RetryState = "idle" | "saving" | "failed";

// Recovery alert for a charged-but-unsaved draft. Presentational only — the
// copy/retry behavior lives in saveRecovery.ts and is wired by DraftStudio.
// Deliberately imports nothing from `next/*` so the test runner can render it
// with react-dom/server (the test glob is `src/**/*.test.ts`, no DOM).
//
// role="alert" (not "status"): losing paid work product is urgent enough to
// interrupt a screen reader, and the alert appears exactly once per failed
// save, immediately after the user's own generate action.
export function SaveFailedAlert({
  copyState,
  retryState,
  onCopy,
  onRetry,
  canRetry,
}: {
  copyState: CopyState;
  retryState: RetryState;
  onCopy: () => void;
  onRetry: () => void;
  /** False when there is no caseId to save against — copy is the only rescue. */
  canRetry: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-control border border-seal/50 bg-seal-soft/40 px-4 py-3 font-sans text-[15px] leading-snug text-foreground-soft"
    >
      <div>
        <span className="font-mono text-[12px] uppercase tracking-document text-seal">
          Not saved
        </span>
        <span className="ml-2">{SAVE_FAILED_MESSAGE}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-control border border-seal/50 px-3 py-1.5 font-mono text-[12px] uppercase tracking-document text-seal transition-colors hover:bg-seal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
        >
          {copyState === "copied"
            ? "Copied ✓"
            : copyState === "failed"
              ? "Copy failed — select & copy manually"
              : "Copy draft"}
        </button>
        {canRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retryState === "saving"}
            className="rounded-control bg-seal px-3 py-1.5 font-mono text-[12px] uppercase tracking-document text-background transition-colors hover:bg-[color:var(--accent-dark)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
          >
            {retryState === "saving" ? "Saving…" : "Retry saving"}
          </button>
        ) : null}
        {retryState === "failed" ? (
          <span className="font-sans text-[14px] text-danger">
            Saving failed again — your draft is still unsaved.
          </span>
        ) : null}
      </div>
    </div>
  );
}
