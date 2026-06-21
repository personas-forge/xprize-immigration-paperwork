// ── Token economy config ──────────────────────────────────────────────
// "Tokens" is the product term; internally these are app CREDITS, not LLM
// tokens. This module owns the PURCHASE side of the economy — the free signup
// grant, the metering-bypass switch, and the purchasable bundles. 1 token ≈
// 1.0¢ at the baseline bundle.
//
// Per-operation cost/tier/rate-limit config lives in the OperationRegistry
// (`registry.ts`, the single source of truth) — import `costOf` / `TIER_COST` /
// `OpTier` from there directly.

export const FREE_SIGNUP_GRANT = 150; // granted once, at first onboarding

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
  /** Price in whole cents — the SOURCE OF TRUTH. Display strings are derived from
   *  this via {@link bundlePriceLabel} so every price uses one currency convention
   *  (and stays locale-ready) instead of hand-authored "$5" / "$19/mo" literals. */
  priceCents: number;
  centsPerToken: number;
  discountLabel?: string;
  polarProductId?: string;
  recurring?: boolean;
};

export const BUNDLES: Bundle[] = [
  { key: "starter", label: "Starter", tokens: 500, priceCents: 500, centsPerToken: 1.0, polarProductId: process.env.POLAR_PRODUCT_STARTER },
  { key: "builder", label: "Builder", tokens: 2000, priceCents: 1500, centsPerToken: 0.75, discountLabel: "25% off", polarProductId: process.env.POLAR_PRODUCT_BUILDER },
  { key: "pro", label: "Pro", tokens: 8000, priceCents: 4800, centsPerToken: 0.6, discountLabel: "40% off", polarProductId: process.env.POLAR_PRODUCT_PRO },
  { key: "scale", label: "Scale", tokens: 30000, priceCents: 15000, centsPerToken: 0.5, discountLabel: "50% off", polarProductId: process.env.POLAR_PRODUCT_SCALE },
  // Monthly subscription — ~builder rate as a convenience plan, renews itself.
  { key: "monthly", label: "Monthly", tokens: 2500, priceCents: 1900, centsPerToken: 0.76, recurring: true, polarProductId: process.env.POLAR_PRODUCT_MONTHLY },
];

// One currency convention for every price the app renders. `Intl.NumberFormat` is
// locale-ready (swap the locale when i18n lands) and keeps whole-dollar bundles as
// "$5" while any future fractional price still shows cents — no more hand-authored
// "$5" vs "$5.00" drift between the bundle grid and the landing page.
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format whole cents as a display price, e.g. 500 → "$5", 1999 → "$19.99". */
export function formatUsdCents(cents: number): string {
  return USD.format(cents / 100);
}

/** A bundle's display price, with the "/mo" suffix for the recurring plan. */
export function bundlePriceLabel(b: Bundle): string {
  return b.recurring ? `${formatUsdCents(b.priceCents)}/mo` : formatUsdCents(b.priceCents);
}

// The sub-cent per-token rate uses the SAME numeric convention (fixed 2 decimals,
// locale-aware grouping) so "1.00¢" and "$5" don't read as two different systems.
const RATE = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** The "≈ N¢ / token" rate, formatted consistently with {@link formatUsdCents}. */
export function formatCentsPerToken(centsPerToken: number): string {
  return `${RATE.format(centsPerToken)}¢`;
}

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
