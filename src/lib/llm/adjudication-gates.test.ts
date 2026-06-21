import { test } from "node:test";
import assert from "node:assert/strict";

import { DISCLAIMER } from "@/features/guidance/guidance";
import {
  fabricatedSpecifics,
  matchedAdvice,
  wrongCodes,
  caseLawHits,
  unsupportedEntities,
  inflatedAwardStatus,
  runAdjudication,
  sentenceCount,
  type AdjudicationContext,
} from "./adjudication-gates";

// — sentenceCount: abbreviation/citation-aware ───────────────────────────────

test("sentenceCount: counts real sentence boundaries", () => {
  assert.equal(sentenceCount("One. Two. Three."), 3);
  assert.equal(sentenceCount("Just one sentence with no terminal punctuation"), 1);
});

test("sentenceCount: abbreviations / citations / list markers don't inflate the count", () => {
  // Two sentences, peppered with the abbreviations real petition prose uses.
  assert.equal(
    sentenceCount("File Form I-129 with a U.S. employer; see 8 C.F.R. 214.2(o). Gather e.g. letters."),
    2,
  );
  // "U.S." mid-sentence is not a boundary.
  assert.equal(sentenceCount("She works for a U.S. company in the arts."), 1);
});

// — leaf scanners (shared with the eval harness) ─────────────────────────────

test("fabricatedSpecifics: flags output numbers absent from the input, exempts legal cites", () => {
  // 412 citations is invented (not in the record); 8 CFR 214.2 is a legal cite.
  const out = "Cited 412 times under 8 CFR 214.2(o).";
  assert.deepEqual(fabricatedSpecifics(out, "general background"), ["412"]);
  // When the input contains it, it's grounded.
  assert.deepEqual(fabricatedSpecifics(out, "412 citations on record"), []);
});

test("matchedAdvice: trips on outcome/advice language, not on grounded statements", () => {
  assert.ok(matchedAdvice("You will qualify for an O-1A.").length > 0);
  assert.ok(matchedAdvice("I recommend that you file now.").length > 0);
  assert.equal(matchedAdvice("Premium processing does not guarantee approval.").length, 0);
});

test("wrongCodes / caseLawHits: detect leaked codes and case-law cites", () => {
  assert.deepEqual(wrongCodes("This O-1B petition...", "O-1A"), ["O-1B"]);
  assert.deepEqual(wrongCodes("This O-1A petition...", "O-1A"), []);
  assert.ok(caseLawHits("See Matter of Price and 596 F.3d 1115.").length >= 1);
});

// — live adjudication report ─────────────────────────────────────────────────

function draftCtx(over: Partial<AdjudicationContext> = {}): AdjudicationContext {
  return {
    operation: "draft",
    classification: "O-1A",
    source: "gemini",
    result: { disclaimer: DISCLAIMER },
    inputText: "Best paper award; 6 papers on record.",
    outputText: "The beneficiary satisfies the awards criterion.",
    ...over,
  };
}

test("runAdjudication: a clean draft is attorney-ready (all pass)", () => {
  const report = runAdjudication(draftCtx());
  assert.equal(report.risk, "ready");
  assert.equal(report.attorneyReady, true);
  assert.ok(report.gates.every((g) => g.verdict === "pass"));
});

// — qualitative fabrication: named entities + award status (LLM-2) ────────────

test("unsupportedEntities: flags a named entity absent from the record, not a grounded one", () => {
  const out =
    "The beneficiary won the Zenith Excellence Award and is a member of the Royal Photographic Society.";
  const ground = "Member of the Royal Photographic Society; several exhibitions.";
  const flagged = unsupportedEntities(out, ground);
  assert.ok(flagged.some((e) => /Zenith Excellence Award/.test(e)), "invented award flagged");
  assert.ok(!flagged.some((e) => /Royal Photographic Society/.test(e)), "grounded society not flagged");
});

test("unsupportedEntities: a paraphrased name still traces (no false positive)", () => {
  // Record says "Zenith Prize"; the draft writes "Zenith Excellence Award" — the
  // distinctive token "Zenith" traces, so it must NOT be flagged.
  assert.deepEqual(
    unsupportedEntities("won the Zenith Excellence Award", "awarded the Zenith Prize"),
    [],
  );
});

test("inflatedAwardStatus: catches a nomination written up as a win", () => {
  assert.equal(inflatedAwardStatus("won the IGF Award", "nominated for the IGF Award"), true);
  assert.equal(inflatedAwardStatus("won the IGF Award", "won the IGF Award in 2022"), false);
  assert.equal(inflatedAwardStatus("nominated for the IGF Award", "nominated for the IGF Award"), false);
});

test("runAdjudication: an invented entity WARNS (review) but never blocks the draft", () => {
  const report = runAdjudication(
    draftCtx({
      inputText: "Best paper award; 6 papers on record.",
      outputText:
        "The beneficiary is a Fellow of the Imaginary Royal Institute and a recipient of the Nonexistent Vanguard Prize.",
    }),
  );
  const g = report.gates.find((x) => x.id === "grounded-claims");
  assert.equal(g?.verdict, "warn");
  assert.equal(report.risk, "review"); // surfaced for the attorney…
  assert.equal(report.attorneyReady, true); // …never auto-blocked (a warn doesn't fail)
});

test("runAdjudication: a grounded draft keeps grounded-claims passing", () => {
  const report = runAdjudication(
    draftCtx({
      inputText: "Won the Lasker Award; member of the National Academy of Sciences.",
      outputText: "The beneficiary won the Lasker Award and was elected to the National Academy.",
    }),
  );
  const g = report.gates.find((x) => x.id === "grounded-claims");
  assert.equal(g?.verdict, "pass");
});

test("runAdjudication: a missing disclaimer is a hard failure → blocked", () => {
  const report = runAdjudication(draftCtx({ result: { disclaimer: "" } }));
  assert.equal(report.risk, "blocked");
  assert.equal(report.attorneyReady, false);
  assert.ok(report.gates.some((g) => g.id === "disclaimer-present" && g.verdict === "fail"));
});

test("runAdjudication: a leaked visa code blocks the draft", () => {
  const report = runAdjudication(draftCtx({ outputText: "This O-1B petition is strong." }));
  assert.equal(report.attorneyReady, false);
  assert.ok(report.gates.some((g) => g.id === "classification-consistent" && g.verdict === "fail"));
});

test("runAdjudication: invented specifics + case law are soft warnings → review", () => {
  const report = runAdjudication(
    draftCtx({
      inputText: "general background",
      outputText: "Cited 9,001 times; see Matter of Price.",
    }),
  );
  assert.equal(report.risk, "review");
  assert.equal(report.attorneyReady, true, "warnings don't block attorney-ready");
  assert.ok(report.gates.some((g) => g.id === "no-fabrication" && g.verdict === "warn"));
  assert.ok(report.gates.some((g) => g.id === "caselaw-review" && g.verdict === "warn"));
});

test("runAdjudication: qualify checks canonical criteria + UPL advice", () => {
  const ok = runAdjudication({
    operation: "qualify",
    classification: "O-1A",
    source: "gemini",
    result: {
      disclaimer: DISCLAIMER,
      likelihood: 60,
      criteria: criteriaRows(),
    },
    inputText: "profile",
    outputText: "Strong scholarly record.",
  });
  assert.equal(ok.attorneyReady, true);

  const advice = runAdjudication({
    operation: "qualify",
    classification: "O-1A",
    source: "gemini",
    result: { disclaimer: DISCLAIMER, likelihood: 60, criteria: criteriaRows() },
    inputText: "profile",
    outputText: "You will qualify for an O-1A — you should file now.",
  });
  assert.equal(advice.attorneyReady, false, "UPL advice language blocks");
});

/** A canonical, valid O-1A criteria array (8 rows, in order). */
function criteriaRows(): Array<Record<string, unknown>> {
  return [
    "Awards", "Membership", "Press", "Judging",
    "Original contribution", "Scholarly articles", "Critical role", "High remuneration",
  ].map((name) => ({ name, status: "None", evidence: "", rationale: "" }));
}
