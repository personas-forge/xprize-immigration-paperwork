"use client";

import { useState } from "react";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { CaseFileDashboard } from "@/features/case-file";
import { ThemeScope } from "./ThemeScope";
import { midnight, teal } from "./themes";

// The dashboard ships a light and a dark theme; the toggle re-themes the
// whole surface (top bar included) by swapping the token set on ThemeScope.
export function DashboardView() {
  const [dark, setDark] = useState(false);

  return (
    <ThemeScope theme={dark ? midnight : teal}>
      <DashboardTopBar
        glyph="✦"
        product="Immigration Concierge"
        context="Case O1-241 · Krishnan · O-1A"
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
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
    >
      <span aria-hidden>{dark ? "☾" : "☀"}</span>
      {dark ? "Dark" : "Light"}
    </button>
  );
}
