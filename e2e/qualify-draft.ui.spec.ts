import { test, expect } from "@playwright/test";
import { AI_TIMEOUT, EXPECTED_BADGE } from "./engine";

// The click-through the user asked for: drive the real app to the points where
// the LLM is invoked. The public /qualify page needs no auth/DB and fires TWO
// engine ops — qualification, then drafting. The engine badge ("Claude" /
// "Gemini" / "Template") confirms which backend ran.

test("qualify → draft: clicking through triggers the LLM and renders output", async ({ page }) => {
  // Two sequential live model calls can be slow — give the whole flow room.
  test.setTimeout(600_000);

  await page.goto("/qualify");
  await expect(page.getByRole("heading", { name: /Do you/i })).toBeVisible();

  // Fill the screening form (visa type defaults to O-1A) and use the sample CV.
  await page.getByPlaceholder("e.g. Dr. Anya Krishnan").fill("Dr. Test");
  await page.getByRole("button", { name: "Use a sample" }).click();

  // Fire /api/qualify → the qualification LLM op.
  await page.getByRole("button", { name: "Check my eligibility" }).click();

  // The screening renders, with the engine badge. (Exact match — the page intro
  // copy also contains the words "estimated likelihood".)
  await expect(
    page.getByText("Estimated likelihood", { exact: true }),
  ).toBeVisible({ timeout: AI_TIMEOUT });
  await expect(page.getByText(EXPECTED_BADGE, { exact: true }).first()).toBeVisible();

  // Fire /api/draft → the drafting LLM op.
  await page.getByRole("button", { name: "Draft the petition" }).click();

  // The drafted sections render (the "Regenerate full draft" control appears
  // only on the done state), confirming the draft op produced output.
  await expect(
    page.getByRole("button", { name: "Regenerate full draft" }),
  ).toBeVisible({ timeout: AI_TIMEOUT });
});
