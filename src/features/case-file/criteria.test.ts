import assert from "node:assert/strict";
import { test } from "node:test";

import { QUALIFYING_THRESHOLD, classifyStatus, statusTone, summarizeCriteria } from "./criteria";
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

// --- ADR 0002: row tone must be status-safe and counts derived from data ---

test("statusTone: current case-file rows render their established tones (no regression)", () => {
  // Pins the rendering preserved by ADR 0002 for the live dataset.
  for (const c of criteria) {
    const expected = c.status === "Partial" ? "warning" : "success";
    assert.equal(statusTone(c.status), expected, `${c.name} (${c.status})`);
  }
  // 8 criteria, 7 success + 1 warning — matches the summary (7 qualifying · 1 partial).
  const tones = criteria.map((c) => statusTone(c.status));
  assert.equal(tones.filter((t) => t === "success").length, 7);
  assert.equal(tones.filter((t) => t === "warning").length, 1);
  assert.equal(tones.filter((t) => t === "neutral").length, 0);
});

test("statusTone: unknown/absent status is never 'success' (must not paint unscored rows green)", () => {
  assert.equal(statusTone("Unknown"), "neutral");
  assert.equal(statusTone("met"), "neutral", "wrong casing is not a known status");
  assert.equal(statusTone(undefined), "neutral");
  assert.equal(statusTone(null), "neutral");
  assert.equal(statusTone(""), "neutral");
  // The core ADR 0002 invariant: a row the summary would exclude must not look "met".
  assert.notEqual(statusTone("Unknown"), "success");
});

test("statusTone: agrees with summarizeCriteria — only rows it tones success/warning are counted", () => {
  const rows: { status: string }[] = [
    { status: "Met" },
    { status: "Strong" },
    { status: "Partial" },
    { status: "Unknown" }, // unscored: neutral tone AND excluded from total
  ];
  const counted = rows.filter((r) => statusTone(r.status) !== "neutral").length;
  const s = summarizeCriteria(rows as Criterion[]);
  assert.equal(counted, s.total, "non-neutral rows equal the evaluated total");
  assert.equal(s.total, 3);
});

test("classifyStatus: single source of truth — tone and summary can't drift", () => {
  assert.equal(classifyStatus("Met"), "qualifying");
  assert.equal(classifyStatus("Strong"), "qualifying");
  assert.equal(classifyStatus("Partial"), "partial");
  for (const other of ["met", "Meets", "Unknown", "", null, undefined]) {
    assert.equal(classifyStatus(other), "other", `${String(other)} → other`);
    assert.equal(statusTone(other), "neutral", "other → neutral tone");
  }
  // The summary's total is exactly the rows classifyStatus does not call "other".
  const rows = [
    { status: "Met" },
    { status: "Strong" },
    { status: "Partial" },
    { status: "Unknown" },
    { status: "" },
  ] as Criterion[];
  const counted = rows.filter((r) => classifyStatus(r.status) !== "other").length;
  assert.equal(summarizeCriteria(rows).total, counted, "summary total == non-other rows");
  assert.equal(counted, 3);
});

test("table read-out tracks data length and threshold constant, not hardcoded 8/3", () => {
  // The denominator the header renders is criteria.length, not a literal 8.
  assert.equal(criteria.length, summarizeCriteria(criteria).total);
  // Threshold text is sourced from the constant.
  assert.equal(QUALIFYING_THRESHOLD, 3);
});
