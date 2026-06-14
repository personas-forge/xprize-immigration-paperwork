import { test } from "node:test";
import assert from "node:assert/strict";

import { DISCLAIMER } from "@/features/guidance/guidance";
import {
  fabricatedSpecifics,
  matchedAdvice,
  wrongCodes,
  caseLawHits,
  runAdjudication,
  type AdjudicationContext,
} from "./adjudication-gates";

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
