"use client";

import { useCallback, useSyncExternalStore } from "react";
import { TIER_COST } from "@/lib/tokens/registry";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  writeDismissed,
} from "./bannerDismiss";

// One-time dismissible token economy explainer. Shown only when the token
// economy is active (balance !== null prevents mount in demo/bypass mode —
// see DashboardView). Only fires on first dashboard visit per browser;
// dismissed state persists in localStorage.
export function TokenExplainerBanner({ balance }: { balance: number }) {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dismiss = useCallback(() => writeDismissed(), []);

  if (dismissed) return null;

  const draftCost = TIER_COST.xl;

  return (
    <aside
      role="note"
      aria-label="Token economy explainer"
      className="flex items-start justify-between gap-4 border-b border-border-strong bg-surface-muted px-6 py-3 font-mono text-[12.5px] uppercase tracking-document text-foreground"
    >
      <p>
        <span style={{ color: "var(--accent-dark)" }} aria-hidden>
          ◈{" "}
        </span>
        Each AI action uses tokens. Your plan includes{" "}
        <strong className="text-foreground">{balance.toLocaleString()} tokens</strong>.
        {" "}Drafts cost{" "}
        <strong className="text-foreground">~{draftCost} tokens</strong>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss token explainer"
        className="shrink-0 rounded-control border border-border-strong bg-surface px-2 py-0.5 text-foreground transition-[background-color,border-color] hover:border-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
      >
        Dismiss
      </button>
    </aside>
  );
}
