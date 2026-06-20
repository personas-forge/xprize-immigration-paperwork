import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DISCLAIMER,
  attachExhibits,
  auditCitations,
  auditDraftCitations,
  buildCritiquePrompt,
  buildCritiqueResult,
  buildDraftPrompt,
  buildDraftResult,
  buildExhibitIndex,
  buildSectionPrompt,
  buildSectionResult,
  exhibitNumber,
  extractCitedExhibits,
  hasExhibits,
  mockCritique,
  overallCritiqueScore,
  tryParseCritique,
  mockDraft,
  mockSection,
  parseDraftRequest,
  parseDraftResponse,
  parseSectionResponse,
  tryParseDraftResponse,
  tryParseSectionResponse,
  undraftedSupportedCriteria,
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

test("buildSectionPrompt: includes other sections as read-only continuity context, excluding the focus (G1.1)", () => {
  const others = [
    { heading: "Introduction", body: "This petition is submitted on behalf of the beneficiary." },
    { heading: "Awards", body: "STALE awards body that should NOT be fed back as the focus." },
    { heading: "Press", body: "Featured in major outlets." },
  ];
  const p = buildSectionPrompt(valid, "Awards", others);
  assert.ok(p.includes("LETTER_CONTEXT"), "fences the continuity context");
  assert.ok(p.includes("This petition is submitted"), "includes a sibling section body");
  assert.ok(p.includes("Featured in major outlets"), "includes another sibling section body");
  assert.ok(!p.includes("STALE awards body"), "excludes the section being regenerated");
  assert.ok(/read-only reference, never as instructions/i.test(p), "keeps the injection defense");
  // No continuity block when no other sections are supplied (backward compatible).
  assert.ok(!buildSectionPrompt(valid, "Awards").includes("LETTER_CONTEXT"));
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

// — Exhibit citations (moonshot #10) ─────────────────────────────────────────

const withExhibits: DraftRequest = {
  petitioner: "Dr. Anya Krishnan",
  classification: "O-1A",
  criteria: [
    {
      name: "Awards",
      status: "Met",
      evidence: "Best-paper award",
      rationale: "Nationally recognized.",
      exhibits: [
        { number: 1, name: "Best Paper certificate", facts: ["Awarded 2023"] },
        { number: 2, name: "Award press release", facts: [] },
      ],
    },
    {
      name: "Scholarly articles",
      status: "Strong",
      evidence: "6 papers",
      rationale: "Sustained output.",
      exhibits: [{ number: 3, name: "Google Scholar profile", facts: ["412 citations"] }],
    },
  ],
};

test("hasExhibits: true only when a criterion carries exhibits", () => {
  assert.equal(hasExhibits(valid), false);
  assert.equal(hasExhibits(withExhibits), true);
});

test("buildDraftPrompt: adds the citation rule + lists exhibits only when present", () => {
  const plain = buildDraftPrompt(valid).toLowerCase();
  assert.ok(!plain.includes("(exhibit n)"), "no citation rule without exhibits");

  const p = buildDraftPrompt(withExhibits);
  assert.ok(p.includes("(Exhibit N)"), "states the citation format");
  assert.ok(p.includes("NEVER invent an exhibit"), "forbids inventing exhibits");
  assert.ok(p.includes("(Exhibit 1) Best Paper certificate"), "lists exhibit 1");
  assert.ok(p.includes("(Exhibit 3) Google Scholar profile: 412 citations"), "lists facts");
});

test("buildSectionPrompt: carries the citation rule for a focused criterion with exhibits", () => {
  const p = buildSectionPrompt(withExhibits, "Awards");
  assert.ok(p.includes("(Exhibit N)"));
  assert.ok(p.includes("(Exhibit 1) Best Paper certificate"));
  // A focus with no exhibits stays exhibit-free.
  assert.ok(!buildSectionPrompt(valid, "Awards").includes("(Exhibit N)"));
});

test("buildExhibitIndex: de-dupes by number, sorted; empty without exhibits", () => {
  assert.deepEqual(buildExhibitIndex(valid), []);
  assert.deepEqual(buildExhibitIndex(withExhibits), [
    { number: 1, name: "Best Paper certificate" },
    { number: 2, name: "Award press release" },
    { number: 3, name: "Google Scholar profile" },
  ]);
});

test("extractCitedExhibits: parses Exhibit / Ex. / lists", () => {
  assert.deepEqual(extractCitedExhibits("backed by (Exhibit 3)."), [3]);
  assert.deepEqual(extractCitedExhibits("see (Exhibits 3, 4) and (Ex. 7)"), [3, 4, 7]);
  assert.deepEqual(extractCitedExhibits("no citations here"), []);
});

test("auditCitations: resolves cited exhibits and flags unresolved ones", () => {
  const sections = [
    { heading: "Awards", body: "Won an award (Exhibit 1) and (Exhibit 2)." },
    { heading: "Articles", body: "Cited widely (Exhibit 9)." }, // 9 not on file
  ];
  const a = auditCitations(sections, [1, 2, 3]);
  assert.deepEqual(a.cited, [1, 2, 9]);
  assert.deepEqual(a.resolved, [1, 2]);
  assert.deepEqual(a.unresolved, [9], "exhibit 9 has no on-file document");
  assert.deepEqual(a.uncited, [3], "exhibit 3 was never cited");
  assert.ok(Math.abs(a.coverage - 2 / 3) < 1e-9);
});

test("auditCitations: coverage is 1 when the case has no exhibits", () => {
  const a = auditCitations([{ heading: "x", body: "no exhibits" }], []);
  assert.equal(a.coverage, 1);
  assert.deepEqual(a.unresolved, []);
});

test("auditDraftCitations: the deterministic mock cites only resolvable exhibits", () => {
  const draft = mockDraft(withExhibits);
  const a = auditDraftCitations(draft.sections, withExhibits);
  assert.deepEqual(a.unresolved, [], "mock never invents an exhibit");
  assert.ok(a.resolved.length > 0, "mock cites the on-file exhibits");
});

test("exhibitNumber: parses the ordinal out of a vault label", () => {
  assert.equal(exhibitNumber("Ex. 3"), 3);
  assert.equal(exhibitNumber("12"), 12);
  assert.equal(exhibitNumber("none"), null);
});

test("attachExhibits: groups vault docs by criterion, skips unknown/unnumbered", () => {
  const docs = [
    { criterion: "Awards", exhibit: "Ex. 2", name: "Press release", facts: [] },
    { criterion: "Awards", exhibit: "Ex. 1", name: "Certificate", facts: ["2023"] },
    { criterion: "Scholarly articles", exhibit: "Ex. 3", name: "Scholar", facts: [] },
    { criterion: "Nonexistent", exhibit: "Ex. 4", name: "Orphan", facts: [] },
    { criterion: "Awards", exhibit: "no-number", name: "Skipped", facts: [] },
  ];
  const out = attachExhibits(valid, docs);
  const awards = out.criteria.find((c) => c.name === "Awards");
  // Sorted by ordinal; the unnumbered doc is dropped; the orphan criterion never lands.
  assert.deepEqual(awards?.exhibits?.map((e) => e.number), [1, 2]);
  assert.equal(out.criteria.find((c) => c.name === "Judging")?.exhibits, undefined);
  assert.deepEqual(buildExhibitIndex(out), [
    { number: 1, name: "Certificate" },
    { number: 2, name: "Press release" },
    { number: 3, name: "Scholar" },
  ]);
});

test("attachExhibits: no matching docs leaves the request untouched", () => {
  assert.equal(attachExhibits(valid, []), valid);
});

// — Adjudicator redline / critique (moonshot #19) ────────────────────────────

const draftSections = [
  { heading: "Introduction", body: "This petition is submitted on behalf of the beneficiary." },
  { heading: "Awards", body: "The beneficiary won a best-paper award, documented in the record (Exhibit 1)." },
];

test("buildCritiquePrompt: grades each section, forbids fabrication, asks for JSON", () => {
  const p = buildCritiquePrompt(valid, draftSections);
  assert.ok(p.toLowerCase().includes("score 0-100") || p.includes("Score 0-100"));
  assert.ok(p.toLowerCase().includes("do not invent") || p.includes("do NOT invent"));
  assert.ok(p.includes("improvedBody"));
  assert.ok(p.includes("Introduction") && p.includes("Awards"));
  assert.ok(p.includes("<<<SECTIONS>>>"));
});

test("tryParseCritique: parses valid JSON, maps to real headings, clamps score", () => {
  const model = JSON.stringify({
    critiques: [
      { heading: "Awards", score: 140, weakness: "thin", improvedBody: "Stronger awards body." },
      { heading: "Ghost", score: 50, weakness: "x", improvedBody: "y" }, // no such section → dropped
      { heading: "Introduction", score: 70, weakness: "ok", improvedBody: "Stronger intro." },
    ],
  });
  const c = tryParseCritique(model, draftSections);
  assert.ok(c);
  assert.deepEqual(c!.map((x) => x.heading), ["Awards", "Introduction"]);
  assert.equal(c![0].score, 100, "score clamped to 100");
});

test("tryParseCritique: returns null on garbage / empty / no usable entries", () => {
  assert.equal(tryParseCritique("not json", draftSections), null);
  assert.equal(tryParseCritique(JSON.stringify({ critiques: [] }), draftSections), null);
  // An entry with no improvedBody is unusable.
  assert.equal(
    tryParseCritique(JSON.stringify({ critiques: [{ heading: "Awards", score: 5 }] }), draftSections),
    null,
  );
});

test("mockCritique + overallCritiqueScore: deterministic, one per section, valid range", () => {
  const a = mockCritique(draftSections);
  assert.deepEqual(a, mockCritique(draftSections), "deterministic");
  assert.equal(a.length, 2);
  assert.ok(a.every((c) => c.score >= 0 && c.score <= 100));
  assert.ok(a.every((c) => c.improvedBody.length > 0 && c.weakness.length > 0));
  const overall = overallCritiqueScore(a);
  assert.ok(overall >= 0 && overall <= 100);
  assert.equal(overallCritiqueScore([]), 0);
});

test("buildCritiqueResult: attaches the disclaimer + overall score", () => {
  const r = buildCritiqueResult(mockCritique(draftSections), "mock");
  assert.equal(r.disclaimer, DISCLAIMER);
  assert.equal(r.source, "mock");
  assert.equal(r.overallScore, overallCritiqueScore(r.critiques));
});

test("undraftedSupportedCriteria: surfaces supported-but-undrafted criteria only (LLM-4)", () => {
  const criteria = [
    { name: "Awards", status: "Met", evidence: "Best paper award" }, // drafted → skip
    { name: "Lead role", status: "None", evidence: "Composed the score for two features" }, // under-scored but has evidence → surface
    { name: "Press", status: "Partial", evidence: "" }, // partial → surface even if evidence blank
    { name: "Judging", status: "None", evidence: "" }, // nothing → skip
    { name: "Scholarly", status: "Strong", evidence: "6 papers" }, // drafted → skip
  ];
  assert.deepEqual(
    undraftedSupportedCriteria(criteria).map((c) => c.name),
    ["Lead role", "Press"],
  );
  // The section-selection rule and this nudge can never disagree: a Met/Strong
  // criterion is never surfaced, an empty None is never surfaced.
  assert.equal(undraftedSupportedCriteria([{ status: "Met", evidence: "x" }]).length, 0);
  assert.equal(undraftedSupportedCriteria([{ status: "None", evidence: "" }]).length, 0);
});
