// ── Token economy config ──────────────────────────────────────────────
// "Tokens" is the product term; internally these are app CREDITS, not LLM
// tokens. EVERY tunable number lives here — change pricing/grants in one place.
// 1 token ≈ 1.0¢ at the baseline bundle.
//
// Per-operation cost/tier config now lives in the OperationRegistry
// (`registry.ts`, the single source of truth); the exports below DERIVE from it
// and keep the same public surface (OP_COST, OPERATIONS, OpTier, costOf) so
// guard.ts, the routes, and the existing tests stay green unchanged.

import { OPERATION_REGISTRY, TIER_COST } from "./registry";
import type { OpTier } from "./registry";

export type { OpTier } from "./registry";
export { costOf } from "./registry";

export const FREE_SIGNUP_GRANT = 150; // granted once, at first onboarding

// Per-operation cost, weighted to reflect real compute cost. Sourced from the
// registry's TIER_COST so the weights live in exactly one place.
export const OP_COST = TIER_COST;

// Map THIS app's operations -> tier (key = the `operation` string passed to
// chargeForOperation()). Derived from the OperationRegistry.
export const OPERATIONS: Record<string, OpTier> = Object.fromEntries(
  Object.entries(OPERATION_REGISTRY).map(([op, def]) => [op, def.tier]),
);

/**
 * True when the token economy is NOT enforced and AI routes should run as a
 * free, unmetered pass: explicit dev bypass (`TOKENS_BYPASS=1`) or no database
 * configured (keyless build/dev). Pure + dependency-free so it stays unit-
 * testable; the guard layers the auth check on top. `env` defaults to
 * `process.env` and is injectable for tests.
 */
export function isMeteringBypassed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.TOKENS_BYPASS === "1" || !env.DATABASE_URL;
}

// Purchasable bundles — discount grows with size. `polarProductId` is filled
// from env after you create the products in the Polar dashboard.
// `recurring` marks a Polar SUBSCRIPTION product (monthly token allowance):
// same checkout route and webhook path as one-time bundles — Polar emits an
// order per billing cycle, and each cycle order re-credits `tokens` (the
// ledger dedupes by order id, and every cycle has a fresh order id).
export type Bundle = {
  key: string;
  label: string;
  tokens: number;
  priceLabel: string;
  centsPerToken: number;
  discountLabel?: string;
  polarProductId?: string;
  recurring?: boolean;
};

export const BUNDLES: Bundle[] = [
  { key: "starter", label: "Starter", tokens: 500, priceLabel: "$5", centsPerToken: 1.0, polarProductId: process.env.POLAR_PRODUCT_STARTER },
  { key: "builder", label: "Builder", tokens: 2000, priceLabel: "$15", centsPerToken: 0.75, discountLabel: "25% off", polarProductId: process.env.POLAR_PRODUCT_BUILDER },
  { key: "pro", label: "Pro", tokens: 8000, priceLabel: "$48", centsPerToken: 0.6, discountLabel: "40% off", polarProductId: process.env.POLAR_PRODUCT_PRO },
  { key: "scale", label: "Scale", tokens: 30000, priceLabel: "$150", centsPerToken: 0.5, discountLabel: "50% off", polarProductId: process.env.POLAR_PRODUCT_SCALE },
  // Monthly subscription — ~builder rate as a convenience plan, renews itself.
  { key: "monthly", label: "Monthly", tokens: 2500, priceLabel: "$19/mo", centsPerToken: 0.76, recurring: true, polarProductId: process.env.POLAR_PRODUCT_MONTHLY },
];

export function bundleByKey(key: string): Bundle | undefined {
  return BUNDLES.find((b) => b.key === key);
}
export function bundleByProductId(productId: string): Bundle | undefined {
  return BUNDLES.find((b) => b.polarProductId && b.polarProductId === productId);
}

// Enterprise = contact only (no self-serve): premium model tier, custom limits,
// SSO, invoicing. Set the contact target per deployment.
export const ENTERPRISE_CONTACT =
  process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT ?? "mailto:sales@example.com";
