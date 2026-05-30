// ── Token economy config ──────────────────────────────────────────────
// "Tokens" is the product term; internally these are app CREDITS, not LLM
// tokens. EVERY tunable number lives here — change pricing/grants in one place.
// 1 token ≈ 1.0¢ at the baseline bundle.

export const FREE_SIGNUP_GRANT = 150; // granted once, at first onboarding

// Per-operation cost, weighted to reflect real compute cost.
export const OP_COST = {
  light: 1, // short output: categorize, review reply, form-field guidance
  medium: 3, // structured/medium: O-1A qualification screening, match score
  heavy: 5, // long generation: cover letter, RFE response section
  xl: 12, // 1M-context full petition-letter drafting — the premium op
} as const;
export type OpTier = keyof typeof OP_COST;

// Map THIS app's operations -> tier. Adapt per app (key = the `operation`
// string passed to chargeForOperation()).
export const OPERATIONS: Record<string, OpTier> = {
  // USCIS form-field guidance — a short informational answer (1 token).
  guidance: "light",
  // Evidence categorization — classify a document into a criterion (1 token).
  categorize: "light",
  // O-1A qualification screening — structured 8-criterion assessment (3 tokens).
  qualify: "medium",
  // Full petition-letter draft — long-context generation (12 tokens).
  draft: "xl",
  // Regenerate a single petition-letter section (5 tokens).
  draft_section: "heavy",
  // Draft a response to a USCIS Request for Evidence (5 tokens).
  rfe: "heavy",
};

export function costOf(operation: string): number {
  return OP_COST[OPERATIONS[operation] ?? "light"];
}

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
export type Bundle = {
  key: string;
  label: string;
  tokens: number;
  priceLabel: string;
  centsPerToken: number;
  discountLabel?: string;
  polarProductId?: string;
};

export const BUNDLES: Bundle[] = [
  { key: "starter", label: "Starter", tokens: 500, priceLabel: "$5", centsPerToken: 1.0, polarProductId: process.env.POLAR_PRODUCT_STARTER },
  { key: "builder", label: "Builder", tokens: 2000, priceLabel: "$15", centsPerToken: 0.75, discountLabel: "25% off", polarProductId: process.env.POLAR_PRODUCT_BUILDER },
  { key: "pro", label: "Pro", tokens: 8000, priceLabel: "$48", centsPerToken: 0.6, discountLabel: "40% off", polarProductId: process.env.POLAR_PRODUCT_PRO },
  { key: "scale", label: "Scale", tokens: 30000, priceLabel: "$150", centsPerToken: 0.5, discountLabel: "50% off", polarProductId: process.env.POLAR_PRODUCT_SCALE },
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
