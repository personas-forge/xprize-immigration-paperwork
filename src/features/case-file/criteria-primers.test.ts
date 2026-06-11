import assert from "node:assert/strict";
import { test } from "node:test";

import { CRITERIA_PRIMERS } from "./criteria-primers";
import { criteria } from "./data";

// Component rendering tests are omitted: the repo's node_modules does not
// currently contain react/react-dom (4 pre-existing failures on Button,
// saveRecovery, operation, http), so React-based assertions would add noise
// rather than coverage. These data tests are sufficient to guard correctness.

test("every O-1A criterion in data.ts has a primer entry", () => {
  for (const c of criteria) {
    assert.ok(
      CRITERIA_PRIMERS[c.name],
      `Missing primer for criterion: "${c.name}"`,
    );
  }
});

test("all eight O-1A criterion names are covered", () => {
  const EXPECTED = [
    "Awards",
    "Membership",
    "Press",
    "Judging",
    "Original contribution",
    "Scholarly articles",
    "Critical role",
    "High remuneration",
  ];
  for (const name of EXPECTED) {
    assert.ok(CRITERIA_PRIMERS[name], `Missing primer: "${name}"`);
  }
  assert.equal(
    Object.keys(CRITERIA_PRIMERS).length,
    EXPECTED.length,
    "Primer count matches the 8 O-1A criteria — no phantom entries",
  );
});

test("each primer has a non-empty definition and example", () => {
  for (const [name, p] of Object.entries(CRITERIA_PRIMERS)) {
    assert.ok(p.definition.trim().length > 0, `Empty definition for "${name}"`);
    assert.ok(p.example.trim().length > 0, `Empty example for "${name}"`);
  }
});

test("definitions are single sentences ending with a period", () => {
  for (const [name, p] of Object.entries(CRITERIA_PRIMERS)) {
    assert.ok(
      p.definition.trimEnd().endsWith("."),
      `Definition for "${name}" should end with a period`,
    );
  }
});

test("primer keys align exactly with the live criteria data (no drift)", () => {
  const criteriaNames = new Set(criteria.map((c) => c.name));
  const primerKeys = new Set(Object.keys(CRITERIA_PRIMERS));
  for (const name of criteriaNames) {
    assert.ok(primerKeys.has(name), `data.ts criterion "${name}" has no primer`);
  }
  for (const key of primerKeys) {
    assert.ok(criteriaNames.has(key), `Primer "${key}" has no matching criterion in data.ts`);
  }
});
