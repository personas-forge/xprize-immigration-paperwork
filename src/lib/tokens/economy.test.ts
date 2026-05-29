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

test("costOf: unknown operations default to the light tier (never free/throw)", () => {
  assert.equal(costOf("totally-unknown-op"), OP_COST.light);
});

test("OP_COST weighting stays light < medium < heavy", () => {
  assert.ok(OP_COST.light < OP_COST.medium);
  assert.ok(OP_COST.medium < OP_COST.heavy);
});

// — Bundle lookup ────────────────────────────────────────────────────────────

test("BUNDLES: four bundles, ascending tokens, growing per-token discount", () => {
  assert.equal(BUNDLES.length, 4);
  for (let i = 1; i < BUNDLES.length; i++) {
    assert.ok(BUNDLES[i].tokens > BUNDLES[i - 1].tokens, "tokens ascend");
    assert.ok(
      BUNDLES[i].centsPerToken <= BUNDLES[i - 1].centsPerToken,
      "cents-per-token never increases with size",
    );
  }
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
