import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DISCLAIMER,
  buildRfePrompt,
  buildRfeResult,
  mockRfe,
  parseRfeRequest,
  parseRfeResponse,
  tryParseRfeResponse,
  type RfeRequest,
} from "./rfe";

const valid: RfeRequest = {
  petitioner: "Dr. Anya Krishnan",
  classification: "O-1A",
  rfeText:
    "The evidence does not establish that the beneficiary satisfies the judging criterion. " +
    "Please submit additional documentation.",
  criteria: [
    { name: "Awards", status: "Met", evidence: "Best-paper award", rationale: "Recognized." },
    { name: "Judging", status: "Partial", evidence: "", rationale: "Thin." },
    { name: "Press", status: "None", evidence: "", rationale: "None found." },
  ],
};

// — Validation ────────────────────────────────────────────────────────────

test("parseRfeRequest: requires the RFE notice text", () => {
  assert.equal(parseRfeRequest({ rfeText: "too short" }).ok, false);
  assert.equal(parseRfeRequest({ petitioner: "x", criteria: [] }).ok, false);
  for (const bad of [null, "x", 42, []]) assert.equal(parseRfeRequest(bad).ok, false);
});

test("parseRfeRequest: accepts and defaults petitioner/classification", () => {
  const r = parseRfeRequest({ rfeText: valid.rfeText });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.petitioner, "the beneficiary");
    assert.equal(r.value.classification, "O-1A");
    assert.deepEqual(r.value.criteria, []);
  }
});

// — Disclaimer ───────────────────────────────────────────────────────────────

test("buildRfeResult: ALWAYS attaches the disclaimer", () => {
  for (const source of ["mock", "gemini"] as const) {
    const res = buildRfeResult(mockRfe(valid), source);
    assert.equal(res.disclaimer, DISCLAIMER);
    assert.equal(res.source, source);
  }
});

// — Prompt safety / citation discipline ──────────────────────────────────────

test("buildRfePrompt: citation discipline, attorney review, JSON, includes RFE + criteria", () => {
  const p = buildRfePrompt(valid).toLowerCase();
  assert.ok(p.includes("do not invent"), "forbids fabrication");
  assert.ok(p.includes("only the facts"), "restricts to provided facts");
  assert.ok(p.includes("attorney"));
  assert.ok(p.includes("json"));
  assert.ok(p.includes("judging criterion"), "includes the RFE text");
  assert.ok(p.includes("awards"), "includes criteria");
});

// — Response parsing ─────────────────────────────────────────────────────────

test("parseRfeResponse: parses valid JSON; drops malformed sections", () => {
  const model = JSON.stringify({
    sections: [
      { heading: "Opening", body: "..." },
      { heading: "", body: "dropped" },
      { heading: "Re: Judging", body: "..." },
    ],
  });
  const r = parseRfeResponse(model, valid);
  assert.deepEqual(r.sections.map((s) => s.heading), ["Opening", "Re: Judging"]);
});

test("parseRfeResponse: tolerates fences; falls back to mock on garbage/empty", () => {
  const wrapped = "```json\n" + JSON.stringify({ sections: [{ heading: "Opening", body: "x" }] }) + "\n```";
  assert.equal(parseRfeResponse(wrapped, valid).sections[0].heading, "Opening");
  assert.deepEqual(parseRfeResponse("nope", valid), mockRfe(valid));
  assert.deepEqual(parseRfeResponse(JSON.stringify({ sections: [] }), valid), mockRfe(valid));
});

test("tryParseRfeResponse: returns null on a silent fallback so the route can reclaim", () => {
  const good = tryParseRfeResponse(JSON.stringify({ sections: [{ heading: "Opening", body: "x" }] }));
  assert.ok(good && good.sections[0].heading === "Opening");
  assert.equal(tryParseRfeResponse("nope"), null, "garbage → null");
  assert.equal(tryParseRfeResponse(JSON.stringify({ sections: [] })), null, "no usable sections → null");
});

test("buildRfePrompt: isolates the RFE notice and criteria as untrusted data", () => {
  const p = buildRfePrompt(valid);
  assert.ok(p.includes("<<<RFE_NOTICE>>>") && p.includes("<<<END_RFE_NOTICE>>>"), "wraps the notice");
  assert.ok(p.toLowerCase().includes("never instructions") || p.toLowerCase().includes("untrusted data"));
});

// — Mock structure & determinism ─────────────────────────────────────────────

test("mockRfe: deterministic; opening + one section per addressable criterion + closing", () => {
  const a = mockRfe(valid);
  assert.deepEqual(a, mockRfe(valid), "deterministic");
  const headings = a.sections.map((s) => s.heading);
  assert.equal(headings[0], "Response to Request for Evidence");
  assert.equal(headings[headings.length - 1], "Conclusion");
  // Met + Partial are addressed; None ("Press") is excluded.
  assert.ok(headings.includes("Re: Awards"));
  assert.ok(headings.includes("Re: Judging"));
  assert.ok(!headings.includes("Re: Press"));
});

test("mockRfe: with no criteria, still returns opening + fallback + closing", () => {
  const r = mockRfe({ ...valid, criteria: [] });
  assert.equal(r.sections.length, 3);
  assert.equal(r.sections[1].heading, "Additional evidence");
});
