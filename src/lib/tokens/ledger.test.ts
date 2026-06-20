import assert from "node:assert/strict";
import { test } from "node:test";

import { charge, credit, grantSignupTokens, reclaim } from "./ledger";

// The boundary guards reject before any store access (no DB needed): a debit
// cost must be a non-negative bounded integer, a credit may be negative (refund
// clawback) but must be a bounded finite integer. This is the money kernel's
// self-defense — a mis-signed or non-finite value can't invert a debit into a
// credit or overflow a balance.

test("charge rejects negative, NaN, fractional, and over-cap costs", async () => {
  for (const bad of [-1, NaN, Infinity, 1.5, 2_000_000]) {
    await assert.rejects(() => charge("u1", bad, "draft", "ref"), /charge cost/);
  }
});

test("grantSignupTokens rejects negative / non-finite amounts", async () => {
  for (const bad of [-5, NaN, 5_000_000]) {
    await assert.rejects(() => grantSignupTokens("u1", bad), /charge cost/);
  }
});

test("credit rejects NaN / fractional / over-cap but ALLOWS negative (refund)", async () => {
  for (const bad of [NaN, Infinity, 1.25, 9_999_999]) {
    await assert.rejects(() => credit("u1", bad, "purchase", "ref"), /credit amount/);
  }
  // A negative credit (refund clawback) must pass validation (no store → 0).
  await assert.doesNotReject(() => credit("u1", -500, "refund", "ref"));
  await assert.doesNotReject(() => reclaim("u1", 3, "ref"));
});
