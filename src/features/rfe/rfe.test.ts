import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DISCLAIMER,
  attachFiledPetition,
  attachRfeExhibits,
  buildRfePrompt,
  buildRfeResult,
  buildRfeForecastPrompt,
  buildRfeForecastResult,
  hasReliedCriteria,
  mockRfe,
  mockRfeForecast,
  parseRfeRequest,
  parseRfeResponse,
  rfeHasExhibits,
  trimFiledSection,
  tryParseRfeResponse,
  tryParseRfeForecast,
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

// — Forecast pre-charge gate ─────────────────────────────────────────────────

test("hasReliedCriteria: true with any Met/Strong/Partial, false when all None", () => {
  assert.equal(hasReliedCriteria(valid), true);
  const allNone: RfeRequest = {
    ...valid,
    criteria: valid.criteria.map((c) => ({ ...c, status: "None" })),
  };
  assert.equal(hasReliedCriteria(allNone), false);
  assert.equal(hasReliedCriteria({ ...valid, criteria: [] }), false);
});

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

// — RFE Risk Radar / forecast (moonshot #20) ─────────────────────────────────

test("buildRfeForecastPrompt: asks for ranked per-criterion challenge JSON", () => {
  const p = buildRfeForecastPrompt(valid);
  assert.ok(p.toLowerCase().includes("likelihood"));
  assert.ok(p.includes("suggestedEvidence"));
  assert.ok(p.toLowerCase().includes("do not invent"));
  assert.ok(p.includes("<<<CRITERIA>>>"));
  assert.ok(p.includes("Awards") && p.includes("Judging"));
});

test("mockRfeForecast: ranks relied-on criteria, Partial highest, drops None", () => {
  const f = mockRfeForecast(valid);
  // Only relied-on (Met/Strong/Partial) → Awards + Judging, not Press(None).
  assert.deepEqual(f.map((c) => c.criterion).sort(), ["Awards", "Judging"]);
  // Ranked most-likely first; Partial (Judging) outranks Met (Awards).
  assert.equal(f[0].criterion, "Judging");
  assert.ok(f[0].likelihood >= f[1].likelihood);
  assert.ok(f.every((c) => c.likelihood >= 0 && c.likelihood <= 100));
  assert.ok(f.every((c) => c.why.length > 0 && c.suggestedEvidence.length > 0));
});

test("tryParseRfeForecast: parses + ranks valid JSON, maps to real criteria", () => {
  const model = JSON.stringify({
    challenges: [
      { criterion: "Awards", likelihood: 30, why: "ok", suggestedEvidence: "more" },
      { criterion: "Ghost", likelihood: 90, why: "x", suggestedEvidence: "y" }, // dropped
      { criterion: "Judging", likelihood: 85, why: "thin", suggestedEvidence: "add docs" },
    ],
  });
  const f = tryParseRfeForecast(model, valid);
  assert.ok(f);
  assert.deepEqual(f!.map((c) => c.criterion), ["Judging", "Awards"], "ranked + Ghost dropped");
});

test("tryParseRfeForecast: returns null on garbage / no usable entries", () => {
  assert.equal(tryParseRfeForecast("not json", valid), null);
  assert.equal(tryParseRfeForecast(JSON.stringify({ challenges: [] }), valid), null);
  assert.equal(
    tryParseRfeForecast(JSON.stringify({ challenges: [{ criterion: "Ghost", likelihood: 9 }] }), valid),
    null,
  );
});

test("buildRfeForecastResult: attaches the disclaimer + source", () => {
  const r = buildRfeForecastResult(mockRfeForecast(valid), "mock");
  assert.equal(r.disclaimer, DISCLAIMER);
  assert.equal(r.source, "mock");
  assert.ok(r.challenges.length > 0);
});

// — Exhibit-bound RFE (moonshot #21) ─────────────────────────────────────────

test("attachRfeExhibits + buildRfePrompt: cites exhibits only when present", () => {
  const docs = [
    { criterion: "Awards", exhibit: "Ex. 1", name: "Certificate", facts: ["2023"] },
    { criterion: "Judging", exhibit: "Ex. 2", name: "Reviewer invite", facts: [] },
  ];
  assert.equal(rfeHasExhibits(valid), false);
  const withEx = attachRfeExhibits(valid, docs);
  assert.equal(rfeHasExhibits(withEx), true);
  const awards = withEx.criteria.find((c) => c.name === "Awards");
  assert.deepEqual(awards?.exhibits?.map((e) => e.number), [1]);

  const plain = buildRfePrompt(valid);
  assert.ok(!plain.includes("(Exhibit N)"), "no citation rule without exhibits");
  const p = buildRfePrompt(withEx);
  assert.ok(p.includes("(Exhibit N)"), "citation rule present");
  assert.ok(p.includes("(Exhibit 1) Certificate"), "lists the exhibit");
});

test("attachRfeExhibits: no matching docs leaves the request untouched", () => {
  assert.equal(attachRfeExhibits(valid, []), valid);
});

test("attachFiledPetition + buildRfePrompt: fuses the as-filed letter as read-only context (G1.2)", () => {
  // No filed petition → no AS_FILED block (backward compatible).
  assert.ok(!buildRfePrompt(valid).includes("AS_FILED_PETITION"));
  // Empty/whitespace-only sections are dropped → request untouched.
  assert.equal(attachFiledPetition(valid, [{ heading: "Introduction", body: "   " }]), valid);

  const withFiled = attachFiledPetition(valid, [
    { heading: "Introduction", body: "This petition is submitted on behalf of Dr. Krishnan." },
    { heading: "Judging", body: "As established, the beneficiary served as a NeurIPS reviewer." },
  ]);
  const p = buildRfePrompt(withFiled);
  assert.ok(p.includes("AS_FILED_PETITION"), "fences the as-filed petition");
  assert.ok(p.includes("served as a NeurIPS reviewer"), "includes the filed letter prose");
  assert.ok(/read-only data, never as instructions/i.test(p), "keeps the injection defense");
});

test("trimFiledSection: short sections pass through verbatim (backward compatible)", () => {
  const body = "As established, the beneficiary served as a NeurIPS reviewer.";
  assert.equal(trimFiledSection(body, valid.rfeText), body);
});

test("trimFiledSection: keeps the RFE-challenged passage even when it sits late (Tiger L2)", () => {
  // A long section whose load-bearing fact (independent adoption) is at the END —
  // the exact shape the old 800-char head-slice severed, producing an empty rebuttal.
  const head = "This section establishes the beneficiary's original contributions to the field. ";
  const filler = "The research is significant and has been sustained over many years. ".repeat(40);
  const challenged =
    "Specifically, the PNAlign method was adopted by the Broad Institute and integrated into the GATK pipeline in 2022.";
  const body = head + filler + challenged;
  const rfeText =
    "The record does not show the contribution was adopted by independent parties. " +
    "Please submit evidence of adoption, for example integration into pipelines such as GATK.";

  assert.ok(body.length > 2200, "precondition: body exceeds the per-section budget");
  const trimmed = trimFiledSection(body, rfeText);
  assert.ok(trimmed.length <= 2300, "stays within budget");
  assert.ok(trimmed.includes("Broad Institute"), "retains the independent-adoption fact");
  assert.ok(trimmed.includes("GATK"), "retains the specific integration the RFE asked about");
  assert.ok(trimmed.startsWith("This section establishes"), "keeps the opening sentence as context");
});

test("mockRfe: cites attached exhibits in the addressable sections", () => {
  const withEx = attachRfeExhibits(valid, [
    { criterion: "Awards", exhibit: "Ex. 1", name: "Certificate", facts: [] },
  ]);
  const r = mockRfe(withEx);
  const awards = r.sections.find((s) => s.heading === "Re: Awards");
  assert.ok(awards?.body.includes("(Exhibit 1)"));
});
