import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DISCLAIMER,
  buildGuidancePrompt,
  buildGuidanceResponse,
  mockGuidance,
  parseGuidanceRequest,
  type GuidanceRequest,
} from "./guidance";

const valid: GuidanceRequest = {
  formId: "I-129",
  fieldLabel: "Section O-1 — Extraordinary Ability",
  situation: "Researcher with 6 papers and a granted patent.",
};

// — Validation ────────────────────────────────────────────────────────────

test("parseGuidanceRequest: accepts and trims a well-formed body", () => {
  const r = parseGuidanceRequest({
    formId: "  I-129 ",
    fieldLabel: " Dates ",
    situation: " situation ",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value, {
      formId: "I-129",
      fieldLabel: "Dates",
      situation: "situation",
    });
  }
});

test("parseGuidanceRequest: rejects non-objects and missing/blank fields", () => {
  for (const bad of [null, undefined, "x", 42, [], {}]) {
    assert.equal(parseGuidanceRequest(bad).ok, false);
  }
  assert.equal(
    parseGuidanceRequest({ formId: "I-129", fieldLabel: "x", situation: "  " }).ok,
    false,
  );
  assert.equal(
    parseGuidanceRequest({ formId: "", fieldLabel: "x", situation: "y" }).ok,
    false,
  );
});

test("parseGuidanceRequest: rejects over-long input", () => {
  const long = "a".repeat(5000);
  assert.equal(
    parseGuidanceRequest({ formId: "I-129", fieldLabel: "x", situation: long }).ok,
    false,
  );
});

// — Disclaimer is non-negotiable ─────────────────────────────────────────────

test("DISCLAIMER states not-legal-advice AND attorney-of-record requirement", () => {
  const d = DISCLAIMER.toLowerCase();
  assert.ok(d.includes("not legal advice"), "must say not legal advice");
  assert.ok(d.includes("attorney"), "must mention an attorney");
  assert.ok(d.includes("of record"), "must require an attorney of record");
});

test("buildGuidanceResponse: ALWAYS attaches the disclaimer, for every source", () => {
  for (const source of ["mock", "gemini"] as const) {
    const res = buildGuidanceResponse("some guidance", source);
    assert.equal(res.disclaimer, DISCLAIMER);
    assert.equal(res.source, source);
    assert.equal(res.guidance, "some guidance");
  }
});

// — Prompt safety ────────────────────────────────────────────────────────────

test("buildGuidancePrompt: instructs informational-only, no legal advice, attorney review", () => {
  const p = buildGuidancePrompt(valid).toLowerCase();
  assert.ok(p.includes("informational"), "must ask for informational guidance");
  assert.ok(p.includes("never give legal advice") || p.includes("not legal advice"));
  assert.ok(p.includes("attorney"), "must recommend attorney review");
  // The user's inputs are interpolated so the model has context.
  assert.ok(p.includes("i-129"));
});

test("mockGuidance: deterministic, references the field, and is non-empty", () => {
  const a = mockGuidance(valid);
  const b = mockGuidance(valid);
  assert.equal(a, b, "must be deterministic");
  assert.ok(a.includes("I-129"));
  assert.ok(a.length > 0);
});
