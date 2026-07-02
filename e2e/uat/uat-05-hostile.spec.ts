import { test, expect } from "@playwright/test";
import { ensureOnboarded, readBalance, PRICE } from "./helpers";

// @uat — Hostile/edge persona (billing-and-uat.md B2, ship-blocking per CP0):
// oversized and malformed inputs, double-fire submits, and mid-generation
// navigation must degrade gracefully and NEVER net-charge. The logged-out
// probing half of this persona lives in scripts/prod-smoke.mjs (this harness
// runs dev-auth, which authenticates everything).

test.describe("@uat hostile user: bad input, double-fire, back-button", () => {
  test("oversized profile (>MAX_PROFILE) gets a human rejection and no debit", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);
    const oversized = "x".repeat(12_500); // MAX_PROFILE is 12000

    // UI path: parse rejects BEFORE charge, so the panel shows the server's
    // human message and the balance is untouched.
    await page.goto("/qualify");
    await page.getByRole("button", { name: /I already know my visa/i }).click();
    await page.getByPlaceholder(/Paste your CV highlights/).fill(oversized);
    await page.getByRole("button", { name: "Check my eligibility" }).click();
    await expect(page.getByText(/too long/i).first()).toBeVisible({ timeout: 15_000 });

    // API path (hostile client skipping the UI): same 400, same message.
    const res = await page.request.post("/api/qualify", {
      data: { name: "Hostile", classification: "O-1A", profile: oversized },
    });
    expect(res.status()).toBe(400);
    expect(String((await res.json()).error)).toMatch(/too long/i);

    expect(await readBalance(page)).toBe(before);
  });

  test("malformed API bodies are 400s and never debit", async ({ page }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    const garbage = await page.request.post("/api/qualify", {
      headers: { "content-type": "application/json" },
      data: "not json at all{{{",
    });
    expect(garbage.status()).toBe(400);

    const wrongShape = await page.request.post("/api/qualify", {
      data: { profile: 42, classification: { nested: true } },
    });
    expect(wrongShape.status()).toBe(400);

    const emptyDraft = await page.request.post("/api/draft", { data: {} });
    expect(emptyDraft.status()).toBe(400);

    expect(await readBalance(page)).toBe(before);
  });

  test("a rapid double-fire of a charged submit debits exactly once", async ({ page }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    await page.goto("/qualify");
    await page.getByRole("button", { name: /I already know my visa/i }).click();
    await page.getByPlaceholder("e.g. Dr. Anya Krishnan").fill("UAT Doubleclick");
    await page.getByRole("button", { name: "Use a sample" }).click();

    // Two dispatches in the SAME synchronous tick (two Playwright clicks can
    // serialize hundreds of ms apart — after the first submit already
    // succeeded, a second click is a legitimate NEW paid intent, which is
    // exactly what a first version of this test measured). requestSubmit()
    // twice back-to-back is the true double-fire the busyRef must swallow.
    const form = page.locator("form").filter({ has: page.getByPlaceholder(/Paste your CV/) });
    await form.evaluate((f: HTMLFormElement) => {
      f.requestSubmit();
      f.requestSubmit();
    });

    await expect(page.getByText("Estimated likelihood", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    expect(await readBalance(page)).toBe(before - PRICE.qualify);
  });

  test("navigating away mid-generation leaves exactly one debit and no corruption", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    await page.goto("/qualify");
    await page.getByRole("button", { name: /I already know my visa/i }).click();
    await page.getByPlaceholder("e.g. Dr. Anya Krishnan").fill("UAT Backbutton");
    await page.getByRole("button", { name: "Use a sample" }).click();
    await page.getByRole("button", { name: "Check my eligibility" }).click();
    // Abandon the page while the request is in flight — the server finishes
    // regardless; the charge must land exactly once.
    await page.goto("/billing");

    // Poll until the debit is visible, then confirm it STAYS a single debit.
    await expect
      .poll(async () => readBalance(page), { timeout: 30_000 })
      .toBe(before - PRICE.qualify);
    await page.waitForTimeout(2_000);
    expect(await readBalance(page)).toBe(before - PRICE.qualify);
  });
});
