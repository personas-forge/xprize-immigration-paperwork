import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DISCLAIMER,
  O1A_CRITERIA,
  buildCategorizePrompt,
  buildCategorizeResult,
  mockCategorize,
  parseCategorizeRequest,
  parseCategorizeResponse,
  summarizeVault,
  type CategorizeRequest,
} from "./evidence";

const valid: CategorizeRequest = {
  name: "ICML Best Paper certificate.pdf",
  content: "This certifies the Best Paper Award at ICML 2024 to the recipient. Signed by the chairs.",
};

// — Validation ────────────────────────────────────────────────────────────

test("parseCategorizeRequest: requires a name and enough content", () => {
  assert.equal(parseCategorizeRequest({ name: "x", content: "short" }).ok, false);
  assert.equal(parseCategorizeRequest({ content: valid.content }).ok, false);
  for (const bad of [null, "x", 42, []]) assert.equal(parseCategorizeRequest(bad).ok, false);
  const ok = parseCategorizeRequest({ name: "  CV  ", content: valid.content });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.name, "CV");
});

// — Disclaimer ───────────────────────────────────────────────────────────────

test("buildCategorizeResult: ALWAYS attaches the disclaimer", () => {
  for (const source of ["mock", "gemini"] as const) {
    const r = buildCategorizeResult(mockCategorize(valid), source);
    assert.equal(r.disclaimer, DISCLAIMER);
    assert.equal(r.source, source);
  }
});

// — Prompt safety ────────────────────────────────────────────────────────────

test("buildCategorizePrompt: one criterion, no invention, JSON, names criteria", () => {
  const p = buildCategorizePrompt(valid).toLowerCase();
  assert.ok(p.includes("exactly one"));
  assert.ok(p.includes("do not invent"));
  assert.ok(p.includes("json"));
  assert.ok(p.includes("awards") && p.includes("scholarly articles"));
});

// — Response parsing ─────────────────────────────────────────────────────────

test("parseCategorizeResponse: accepts a valid bucket, clamps facts", () => {
  const model = JSON.stringify({
    criterion: "Awards",
    facts: ["Best Paper at ICML 2024", "", "x", "y", "z", "a", "b", "c"],
  });
  const a = parseCategorizeResponse(model, valid);
  assert.equal(a.criterion, "Awards");
  assert.ok(a.facts.length <= 6);
  assert.ok(!a.facts.includes(""));
});

test("parseCategorizeResponse: unknown criterion → Unsorted; garbage → mock", () => {
  const a = parseCategorizeResponse(JSON.stringify({ criterion: "Nonsense", facts: [] }), valid);
  assert.equal(a.criterion, "Unsorted");
  assert.deepEqual(parseCategorizeResponse("not json", valid), mockCategorize(valid));
});

// — Mock determinism ─────────────────────────────────────────────────────────

test("mockCategorize: deterministic; keys an award to Awards", () => {
  assert.deepEqual(mockCategorize(valid), mockCategorize(valid));
  assert.equal(mockCategorize(valid).criterion, "Awards");
  const unsorted = mockCategorize({ name: "random.txt", content: "A note about lunch plans and weather." });
  assert.equal(unsorted.criterion, "Unsorted");
});

// — Coverage analysis ────────────────────────────────────────────────────────

test("summarizeVault: counts buckets and reports gaps", () => {
  const docs = [
    { criterion: "Awards" },
    { criterion: "Awards" },
    { criterion: "Press" },
    { criterion: "Unsorted" },
  ];
  const s = summarizeVault(docs);
  assert.equal(s.total, 8);
  assert.equal(s.covered, 2, "Awards + Press");
  assert.equal(s.byCriterion["Awards"], 2);
  assert.equal(s.byCriterion["Unsorted"], 1);
  assert.ok(s.gaps.includes("Judging"));
  assert.ok(!s.gaps.includes("Awards"));
  assert.equal(s.gaps.length, 6);
});

test("summarizeVault: robust against non-array input", () => {
  const s = summarizeVault(undefined as unknown as { criterion: string }[]);
  assert.equal(s.covered, 0);
  assert.equal(s.gaps.length, O1A_CRITERIA.length);
});
