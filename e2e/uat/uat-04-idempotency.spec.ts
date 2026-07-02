import { test, expect, type Page } from "@playwright/test";
import { ensureOnboarded, readBalance, PRICE } from "./helpers";
import { gotoInteractive } from "./helpers";

// @uat — Charge idempotency (A2 billing): every charged AI fetch carries an
// `Idempotency-Key` the orchestrator folds into the ledger ref, so a retry of
// the SAME intent (lost response, double-fire, resubmit-after-error) de-dupes
// the token DEBIT instead of double-charging — even when the server executed
// both requests. Engine: fake claude CLI (deterministic); metering ON over
// PGlite.

/** The server's accepted key shape (operation.ts IDEMPOTENCY_KEY_RE) — a key
 *  outside it is silently ignored and dedupe disengages. */
const KEY_RE = /^[A-Za-z0-9_.:-]{1,200}$/;

/** Drive the qualify panel to a submitted screening with the sample profile. */
async function submitQualify(page: Page): Promise<void> {
  await gotoInteractive(page, "/qualify");
  await page.getByRole("button", { name: /I already know my visa/i }).click();
  await page.getByPlaceholder("e.g. Dr. Anya Krishnan").fill("UAT Idempotency");
  await page.getByRole("button", { name: "Use a sample" }).click();
  await page.getByRole("button", { name: "Check my eligibility" }).click();
}

test.describe("@uat idempotency: charged retries never double-debit", () => {
  test("charged fetches carry a valid Idempotency-Key", async ({ page }) => {
    await ensureOnboarded(page);

    // Capture the header without disturbing the request (fallback → the real
    // server handles it as usual).
    const keys: Array<string | undefined> = [];
    await page.route("**/api/qualify", async (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      await route.fallback();
    });

    await submitQualify(page);
    await expect(page.getByText("Estimated likelihood", { exact: true })).toBeVisible({
      timeout: 60_000,
    });

    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(KEY_RE);
  });

  test("a lost-response retry does not double-charge", async ({ page }) => {
    await ensureOnboarded(page);
    // readBalance navigates — take the baseline BEFORE starting the flow.
    const before = await readBalance(page);

    // First request: let the SERVER process it fully (the debit lands), then
    // drop the response on the wire — the client sees a network failure and
    // never learns the charge happened. Subsequent requests pass through.
    const keys: Array<string | undefined> = [];
    let dropped = false;
    await page.route("**/api/qualify", async (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      if (!dropped) {
        dropped = true;
        await route.fetch(); // server executes + debits
        await route.abort(); // …but the response is lost
        return;
      }
      await route.fallback();
    });

    await submitQualify(page);
    // The dropped response surfaces as the panel's network-error alert.
    await expect(
      page.getByRole("alert").filter({ hasText: "Network error — please try again." }),
    ).toBeVisible({ timeout: 60_000 });

    // Retry the SAME intent (inputs unchanged) — must reuse the key.
    await page.getByRole("button", { name: "Check my eligibility" }).click();
    await expect(page.getByText("Estimated likelihood", { exact: true })).toBeVisible({
      timeout: 60_000,
    });

    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(KEY_RE);
    // Same intent → same key: this is what lets the ledger fold both requests
    // onto one ref.
    expect(keys[1]).toBe(keys[0]);

    // The server ran twice, but the debit de-duped: exactly ONE qualify price.
    expect(await readBalance(page)).toBe(before - PRICE.qualify);
  });
});
