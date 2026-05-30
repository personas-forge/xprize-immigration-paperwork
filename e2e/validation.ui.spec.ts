import { test, expect } from "@playwright/test";

// The /validation transparency page renders from the validation records (no
// model calls), so this is deterministic in any engine mode.

test("/validation shows verified states, citations, and the counsel caveat", async ({ page }) => {
  await page.goto("/validation");

  await expect(
    page.getByRole("heading", { name: /how we keep each state/i }),
  ).toBeVisible();

  // US programs are verified against the CFR (primary-source citations shown).
  await expect(page.getByText("8 CFR 214.2(o)(3)(iii)").first()).toBeVisible();
  await expect(page.getByText("8 CFR 204.5(h)(3)").first()).toBeVisible();

  // The two-layer caveat is visible: nothing is counsel-approved yet.
  await expect(page.getByText("Counsel pending").first()).toBeVisible();

  // The UK model-mismatch is surfaced, not hidden.
  await expect(page.getByText(/endorsement/i).first()).toBeVisible();
});
