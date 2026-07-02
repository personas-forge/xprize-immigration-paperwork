import { test, expect, type Page } from "@playwright/test";
import {
  ensureOnboarded,
  readBalance,
  polarOrderEvent,
  polarWebhookHeaders,
  PRICE,
} from "./helpers";

// @uat — Engaged→paying user (billing-and-uat.md A3 + A4): exhaust the balance,
// hit the paywall with NO debit, purchase via a signature-verified simulated
// Polar order.paid (live checkout can't run headless — POLAR_ACCESS_TOKEN is
// deliberately unset, so /api/checkout's 503 is asserted as the honest config
// state; "live checkout/webhook unverified" stays a 🟡 note), then the blocked
// op succeeds, a refund claws back proportionally, and a forged signature is
// rejected. Balance math is delta-based so the file works from any starting
// balance, but it assumes uat-01 ran first on a fresh DB (ordered journey chain).

const INLINE_CRITERIA = [
  {
    name: "Awards",
    status: "Met",
    evidence: "Best-paper award at a top ML conference",
    rationale: "Recognized.",
  },
  {
    name: "Scholarly articles",
    status: "Strong",
    evidence: "6 papers, 412 citations",
    rationale: "Sustained output.",
  },
];

function apiDraft(page: Page) {
  return page.request.post("/api/draft", {
    data: { petitioner: "UAT Developer", classification: "O-1A", criteria: INLINE_CRITERIA },
  });
}

function apiQualify(page: Page) {
  return page.request.post("/api/qualify", {
    data: {
      name: "UAT Developer",
      classification: "O-1A",
      profile:
        "Senior research engineer; 6 papers, 412 citations, a granted patent; " +
        "TechCrunch press; $320K salary; founding engineer at a Series B startup.",
    },
  });
}

test.describe("@uat billing: paywall → purchase → refund", () => {
  test("spending down ends in a 402 that carries cost/balance/disclaimer and never debits", async ({
    page,
  }) => {
    await ensureOnboarded(page);

    // Exhaust the balance with full drafts (the priciest op) until refused.
    let refused: Awaited<ReturnType<typeof apiDraft>> | null = null;
    for (let i = 0; i < 40; i++) {
      const res = await apiDraft(page);
      if (res.status() === 402) {
        refused = res;
        break;
      }
      expect(res.ok(), `draft ${i} should succeed or 402, got ${res.status()}`).toBeTruthy();
    }
    expect(refused, "the balance never ran out — metering is not enforcing").toBeTruthy();

    const body = await refused!.json();
    expect(body.error).toBe("insufficient_tokens");
    expect(body.cost).toBe(PRICE.draft);
    expect(body.balance).toBeLessThan(PRICE.draft);
    expect(String(body.disclaimer).toLowerCase()).toContain("not legal advice");

    // The refusal did not debit: the store agrees with the 402's echo, and a
    // second refused attempt changes nothing.
    expect(await readBalance(page)).toBe(body.balance);
    const again = await apiDraft(page);
    expect(again.status()).toBe(402);
    expect(await readBalance(page)).toBe(body.balance);
  });

  test("the UI paywall blocks with a working purchase CTA and no debit (A3.1)", async ({
    page,
  }) => {
    await ensureOnboarded(page);

    // Drain below the cheapest UI op under test (qualify = 3).
    let balance = await readBalance(page);
    while (balance >= PRICE.qualify) {
      const res = await apiQualify(page);
      expect(res.ok()).toBeTruthy();
      balance -= PRICE.qualify;
    }
    expect(await readBalance(page)).toBe(balance);

    await page.goto("/qualify");
    await page.getByRole("button", { name: /I already know my visa/i }).click();
    await page.getByRole("button", { name: "Use a sample" }).click();
    await page.getByRole("button", { name: "Check my eligibility" }).click();

    const paywall = page.getByRole("alert").filter({ hasText: "Out of tokens" });
    await expect(paywall).toBeVisible({ timeout: 30_000 });
    const cta = paywall.getByRole("link", { name: /Buy more/ });
    await expect(cta).toHaveAttribute("href", "/billing");

    // Blocked ⇒ no debit.
    expect(await readBalance(page)).toBe(balance);
  });

  test("live checkout is honestly unconfigured in this harness (503, no crash)", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const res = await page.request.post("/api/checkout", { data: { bundle: "starter" } });
    expect(res.status()).toBe(503);
  });

  test("a signed order.paid credits the bundle once — replay is idempotent (A3.2)", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    const body = polarOrderEvent("order.paid", { orderId: "uat_order_1" });
    const first = await page.request.post("/api/polar/webhook", {
      headers: polarWebhookHeaders(body),
      data: body,
    });
    expect(first.status()).toBe(200);
    expect(await readBalance(page)).toBe(before + 500);

    // Replay (fresh delivery id, same order id) must not double-credit.
    const replay = await page.request.post("/api/polar/webhook", {
      headers: polarWebhookHeaders(body),
      data: body,
    });
    expect(replay.status()).toBe(200);
    expect(await readBalance(page)).toBe(before + 500);
  });

  test("the previously blocked op now succeeds and debits exactly once (A3.2)", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);
    expect(before).toBeGreaterThanOrEqual(PRICE.qualify);

    const res = await apiQualify(page);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.source).toBe("claude");
    expect(await readBalance(page)).toBe(before - PRICE.qualify);
  });

  test("a refund claws back proportionally to the refunded amount", async ({ page }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    // 250 of the starter's 500 cents refunded → 250 of its 500 tokens reversed.
    const body = polarOrderEvent("order.refunded", { orderId: "uat_order_1", refundedCents: 250 });
    const res = await page.request.post("/api/polar/webhook", {
      headers: polarWebhookHeaders(body),
      data: body,
    });
    expect(res.status()).toBe(200);
    expect(await readBalance(page)).toBe(before - 250);
  });

  test("a forged signature is rejected and credits nothing", async ({ page }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    const body = polarOrderEvent("order.paid", { orderId: "uat_order_forged" });
    const headers = { ...polarWebhookHeaders(body), "webhook-signature": "v1,Zm9yZ2VkZm9yZ2Vk" };
    const res = await page.request.post("/api/polar/webhook", { headers, data: body });
    expect(res.status()).toBe(403);
    expect(await readBalance(page)).toBe(before);
  });

  test("a paid order with an unmapped product is 500'd for retry, never silently dropped", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    const body = polarOrderEvent("order.paid", {
      orderId: "uat_order_unmapped",
      productId: "uat_prod_unknown",
    }).replace('"bundle":"starter"', '"bundle":"nonsense"');
    const res = await page.request.post("/api/polar/webhook", {
      headers: polarWebhookHeaders(body),
      data: body,
    });
    expect(res.status()).toBe(500);
    expect(await readBalance(page)).toBe(before);
  });
});
