import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BUNDLES,
  FREE_SIGNUP_GRANT,
  bundleByKey,
  bundleByProductId,
  bundlePriceLabel,
  formatCentsPerToken,
  formatUsdCents,
} from "./economy";
import { isMeteringEnforced } from "@/lib/db/config";

// Per-operation cost (`costOf` / `TIER_COST` / `OpTier`) lives in the
// OperationRegistry and is tested in registry.test.ts. This suite covers what
// economy.ts owns: the signup grant, the metering-bypass switch, and bundles.

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
  assert.equal(starter?.priceCents, 500); // cents are the source of truth
  assert.equal(bundleByKey("nope"), undefined);
});

test("priceCents is consistent with the advertised per-token rate", () => {
  // priceCents is the SOURCE OF TRUTH; centsPerToken is the headline rate. They
  // must agree (price / tokens), or the grid advertises a discount it won't honor.
  for (const b of BUNDLES) {
    assert.ok(Number.isInteger(b.priceCents) && b.priceCents > 0, `${b.key} priceCents`);
    const impliedRate = b.priceCents / b.tokens;
    assert.ok(
      Math.abs(impliedRate - b.centsPerToken) < 0.001,
      `${b.key}: priceCents/tokens (${impliedRate}) ≈ centsPerToken (${b.centsPerToken})`,
    );
  }
});

test("currency formatting: one convention, whole-dollar bundles drop the .00", () => {
  // Whole-dollar prices render compactly; the recurring plan keeps its "/mo".
  assert.equal(formatUsdCents(500), "$5");
  assert.equal(formatUsdCents(1999), "$19.99");
  assert.equal(bundlePriceLabel(bundleByKey("starter")!), "$5");
  assert.equal(bundlePriceLabel(bundleByKey("scale")!), "$150");
  assert.equal(bundlePriceLabel(bundleByKey("monthly")!), "$19/mo");
  // The sub-cent rate uses the same fixed-2-decimal convention as the price.
  assert.equal(formatCentsPerToken(1.0), "1.00¢");
  assert.equal(formatCentsPerToken(0.6), "0.60¢");
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

test("isMeteringEnforced: TOKENS_BYPASS=1 forces a free pass even with a store", () => {
  assert.equal(
    isMeteringEnforced({ TOKENS_BYPASS: "1", DB_DRIVER: "pglite" }),
    false,
  );
});

test("isMeteringEnforced: no store configured → free pass (keyless build/dev)", () => {
  assert.equal(isMeteringEnforced({ TOKENS_BYPASS: "" }), false);
  assert.equal(isMeteringEnforced({}), false);
});

test("isMeteringEnforced: store configured (pglite) and no bypass → economy IS enforced", () => {
  assert.equal(isMeteringEnforced({ DB_DRIVER: "pglite" }), true);
});

test("isMeteringEnforced: Firestore-prod shape (no DATABASE_URL) is ENFORCED, not bypassed", () => {
  // The exact config the three predicates used to disagree on: prod + a Firestore
  // project, NO DATABASE_URL. The guard charges here, so metering must read on.
  assert.equal(
    isMeteringEnforced({ NODE_ENV: "production", FIRESTORE_PROJECT_ID: "p" }),
    true,
  );
  // A bare DATABASE_URL is NOT a store signal (the store is driver-selected) —
  // the old !DATABASE_URL heuristic is gone.
  assert.equal(isMeteringEnforced({ DATABASE_URL: "postgres://x" }), false);
});
