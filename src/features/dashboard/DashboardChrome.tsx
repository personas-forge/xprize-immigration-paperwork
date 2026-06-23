"use client";

import Link from "next/link";

// Shared dashboard top-bar chrome: the token BalancePill and the prop-driven
// theme toggle used by the three dashboard shells (DashboardView, CaseDetailView,
// ReviewQueueView). Extracted here because all three carried byte-identical
// copies — an a11y/contrast/token fix now lands in one place.
//
// NOTE — `LocalThemeToggle` is the TRANSIENT, in-memory variant: each shell holds
// a `dark` useState that feeds ThemeScope's token overrides. It is deliberately
// distinct from the canonical, localStorage-persisted `@/components/ThemeToggle`
// (used by the static pages). The dashboard theme not persisting/syncing with the
// canonical signal is a known behavior gap (scan: brand-design-system #2 /
// case-file-dashboard #1) — closing it means re-keying ThemeScope off the
// persisted theme, a separate behavior change. This extraction is byte-identical:
// same markup, same classes, same prop contract — no behavior change.

/** Token balance, document-register style. "∞" when the economy isn't enforced
 *  (no DB / TOKENS_BYPASS). Links to /billing to top up; re-skins via theme tokens. */
export function BalancePill({ balance }: { balance: number | null }) {
  const label = balance === null ? "∞" : balance.toLocaleString();
  return (
    <Link
      href="/billing"
      aria-label={`Token balance: ${label}. Buy more tokens.`}
      className="inline-flex items-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-1.5 font-mono text-[12.5px] uppercase tracking-document text-foreground transition-[background-color,border-color] hover:border-foreground hover:bg-surface-muted focus-ring"
    >
      <span aria-hidden style={{ color: "var(--accent-dark)" }}>
        ◈
      </span>
      <span className="doc-number text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
        {label}
      </span>
      <span style={{ color: "var(--muted)" }}>tokens</span>
    </Link>
  );
}

/** Prop-driven parchment/ink toggle that swaps the ThemeScope token set. Transient
 *  (not persisted) — see the module note vs the canonical `@/components/ThemeToggle`. */
export function LocalThemeToggle({
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
      className="inline-flex items-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-1.5 font-mono text-[12.5px] uppercase tracking-document text-foreground transition-[background-color,border-color] hover:border-foreground hover:bg-surface-muted"
    >
      <span aria-hidden>{dark ? "☾" : "☼"}</span>
      {dark ? "Ink" : "Parchment"}
    </button>
  );
}
