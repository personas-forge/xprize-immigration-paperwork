import assert from "node:assert/strict";
import { test } from "node:test";

import {
  OPERATION_REGISTRY,
  TIER_COST,
  costOf,
  labelOf,
  type OperationKey,
} from "./registry";
import { OP_COST, costOf as economyCostOf } from "./economy";
import { RATE_LIMITS } from "./rate-limit";

// The six metered AI operations and their grounded, must-not-drift values
// (ADR-0007 table). This table is the contract the registry must preserve.
const EXPECTED = {
  draft: { tier: "xl", cost: 12, rateLimit: 20 },
  draft_section: { tier: "heavy", cost: 5, rateLimit: undefined },
  rfe: { tier: "heavy", cost: 5, rateLimit: 20 },
  qualify: { tier: "medium", cost: 3, rateLimit: 40 },
  guidance: { tier: "light", cost: 1, rateLimit: 40 },
  categorize: { tier: "light", cost: 1, rateLimit: 40 },
} as const;

// — TIER_COST ────────────────────────────────────────────────────────────────

test("TIER_COST: weights are light=1 < medium=3 < heavy=5 < xl=12", () => {
  assert.deepEqual(TIER_COST, { light: 1, medium: 3, heavy: 5, xl: 12 });
  assert.ok(TIER_COST.light < TIER_COST.medium);
  assert.ok(TIER_COST.medium < TIER_COST.heavy);
  assert.ok(TIER_COST.heavy < TIER_COST.xl);
});

// — Registry shape ───────────────────────────────────────────────────────────

test("OPERATION_REGISTRY: defines exactly the six metered operations", () => {
  assert.deepEqual(
    Object.keys(OPERATION_REGISTRY).sort(),
    Object.keys(EXPECTED).sort(),
  );
});

test("OPERATION_REGISTRY: tier, cost, and rateLimit match the grounded table", () => {
  for (const [op, want] of Object.entries(EXPECTED)) {
    const def = OPERATION_REGISTRY[op as OperationKey];
    assert.equal(def.tier, want.tier, `${op} tier`);
    assert.equal(costOf(op), want.cost, `${op} cost`);
    assert.equal(
      (def as { rateLimit?: number }).rateLimit,
      want.rateLimit,
      `${op} rateLimit`,
    );
  }
});

test("OPERATION_REGISTRY: every op has a non-empty human label", () => {
  for (const op of Object.keys(OPERATION_REGISTRY) as OperationKey[]) {
    assert.equal(typeof labelOf(op), "string");
    assert.ok(labelOf(op).length > 0, `${op} label`);
  }
});

// — costOf ───────────────────────────────────────────────────────────────────

test("costOf: unknown operations default to the light tier (never free/throw)", () => {
  assert.equal(costOf("totally-unknown-op"), TIER_COST.light);
  assert.equal(costOf(""), TIER_COST.light);
});

// — Derivation invariants: economy.ts + rate-limit.ts must mirror the registry ─

test("economy.ts OP_COST is the registry's TIER_COST (single source of truth)", () => {
  assert.deepEqual(OP_COST, TIER_COST);
});

test("economy.ts costOf is the registry costOf (re-export, identical results)", () => {
  assert.equal(economyCostOf, costOf);
  for (const op of Object.keys(EXPECTED)) {
    assert.equal(economyCostOf(op), costOf(op), `${op}`);
  }
});

test("rate-limit.ts RATE_LIMITS keeps the five route buckets, sourced from the registry", () => {
  assert.deepEqual(Object.keys(RATE_LIMITS).sort(), [
    "categorize",
    "draft",
    "guidance",
    "qualify",
    "rfe",
  ]);
  assert.equal(RATE_LIMITS.draft, OPERATION_REGISTRY.draft.rateLimit);
  assert.equal(RATE_LIMITS.rfe, OPERATION_REGISTRY.rfe.rateLimit);
  assert.equal(RATE_LIMITS.qualify, OPERATION_REGISTRY.qualify.rateLimit);
  assert.equal(RATE_LIMITS.guidance, OPERATION_REGISTRY.guidance.rateLimit);
  assert.equal(RATE_LIMITS.categorize, OPERATION_REGISTRY.categorize.rateLimit);
  // Exact grounded caps — guards against an accidental reprice. `qualify` gained
  // its 40/window cap in the qualify migration (ADR-0005, PR #12); `draft_section`
  // shares the `draft` bucket so it has no own entry.
  assert.deepEqual(RATE_LIMITS, {
    draft: 20,
    rfe: 20,
    qualify: 40,
    guidance: 40,
    categorize: 40,
  });
});
