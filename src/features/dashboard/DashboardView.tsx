"use client";

import { useState } from "react";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { CaseFileDashboard } from "@/features/case-file";
import { ThemeScope } from "./ThemeScope";
import { ink, parchment } from "./themes";

// The dashboard ships parchment (daylight) and ink (after-hours) skins;
// the toggle swaps the entire token set on the ThemeScope wrapper so every
// surface (top bar included) re-themes from one place.
export function DashboardView() {
  const [dark, setDark] = useState(false);

  return (
    <ThemeScope theme={dark ? ink : parchment}>
      <DashboardTopBar
        glyph="✦"
        product="Immigration Concierge"
        context="O1-241 · Krishnan · O-1A"
        actions={<ThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />}
      />
      <CaseFileDashboard />
    </ThemeScope>
  );
}

function ThemeToggle({
  dark,
  onToggle,
}: {
  dark: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? "Switch to parchment theme" : "Switch to ink theme"}
      className="inline-flex items-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-document text-foreground transition-[background-color,border-color] hover:border-foreground hover:bg-surface-muted"
    >
      <span aria-hidden>{dark ? "☾" : "☼"}</span>
      {dark ? "Ink" : "Parchment"}
    </button>
  );
}
