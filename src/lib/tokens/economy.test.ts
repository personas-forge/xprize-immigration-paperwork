import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BUNDLES,
  FREE_SIGNUP_GRANT,
  OP_COST,
  bundleByKey,
  bundleByProductId,
  costOf,
  isMeteringBypassed,
} from "./economy";

// — Per-operation cost ───────────────────────────────────────────────────────

test("costOf: this app's `guidance` op is light = 1 token", () => {
  assert.equal(costOf("guidance"), 1);
  assert.equal(costOf("guidance"), OP_COST.light);
});

test("costOf: `qualify` is medium and `draft` is the xl premium tier", () => {
  assert.equal(costOf("qualify"), OP_COST.medium);
  assert.equal(costOf("draft"), OP_COST.xl);
});

test("costOf: regenerating one `draft_section` is the heavy tier", () => {
  assert.equal(costOf("draft_section"), OP_COST.heavy);
});

test("costOf: an `rfe` response is the heavy tier", () => {
  assert.equal(costOf("rfe"), OP_COST.heavy);
});

test("costOf: evidence `categorize` is the light tier", () => {
  assert.equal(costOf("categorize"), OP_COST.light);
});

test("costOf: unknown operations default to the light tier (never free/throw)", () => {
  assert.equal(costOf("totally-unknown-op"), OP_COST.light);
});

test("OP_COST weighting stays light < medium < heavy < xl", () => {
  assert.ok(OP_COST.light < OP_COST.medium);
  assert.ok(OP_COST.medium < OP_COST.heavy);
  assert.ok(OP_COST.heavy < OP_COST.xl);
});

// — Bundle lookup ────────────────────────────────────────────────────────────

test("BUNDLES: four one-time bundles, ascending tokens, growing per-token discount", () => {
  // The size-discount ladder applies to ONE-TIME bundles only; the recurring
  // monthly allowance is a convenience plan priced between builder and pro
  // rates, asserted separately below.
  const oneTime = BUNDLES.filter((b) => !b.recurring);
  assert.equal(oneTime.length, 4);
  for (let i = 1; i < oneTime.length; i++) {
    assert.ok(oneTime[i].tokens > oneTime[i - 1].tokens, "tokens ascend");
    assert.ok(
      oneTime[i].centsPerToken <= oneTime[i - 1].centsPerToken,
      "cents-per-token never increases with size",
    );
  }
});

test("BUNDLES: the monthly subscription is recurring and priced inside the ladder", () => {
  const monthly = BUNDLES.find((b) => b.recurring);
  assert.ok(monthly, "a recurring bundle exists");
  assert.equal(monthly?.key, "monthly");
  assert.equal(monthly?.tokens, 2500);
  // $19/2,500 = 0.76¢/token — cheaper than starter, a hair above the builder
  // one-time rate (the recurring convenience premium), never beating pro.
  const starter = bundleByKey("starter");
  const pro = bundleByKey("pro");
  assert.ok(
    monthly!.centsPerToken < starter!.centsPerToken && monthly!.centsPerToken > pro!.centsPerToken,
    "monthly rate sits inside the starter–pro band",
  );
});

test("bundleByKey: resolves a known key and rejects an unknown one", () => {
  const starter = bundleByKey("starter");
  assert.ok(starter);
  assert.equal(starter?.tokens, 500);
  assert.equal(starter?.priceLabel, "$5");
  assert.equal(bundleByKey("nope"), undefined);
});

test("bundleByProductId: matches only when a product id is set", () => {
  // No env product ids in the keyless test build → no false positives.
  assert.equal(bundleByProductId(""), undefined);
  assert.equal(bundleByProductId("prod_does_not_exist"), undefined);
});

test("FREE_SIGNUP_GRANT is a positive integer", () => {
  assert.ok(Number.isInteger(FREE_SIGNUP_GRANT) && FREE_SIGNUP_GRANT > 0);
});

// — Guard bypass branch ──────────────────────────────────────────────────────

test("isMeteringBypassed: TOKENS_BYPASS=1 forces a free pass even with a DB", () => {
  assert.equal(
    isMeteringBypassed({ TOKENS_BYPASS: "1", DATABASE_URL: "postgres://x" }),
    true,
  );
});

test("isMeteringBypassed: no DATABASE_URL → free pass (keyless build/dev)", () => {
  assert.equal(isMeteringBypassed({ TOKENS_BYPASS: "", DATABASE_URL: "" }), true);
  assert.equal(isMeteringBypassed({}), true);
});

test("isMeteringBypassed: DB configured and no bypass → economy IS enforced", () => {
  assert.equal(
    isMeteringBypassed({ TOKENS_BYPASS: "", DATABASE_URL: "postgres://x" }),
    false,
  );
});
