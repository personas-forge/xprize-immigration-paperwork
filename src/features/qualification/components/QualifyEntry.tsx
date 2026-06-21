"use client";

import { useState } from "react";
import { BestPathFinder } from "./BestPathFinder";
import { QualifyPanel } from "./QualifyPanel";
import { writeQualifyPrefill, type QualifyPrefill } from "../prefill";

// — Qualify entry (moonshot #7) ───────────────────────────────────────────────
// The /qualify funnel now leads with "Find my best path" — score one profile
// against every program and pick the strongest route — instead of forcing a
// classification guess up front. "I already know my visa" drops straight to the
// single-classification screening. Choosing a path from the finder stashes the
// profile (one-shot prefill) and mounts QualifyPanel, which hydrates it on mount
// so nothing is re-typed.

type Mode = "best-path" | "known";

export function QualifyEntry() {
  const [mode, setMode] = useState<Mode>("best-path");

  function onContinue(prefill: QualifyPrefill) {
    // Stash BEFORE switching: QualifyPanel reads the prefill once on mount, and
    // it only mounts when we flip to "known".
    writeQualifyPrefill(prefill);
    setMode("known");
  }

  if (mode === "known") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setMode("best-path")}
          className="font-mono text-[13px] uppercase tracking-document text-muted-strong ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
        >
          ← Find my best path
        </button>
        <QualifyPanel />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BestPathFinder onContinue={onContinue} />
      <div className="text-center">
        <button
          type="button"
          onClick={() => setMode("known")}
          className="font-mono text-[13px] uppercase tracking-document text-muted-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
        >
          I already know my visa — screen directly →
        </button>
      </div>
    </div>
  );
}
