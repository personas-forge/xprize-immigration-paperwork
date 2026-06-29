// ── Operation registry ────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for the three per-operation dimensions of every
// metered AI operation: its cost weight (via tier), its own rate-limit cap
// (if any), and a human-readable label. `economy.ts` and `rate-limit.ts`
// DERIVE their public config from this map instead of declaring those values
// inline, so adding or repricing an operation is a one-file edit here — no
// more keeping magic strings/numbers in sync across two modules and N routes.
//
// Pure + dependency-free (no `server-only`, no Node built-ins) so it stays
// unit-testable under the node test runner alongside economy.ts / rate-limit.ts.

export type OpTier = "light" | "medium" | "heavy" | "xl";

// Token weight per tier, reflecting real compute cost. 1 token ≈ 1.0¢ at the
// baseline bundle. Canonical — import `TIER_COST` from here directly.
export const TIER_COST: Record<OpTier, number> = {
  light: 1, // short output: categorize, form-field guidance
  medium: 3, // structured/medium: O-1A qualification screening
  heavy: 5, // long generation: RFE response, single-section regeneration
  xl: 12, // 1M-context full petition-letter drafting — the premium op
};

export interface OperationDef {
  /** Human-readable name, for UI and logs. */
  label: string;
  /** Cost weight tier → TIER_COST. */
  tier: OpTier;
  /** Own fixed-window rate-limit cap; omitted = no own route bucket. */
  rateLimit?: number;
}

// The six metered AI operations — the single source of truth for their cost
// tier and rate-limit cap; `rate-limit.ts` derives RATE_LIMITS from here.
// `draft_section` intentionally has no own cap — it shares the `draft` bucket.
// `qualify` gained its 40/window cap in the qualify→orchestrator migration
// (ADR-0005, PR #12).
export const OPERATION_REGISTRY = {
  draft: { label: "Petition letter draft", tier: "xl", rateLimit: 20 },
  draft_section: { label: "Petition section regeneration", tier: "heavy" },
  rfe: { label: "RFE response", tier: "heavy", rateLimit: 20 },
  qualify: { label: "O-1A qualification screening", tier: "medium", rateLimit: 40 },
  guidance: { label: "USCIS form-field guidance", tier: "light", rateLimit: 40 },
  categorize: { label: "Evidence categorization", tier: "light", rateLimit: 40 },
} as const satisfies Record<string, OperationDef>;

export type OperationKey = keyof typeof OPERATION_REGISTRY;

/**
 * Token cost of an operation. Unknown operations default to the light tier so a
 * mistyped/new key is never free and never throws (matches the prior behavior of
 * economy.ts `costOf`).
 */
export function costOf(op: string): number {
  const def = (OPERATION_REGISTRY as Record<string, OperationDef>)[op];
  if (!def) {
    // A mistyped/unregistered op key (e.g. "Draft" or "qualify_v2") falls back
    // to the light tier and is silently underbilled (1 vs 3-12). Surface it so a
    // pricing mismatch is observable instead of a quiet revenue shortfall.
    console.warn(`[tokens] costOf: unknown operation "${op}" — defaulting to light tier (1 token)`);
  }
  return TIER_COST[def?.tier ?? "light"];
}

/**
 * Human-readable label for an operation. TOTAL like {@link costOf}: an unknown op
 * (e.g. a renamed/removed key sitting in a HISTORICAL ledger row — reached via the
 * `e.operation as OperationKey` read at billing/page.tsx) returns the raw string
 * rather than throwing, so a stray ledger string can't crash the billing-page
 * render. No behavior change for known ops — they resolve to their registry label.
 */
export function labelOf(op: string): string {
  return (OPERATION_REGISTRY as Record<string, OperationDef>)[op]?.label ?? op;
}
