import assert from "node:assert/strict";
import { test } from "node:test";

import { QUALIFYING_THRESHOLD, summarizeCriteria } from "./criteria";
import { criteria } from "./data";
import { type Criterion } from "./types";

const make = (status: string): Criterion => ({
  id: status,
  name: status,
  status: status as Criterion["status"],
  evidence: "",
  exhibit: "",
});

test("current case file renders 7 qualifying · 1 partial (no regression)", () => {
  const s = summarizeCriteria(criteria);
  assert.equal(s.total, 8);
  assert.equal(s.qualifying, 7);
  assert.equal(s.partial, 1);
  assert.equal(s.meetsThreshold, true);
});

test("partial count is derived, not hardcoded — multiple partials are counted", () => {
  const s = summarizeCriteria([
    make("Met"),
    make("Partial"),
    make("Partial"),
    make("Strong"),
  ]);
  assert.equal(s.partial, 2, "must reflect actual number of partials");
  assert.equal(s.qualifying, 2);
  assert.equal(s.total, 4);
});

test("threshold: fewer than QUALIFYING_THRESHOLD qualifying does not meet", () => {
  const s = summarizeCriteria([make("Met"), make("Strong")]);
  assert.equal(s.qualifying, 2);
  assert.equal(s.meetsThreshold, QUALIFYING_THRESHOLD <= 2);
  assert.equal(s.meetsThreshold, false);
});

test("robust against data-shape drift: non-array and unknown statuses", () => {
  // @ts-expect-error — exercising untrusted/malformed input
  assert.deepEqual(summarizeCriteria(null), {
    total: 0,
    qualifying: 0,
    partial: 0,
    meetsThreshold: false,
  });

  const s = summarizeCriteria([
    make("Met"),
    make("met"), // wrong casing — must not count as qualifying
    make("Unknown"),
    // @ts-expect-error — missing status field
    { id: "x", name: "x", evidence: "", exhibit: "" },
  ]);
  assert.equal(s.qualifying, 1, "only the exact 'Met' counts");
  assert.equal(s.partial, 0);
  assert.equal(s.total, 1, "malformed rows excluded from total");
});
