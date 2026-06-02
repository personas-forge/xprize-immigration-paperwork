import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DISCLAIMER,
  buildDraftPrompt,
  buildDraftResult,
  buildSectionPrompt,
  buildSectionResult,
  mockDraft,
  mockSection,
  parseDraftRequest,
  parseDraftResponse,
  parseSectionResponse,
  tryParseDraftResponse,
  tryParseSectionResponse,
  type DraftRequest,
} from "./drafting";

const valid: DraftRequest = {
  petitioner: "Dr. Anya Krishnan",
  classification: "O-1A",
  criteria: [
    { name: "Awards", status: "Met", evidence: "Best-paper award at a top ML conference", rationale: "Nationally recognized." },
    { name: "Scholarly articles", status: "Strong", evidence: "6 papers, 412 citations", rationale: "Sustained output." },
    { name: "Judging", status: "Partial", evidence: "", rationale: "Thin." },
    { name: "Press", status: "None", evidence: "", rationale: "No coverage found." },
  ],
};

// — Validation ────────────────────────────────────────────────────────────

test("parseDraftRequest: accepts a well-formed body, defaults classification", () => {
  const r = parseDraftRequest({ petitioner: "  Anya  ", criteria: valid.criteria });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.petitioner, "Anya");
    assert.equal(r.value.classification, "O-1A");
    assert.equal(r.value.criteria.length, 4);
  }
});

test("parseDraftRequest: rejects non-objects and empty/invalid criteria", () => {
  for (const bad of [null, "x", 42, {}, { criteria: [] }]) {
    assert.equal(parseDraftRequest(bad).ok, false);
  }
  // criteria present but all unnamed → rejected.
  assert.equal(parseDraftRequest({ criteria: [{ status: "Met" }] }).ok, false);
});

// — Disclaimer is non-negotiable ─────────────────────────────────────────────

test("buildDraftResult / buildSectionResult: ALWAYS attach the disclaimer", () => {
  for (const source of ["mock", "gemini"] as const) {
    const d = buildDraftResult(mockDraft(valid), source);
    assert.equal(d.disclaimer, DISCLAIMER);
    assert.equal(d.source, source);
    const s = buildSectionResult(mockSection(valid, "Awards"), source);
    assert.equal(s.disclaimer, DISCLAIMER);
  }
});

// — Prompt safety / citation discipline ──────────────────────────────────────

test("buildDraftPrompt: citation discipline, attorney review, JSON, names the criteria", () => {
  const p = buildDraftPrompt(valid).toLowerCase();
  assert.ok(p.includes("do not invent"), "forbids fabrication");
  assert.ok(p.includes("only the facts"), "restricts to provided facts");
  assert.ok(p.includes("attorney"), "attorney review");
  assert.ok(p.includes("draft"), "marks it a draft");
  assert.ok(p.includes("json"));
  assert.ok(p.includes("awards") && p.includes("scholarly articles"));
  assert.ok(p.includes("dr. anya krishnan"));
});

test("buildSectionPrompt: targets the focused criterion, citation discipline, one JSON section", () => {
  const p = buildSectionPrompt(valid, "Awards");
  assert.ok(p.includes('"Awards"'));
  assert.ok(p.toLowerCase().includes("json"));
  assert.ok(p.toLowerCase().includes("do not invent"), "carries citation discipline");
});

// — Response parsing ─────────────────────────────────────────────────────────

test("parseDraftResponse: parses valid JSON and keeps only well-formed sections", () => {
  const model = JSON.stringify({
    sections: [
      { heading: "Introduction", body: "Intro body." },
      { heading: "Awards", body: "Awards body." },
      { heading: "", body: "dropped — no heading" },
      { heading: "Conclusion" }, // dropped — no body
    ],
  });
  const d = parseDraftResponse(model, valid);
  assert.deepEqual(
    d.sections.map((s) => s.heading),
    ["Introduction", "Awards"],
  );
});

test("parseDraftResponse: tolerates ```json fences", () => {
  const wrapped = "```json\n" + JSON.stringify({ sections: [{ heading: "Introduction", body: "x" }] }) + "\n```";
  const d = parseDraftResponse(wrapped, valid);
  assert.equal(d.sections[0].heading, "Introduction");
});

test("parseDraftResponse: falls back to the deterministic mock on garbage / empty", () => {
  assert.deepEqual(parseDraftResponse("not json", valid), mockDraft(valid));
  assert.deepEqual(parseDraftResponse(JSON.stringify({ sections: [] }), valid), mockDraft(valid));
});

test("parseSectionResponse: parses one section, else falls back to the mock section", () => {
  const ok = parseSectionResponse(JSON.stringify({ heading: "Awards", body: "Fresh." }), valid, "Awards");
  assert.deepEqual(ok, { heading: "Awards", body: "Fresh." });
  assert.deepEqual(parseSectionResponse("garbage", valid, "Awards"), mockSection(valid, "Awards"));
});

// — Strict (discriminating) parse: null signals a silent fallback ─────────────

test("tryParseDraftResponse: returns sections on valid JSON, null on garbage/empty", () => {
  const good = tryParseDraftResponse(JSON.stringify({ sections: [{ heading: "Introduction", body: "x" }] }));
  assert.ok(good && good.sections[0].heading === "Introduction");
  assert.equal(tryParseDraftResponse("not json"), null, "garbage → null, NOT a mock");
  assert.equal(tryParseDraftResponse(JSON.stringify({ sections: [] })), null, "no usable sections → null");
});

test("tryParseSectionResponse: returns the section on valid JSON, null on garbage", () => {
  assert.deepEqual(
    tryParseSectionResponse(JSON.stringify({ heading: "Awards", body: "Fresh." })),
    { heading: "Awards", body: "Fresh." },
  );
  assert.equal(tryParseSectionResponse("garbage"), null);
});

test("buildDraftPrompt: isolates applicant data as data, not instructions", () => {
  const p = buildDraftPrompt(valid);
  assert.ok(p.includes("<<<CASE_DATA>>>") && p.includes("<<<END_CASE_DATA>>>"), "wraps data in markers");
  assert.ok(p.toLowerCase().includes("never as instructions"), "tells the model the block is data");
});

// — Mock structure & determinism ─────────────────────────────────────────────

test("mockDraft: deterministic; Introduction + one section per QUALIFYING criterion + Conclusion", () => {
  const a = mockDraft(valid);
  const b = mockDraft(valid);
  assert.deepEqual(a, b, "deterministic");
  const headings = a.sections.map((s) => s.heading);
  assert.equal(headings[0], "Introduction");
  assert.equal(headings[headings.length - 1], "Conclusion");
  // Only Met/Strong earn a section: Awards + Scholarly articles (not Judging/Press).
  assert.ok(headings.includes("Awards"));
  assert.ok(headings.includes("Scholarly articles"));
  assert.ok(!headings.includes("Judging"), "Partial is excluded");
  assert.ok(!headings.includes("Press"), "None is excluded");
  assert.equal(a.sections.length, 4); // intro + 2 + conclusion
  // Body argues from the provided beneficiary name.
  assert.ok(a.sections.every((s) => s.body.length > 0));
});

test("mockSection: deterministic and references the criterion evidence", () => {
  const s = mockSection(valid, "Awards");
  assert.deepEqual(s, mockSection(valid, "Awards"));
  assert.equal(s.heading, "Awards");
  assert.ok(s.body.includes("Best-paper award"));
});
