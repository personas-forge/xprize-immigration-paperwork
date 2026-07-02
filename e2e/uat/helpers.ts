import { expect, type Page } from "@playwright/test";

/** The signup grant the onboarding flow mints (FREE_SIGNUP_GRANT). Pinned here
 *  as a literal on purpose: if the economy is repriced, the UAT debit math is
 *  re-derived consciously rather than silently following the constant. */
export const SIGNUP_GRANT = 150;

/** Registry prices the journeys assert (TIER_COST × OPERATION_REGISTRY). Same
 *  deliberate-literal rule as SIGNUP_GRANT. */
export const PRICE = {
  qualify: 3,
  draft: 12,
  draft_section: 5,
  rfe: 5,
  categorize: 1,
  guidance: 1,
} as const;

/** Read the current token balance off the dashboard BalancePill. Navigates. */
export async function readBalance(page: Page): Promise<number> {
  await page.goto("/dashboard");
  const pill = page.getByLabel(/Token balance:/).first();
  await expect(pill).toBeVisible();
  const text = await pill.innerText();
  const m = /([\d,]+)/.exec(text);
  if (!m) throw new Error(`BalancePill shows no numeric balance (got: "${text}")`);
  return Number(m[1].replaceAll(",", ""));
}

/**
 * Idempotent onboarding: the dev user must consent once per fresh DB before the
 * dashboard opens (this is also the moment the signup grant is minted). Safe to
 * call at the top of every journey — a consented user sails through.
 */
export async function ensureOnboarded(page: Page): Promise<void> {
  await page.goto("/dashboard");
  if (!page.url().includes("/welcome")) return;
  await page.getByLabel("Full legal name").fill("UAT Developer");
  await page.getByRole("checkbox", { name: /Terms of Service/ }).check();
  await page.getByRole("checkbox", { name: /Privacy Policy/ }).check();
  await page.getByRole("button", { name: /Agree & open my case file/ }).click();
  await page.waitForURL((url) => !url.pathname.includes("/welcome"));
}
