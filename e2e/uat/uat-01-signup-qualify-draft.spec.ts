import { test, expect } from "@playwright/test";
import { ensureOnboarded, readBalance, PRICE, SIGNUP_GRANT } from "./helpers";

// @uat — New free user (persona B2): consent → signup grant → first qualify →
// full petition draft, with A2 billing assertions on every charged op:
//   1. debit correctness (balance_before − price = balance_after)
//   2. value delivery + persistence (artifact survives reload; it's in the store)
//   3. failure ≠ charge (forced engine failure nets zero)
// Engine: fake claude CLI (deterministic); metering ON over PGlite.

test.describe("@uat signup → qualify → draft", () => {
  test("consent mints the signup grant exactly once", async ({ page }) => {
    await ensureOnboarded(page);
    expect(await readBalance(page)).toBe(SIGNUP_GRANT);

    // Re-visiting /welcome must not re-grant (grant is idempotent by design).
    await page.goto("/welcome");
    expect(await readBalance(page)).toBe(SIGNUP_GRANT);
  });

  test("qualify debits exactly its price and persists a case", async ({ page }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    await page.goto("/qualify");
    await page.getByRole("button", { name: /I already know my visa/i }).click();
    await page.getByPlaceholder("e.g. Dr. Anya Krishnan").fill("UAT Developer");
    await page.getByRole("button", { name: "Use a sample" }).click();
    await page.getByRole("button", { name: "Check my eligibility" }).click();

    // The screening rendered from the REAL engine path (badge = Claude, not
    // Template): a fake-CLI parse failure would reclaim + mock and fail here.
    await expect(page.getByText("Estimated likelihood", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Claude", { exact: true }).first()).toBeVisible();

    // Value delivery: the screening persisted a real case file.
    const caseLink = page.getByRole("link", { name: /Open case file/ });
    await expect(caseLink).toBeVisible();
    const caseHref = await caseLink.getAttribute("href");
    expect(caseHref).toMatch(/\/dashboard\/cases\/.+/);

    // Debit correctness: exactly one debit of exactly the qualify price.
    expect(await readBalance(page)).toBe(before - PRICE.qualify);

    // Stash the case URL for the draft leg (same worker, serial file).
    process.env.UAT_CASE_HREF = caseHref!;
  });

  test("full draft debits exactly its price and the letter persists", async ({ page }) => {
    await ensureOnboarded(page);
    const caseHref = process.env.UAT_CASE_HREF;
    expect(caseHref, "qualify journey must have created a case").toBeTruthy();
    const before = await readBalance(page);

    await page.goto(caseHref!);
    await page.getByRole("button", { name: "Draft the petition" }).click();
    await expect(page.getByRole("button", { name: "Regenerate full draft" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Claude", { exact: true }).first()).toBeVisible();

    // Debit correctness for the xl-tier op.
    expect(await readBalance(page)).toBe(before - PRICE.draft);

    // Value delivery + persistence: reload → the drafted letter is still there
    // (store-backed version, not component state).
    await page.goto(caseHref!);
    await expect(page.getByRole("button", { name: "Regenerate full draft" })).toBeVisible();
    await expect(page.getByText("Introduction").first()).toBeVisible();
  });

  test("engine failure reclaims the charge — net balance change is zero (A2.3)", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    await page.goto("/qualify");
    await page.getByRole("button", { name: /I already know my visa/i }).click();
    await page.getByPlaceholder("e.g. Dr. Anya Krishnan").fill("UAT Failure");
    // The marker makes the fake CLI exit non-zero — a real engine outage. The
    // padding clears the minimum-profile-length validation.
    await page
      .getByPlaceholder(/Paste your CV highlights/)
      .fill(`UAT-FORCE-ENGINE-FAIL ${"background detail ".repeat(20)}`);
    await page.getByRole("button", { name: "Check my eligibility" }).click();

    // The app recovers with the deterministic template, honestly labelled.
    // (The gibberish profile scores 0/8, so the UI shows its zero-evidence
    // empty state rather than an "Estimated likelihood" figure — assert on the
    // result status region + the Template badge instead.)
    await expect(page.getByText("Template", { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("status").filter({ hasText: "Screening result" })).toBeVisible();

    // Failure ≠ charge: the debit was reclaimed.
    expect(await readBalance(page)).toBe(before);
  });
});
