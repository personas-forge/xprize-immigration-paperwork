import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextRequest } from "next/server";

import type { RevenueRelay, WebhookEvent } from "./relay-revenue";
import type { WebhookDeps } from "./route";

// The webhook's MONEY semantics, pinned against injected fakes (WebhookDeps):
// when Polar is 200-acked vs told to retry, and exactly what credit() is called
// with. Signature CRYPTO is deliberately out of scope — validateEvent is faked
// here (the standardwebhooks handshake is covered end-to-end by the UAT suite).
//
// economy.ts captures POLAR_PRODUCT_* into BUNDLES at module load, so the route
// import must stay DYNAMIC, after the product env is set — a static import
// would hoist above the assignment and freeze an env-less catalog in which no
// product id resolves. The pro bundle (8000 tokens / $48) anchors the math.
process.env.POLAR_PRODUCT_PRO = "prod_test_pro";
const { handleWebhook } = await import("./route");

const ENV_KEYS = ["POLAR_WEBHOOK_SECRET"] as const;

function withEnv<T>(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => Promise<T>): Promise<T> {
  const mutable = process.env as Record<string, string | undefined>;
  const saved = ENV_KEYS.map((k) => [k, mutable[k]] as const);
  for (const k of ENV_KEYS) delete mutable[k];
  for (const [k, v] of Object.entries(env)) mutable[k] = v;
  return fn().finally(() => {
    for (const [k, v] of saved) {
      if (v === undefined) delete mutable[k];
      else mutable[k] = v;
    }
  });
}

const SECRET = { POLAR_WEBHOOK_SECRET: "whsec_test" };

/** A minimal POST the handler can `.text()` — the body is opaque to the tests
 *  because validateEvent is faked; only its verified RESULT drives the route. */
function req(body = "{}"): NextRequest {
  return new Request("http://localhost/api/polar/webhook", {
    method: "POST",
    headers: { "webhook-id": "wh_test" },
    body,
  }) as unknown as NextRequest;
}

type CreditCall = {
  userId: string;
  amount: number;
  reason: string;
  ref: string | null;
  metadata: Record<string, unknown>;
};

/** Deps whose ledger records every call; store defaults to configured. */
function fakeDeps(over: Partial<WebhookDeps> = {}) {
  const calls = {
    credit: [] as CreditCall[],
    revenue: [] as RevenueRelay[],
  };
  const deps: WebhookDeps = {
    validateEvent: () => {
      throw new Error("validateEvent not wired for this test");
    },
    credit: async (userId, amount, reason, ref, metadata = {}) => {
      calls.credit.push({ userId, amount, reason, ref, metadata });
      return amount;
    },
    trackRevenue: async (revenue) => {
      calls.revenue.push(revenue);
    },
    storeConfigured: () => true,
    ...over,
  };
  return { deps, calls };
}

/** Deps whose validateEvent "verifies" to the given event — the shape the SDK
 *  returns for a genuine delivery (zod-parsed, camelCased). */
function eventDeps(event: WebhookEvent, over: Partial<WebhookDeps> = {}) {
  return fakeDeps({ validateEvent: () => event, ...over });
}

// ── Delivery gating: when do we ack vs make Polar retry? ────────────────────

test("no POLAR_WEBHOOK_SECRET → 503, nothing minted (unverifiable ≠ ack)", async () => {
  // Without the secret NO delivery can be verified; a 200 here would ack (and
  // drop) real payments on a misconfigured deployment. 503 makes Polar retry.
  await withEnv({}, async () => {
    const { deps, calls } = fakeDeps();
    const res = await handleWebhook(req(), deps);
    assert.equal(res.status, 503);
    assert.equal(calls.credit.length, 0);
  });
});

test("store not configured → 503, nothing minted (a captured payment must never be 200-acked unminted)", async () => {
  // With no store, credit() silently no-ops — a 200 would tell Polar the order
  // was credited when nothing was persisted. 503 forces retries until fixed.
  await withEnv(SECRET, async () => {
    const { deps, calls } = fakeDeps({ storeConfigured: () => false });
    const res = await handleWebhook(req(), deps);
    assert.equal(res.status, 503);
    assert.equal(calls.credit.length, 0);
  });
});

test("validateEvent throws → 403, nothing minted (forged deliveries mint nothing)", async () => {
  // An unverifiable signature must be rejected BEFORE any payload field is
  // trusted — otherwise anyone who finds the URL can mint tokens.
  await withEnv(SECRET, async () => {
    const { deps, calls } = fakeDeps({
      validateEvent: () => {
        throw new Error("bad signature");
      },
    });
    const res = await handleWebhook(req(), deps);
    assert.equal(res.status, 403);
    assert.equal(calls.credit.length, 0);
  });
});

// ── order.paid: the mint path ────────────────────────────────────────────────

test("order.paid (resolvable) → 200 and EXACTLY one credit keyed on the order id", async () => {
  // The order id as ref is the idempotency key: Polar re-deliveries and the
  // order.created+order.paid pair dedupe in the ledger, so exactly-once minting
  // depends on this precise argument tuple.
  await withEnv(SECRET, async () => {
    const { deps, calls } = eventDeps({
      type: "order.paid",
      data: {
        id: "ord_paid_1",
        totalAmount: 4800,
        currency: "usd",
        productId: "prod_test_pro",
        metadata: { userId: "user_1", bundle: "pro" },
      },
    });
    const res = await handleWebhook(req(), deps);
    assert.equal(res.status, 200);
    assert.deepEqual(calls.credit, [
      { userId: "user_1", amount: 8000, reason: "purchase", ref: "ord_paid_1", metadata: { bundle: "pro" } },
    ]);
  });
});

test("order.paid unresolvable (unknown product, no metadata.bundle) → 500, no credit", async () => {
  // A payment we captured but cannot map must NOT be 200-acked: that leaves a
  // paying customer uncredited and unobservable. 500 keeps Polar retrying while
  // an operator fixes the product mapping.
  await withEnv(SECRET, async () => {
    const { deps, calls } = eventDeps({
      type: "order.paid",
      data: {
        id: "ord_unmapped",
        totalAmount: 4800,
        productId: "prod_unknown",
        metadata: { userId: "user_1" },
      },
    });
    const res = await handleWebhook(req(), deps);
    assert.equal(res.status, 500);
    assert.equal(calls.credit.length, 0);
  });
});

test("bundle mismatch → the PAID product's bundle is credited, never the metadata one", async () => {
  // metadata.bundle is client-influenced; the product id is the signed, paid
  // fact. Trusting metadata here would let a $48 Pro checkout mint the 30000-
  // token Scale bundle (60x the tokens actually paid for).
  await withEnv(SECRET, async () => {
    const { deps, calls } = eventDeps({
      type: "order.paid",
      data: {
        id: "ord_mismatch",
        totalAmount: 4800,
        productId: "prod_test_pro",
        metadata: { userId: "user_1", bundle: "scale" },
      },
    });
    const res = await handleWebhook(req(), deps);
    assert.equal(res.status, 200);
    assert.deepEqual(calls.credit, [
      { userId: "user_1", amount: 8000, reason: "purchase", ref: "ord_mismatch", metadata: { bundle: "pro" } },
    ]);
  });
});

// ── Refunds: the clawback path ───────────────────────────────────────────────

test("order.refunded at half the bundle price → NEGATIVE proportional clawback keyed refund:{orderId}", async () => {
  // Polar supports PARTIAL refunds: refunding $24 of the $48 Pro bundle must
  // reverse 4000 of its 8000 tokens, not the whole grant. The `refund:` ref
  // prefix keeps the clawback from deduping against the purchase credit (same
  // order id), while still deduping re-delivered refund events.
  await withEnv(SECRET, async () => {
    const { deps, calls } = eventDeps({
      type: "order.refunded",
      data: {
        id: "ord_refunded_1",
        refundedAmount: 2400,
        productId: "prod_test_pro",
        metadata: { userId: "user_1", bundle: "pro" },
      },
    });
    const res = await handleWebhook(req(), deps);
    assert.equal(res.status, 200);
    assert.deepEqual(calls.credit, [
      { userId: "user_1", amount: -4000, reason: "refund", ref: "refund:ord_refunded_1", metadata: { bundle: "pro" } },
    ]);
  });
});

test("refund.created without order_id/orderId → 200, no clawback (surfaced, not retried)", async () => {
  // Without the ORIGINAL order id there is no safe dedupe key — keying on the
  // per-attempt refund id would let re-delivered refunds double-debit. This is
  // a reversal (not a captured payment), so we don't 500-to-retry: it's logged
  // for operator reconciliation and acked.
  await withEnv(SECRET, async () => {
    const { deps, calls } = eventDeps({
      type: "refund.created",
      data: {
        id: "refund_1",
        amount: 2400,
        productId: "prod_test_pro",
        metadata: { userId: "user_1" },
      },
    });
    const res = await handleWebhook(req(), deps);
    assert.equal(res.status, 200);
    assert.equal(calls.credit.length, 0);
  });
});

// ── Revenue relay: observability, never money movement ──────────────────────

test("order.paid relays the mapped revenue to trackRevenue", async () => {
  // Margin telemetry joins this revenue to LLM cost on the same user id; the
  // dollar amount comes from the paid total, independent of the token grant.
  await withEnv(SECRET, async () => {
    const { deps, calls } = eventDeps({
      type: "order.paid",
      data: {
        id: "ord_paid_2",
        totalAmount: 4800,
        currency: "usd",
        productId: "prod_test_pro",
        metadata: { userId: "user_1", bundle: "pro" },
      },
    });
    const res = await handleWebhook(req(), deps);
    assert.equal(res.status, 200);
    assert.equal(calls.revenue.length, 1);
    const r = calls.revenue[0];
    assert.equal(r.externalId, "ord_paid_2");
    assert.equal(r.customerId, "user_1");
    assert.equal(r.productId, "prod_test_pro");
    assert.equal(r.amountUsd, 48);
    assert.equal(r.kind, "one_time");
  });
});

test("a trackRevenue failure does NOT break the 200 (telemetry is best-effort)", async () => {
  // The order was credited; failing the delivery over telemetry would make
  // Polar re-deliver a settled order for the sake of an observability write.
  await withEnv(SECRET, async () => {
    const { deps, calls } = eventDeps(
      {
        type: "order.paid",
        data: {
          id: "ord_paid_3",
          totalAmount: 4800,
          productId: "prod_test_pro",
          metadata: { userId: "user_1", bundle: "pro" },
        },
      },
      {
        trackRevenue: async () => {
          throw new Error("LightTrack unreachable");
        },
      },
    );
    const res = await handleWebhook(req(), deps);
    assert.equal(res.status, 200);
    assert.equal(calls.credit.length, 1, "the credit must have landed before the relay attempt");
  });
});
