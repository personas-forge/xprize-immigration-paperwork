"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { CaseFileDashboard } from "@/features/case-file";
import { type SavedCaseSummary } from "@/features/case-file/types";
import { ThemeScope } from "./ThemeScope";
import { ink, parchment } from "./themes";
import { TokenExplainerBanner } from "./TokenExplainerBanner";
import { BalancePill, LocalThemeToggle } from "./DashboardChrome";

// The dashboard ships parchment (daylight) and ink (after-hours) skins;
// the toggle swaps the entire token set on the ThemeScope wrapper so every
// surface (top bar included) re-themes from one place.
export function DashboardView({
  balance,
  cases = [],
  isAttorney = false,
}: {
  balance: number | null;
  cases?: readonly SavedCaseSummary[];
  isAttorney?: boolean;
}) {
  const [dark, setDark] = useState(false);

  return (
    <ThemeScope theme={dark ? ink : parchment}>
      {balance !== null && <TokenExplainerBanner balance={balance} />}
      <DashboardTopBar
        glyph="✦"
        product="Immigration Concierge"
        context="O1-241 · Krishnan · O-1A"
        actions={
          <>
            {isAttorney ? (
              <Link
                href="/dashboard/review"
                className="hidden items-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-1.5 font-mono text-[12.5px] uppercase tracking-document text-foreground transition-[background-color,border-color] hover:border-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 sm:inline-flex"
              >
                <span aria-hidden style={{ color: "var(--seal)" }}>
                  ✒
                </span>
                Review queue
              </Link>
            ) : null}
            <BalancePill balance={balance} />
            <LocalThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
          </>
        }
      />
      <CaseFileDashboard cases={cases} />
    </ThemeScope>
  );
}
