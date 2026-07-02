import assert from "node:assert/strict";
import { test } from "node:test";

import { polarEventToRevenue } from "./relay-revenue";

// validateEvent zod-parses webhook deliveries into camelCase before this mapper
// ever sees them (`totalAmount`, `subscriptionId`, `refundedAmount`). These
// tests feed the mapper CAMELIZED events — the shape it receives in production —
// pinning the fix for the bug where raw snake_case reads made every paid order
// resolve to null (no revenue relayed) and every refund mis-amount.

const camelPaidOrder = {
  id: "ord_1",
  createdAt: "2026-07-02T10:00:00Z",
  totalAmount: 4800,
  netAmount: 4500,
  currency: "usd",
  subscriptionId: null,
  productId: "prod_pro",
  metadata: { userId: "user_1", bundle: "pro" },
  customer: { externalId: "user_1" },
};

test("order.paid (camelized, as validateEvent returns it) relays the paid total", () => {
  const r = polarEventToRevenue({ type: "order.paid", data: camelPaidOrder });
  assert.ok(r, "a verified paid order must relay revenue, not resolve to null");
  assert.equal(r.externalId, "ord_1");
  assert.equal(r.amountUsd, 48);
  assert.equal(r.kind, "one_time");
  assert.equal(r.customerId, "user_1");
  assert.equal(r.productId, "prod_pro");
  assert.equal(r.ts, "2026-07-02T10:00:00Z");
});

test("order.paid with a camelized subscriptionId is recurring revenue", () => {
  const r = polarEventToRevenue({
    type: "order.paid",
    data: { ...camelPaidOrder, subscriptionId: "sub_1" },
  });
  assert.equal(r?.kind, "subscription");
});

test("order.paid falls back to netAmount when totalAmount is absent", () => {
  const { totalAmount: _dropped, ...rest } = camelPaidOrder;
  const r = polarEventToRevenue({ type: "order.paid", data: rest });
  assert.equal(r?.amountUsd, 45);
});

test("order.refunded (camelized) nets down by the refunded amount", () => {
  const r = polarEventToRevenue({
    type: "order.refunded",
    data: { ...camelPaidOrder, refundedAmount: 250 },
  });
  assert.ok(r);
  assert.equal(r.kind, "refund");
  assert.equal(r.amountUsd, 2.5);
  assert.equal(r.externalId, "ord_1");
});

test("refund.created (camelized Refund payload) keys on the refund id and its amount", () => {
  const r = polarEventToRevenue({
    type: "refund.created",
    data: {
      id: "refund_1",
      orderId: "ord_1",
      amount: 500,
      currency: "usd",
      createdAt: "2026-07-02T11:00:00Z",
      metadata: { userId: "user_1" },
    },
  });
  assert.ok(r);
  assert.equal(r.externalId, "refund_1");
  assert.equal(r.amountUsd, 5);
  assert.equal(r.ts, "2026-07-02T11:00:00Z");
});

test("snake_case payloads (unparsed/legacy) still resolve identically", () => {
  const r = polarEventToRevenue({
    type: "order.paid",
    data: {
      id: "ord_2",
      created_at: "2026-07-02T10:00:00Z",
      total_amount: 1500,
      currency: "usd",
      subscription_id: "sub_2",
      product_id: "prod_builder",
      metadata: { userId: "user_2" },
    },
  });
  assert.ok(r);
  assert.equal(r.amountUsd, 15);
  assert.equal(r.kind, "subscription");
});

test("non-order events resolve to null", () => {
  assert.equal(polarEventToRevenue({ type: "checkout.created", data: {} }), null);
});
