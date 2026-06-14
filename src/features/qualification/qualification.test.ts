import assert from "node:assert/strict";
import { test } from "node:test";

import { DISCLAIMER } from "@/lib/result";
import {
  O1A_CRITERIA,
  buildQualifyPrompt,
  buildQualifyResult,
  mockQualification,
  parseQualifyRequest,
  parseQualifyResponse,
  type QualifyRequest,
} from "./qualification";

const valid: QualifyRequest = {
  name: "Dr. Anya Krishnan",
  classification: "O-1A",
  profile:
    "Senior research engineer with 6 published papers, 412 citations, a granted patent, " +
    "press in TechCrunch, and a $340K salary. Founding engineer at a Series B startup.",
};

// — Validation ────────────────────────────────────────────────────────────

test("parseQualifyRequest: accepts and trims a well-formed body", () => {
  const r = parseQualifyRequest({ name: "  Anya ", profile: `  ${valid.profile}  ` });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.name, "Anya");
    assert.equal(r.value.profile, valid.profile);
  }
});

test("parseQualifyRequest: defaults a blank/absent name to 'Applicant'", () => {
  const r = parseQualifyRequest({ profile: valid.profile });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.name, "Applicant");
});

test("parseQualifyRequest: rejects non-objects, too-short and too-long profiles", () => {
  for (const bad of [null, undefined, "x", 42, [], {}]) {
    assert.equal(parseQualifyRequest(bad).ok, false);
  }
  assert.equal(parseQualifyRequest({ profile: "too short" }).ok, false);
  assert.equal(parseQualifyRequest({ profile: "a".repeat(20000) }).ok, false);
});

// — Disclaimer is non-negotiable ─────────────────────────────────────────────

test("buildQualifyResult: ALWAYS attaches the disclaimer, for every source", () => {
  for (const source of ["mock", "gemini"] as const) {
    const res = buildQualifyResult(mockQualification(valid), source);
    assert.equal(res.disclaimer, DISCLAIMER);
    assert.equal(res.source, source);
    assert.ok(res.criteria.length === 8);
  }
});

// — Prompt safety ────────────────────────────────────────────────────────────

test("buildQualifyPrompt: informational-only, no eligibility determination, JSON, attorney", () => {
  const p = buildQualifyPrompt(valid).toLowerCase();
  assert.ok(p.includes("informational"));
  assert.ok(p.includes("never give legal advice") || p.includes("not legal advice"));
  assert.ok(p.includes("eligibility determination"));
  assert.ok(p.includes("attorney"));
  assert.ok(p.includes("json"));
  // All eight criterion names appear so the model scores the full set.
  for (const c of O1A_CRITERIA) assert.ok(p.includes(c.toLowerCase()), `prompt names ${c}`);
  // The user's profile is interpolated for context.
  assert.ok(p.includes("citations"));
});

// — Response parsing ─────────────────────────────────────────────────────────

test("parseQualifyResponse: parses valid JSON, returns the canonical eight in order", () => {
  const model = JSON.stringify({
    criteria: [
      { name: "Awards", status: "Met", evidence: "ICML best paper", rationale: "Clear award." },
      { name: "Press", status: "Strong", evidence: "TechCrunch", rationale: "Covered." },
    ],
    likelihood: 88,
    gaps: ["Add a judging credential", ""],
  });
  const a = parseQualifyResponse(model, valid);
  assert.equal(a.criteria.length, 8);
  assert.deepEqual(
    a.criteria.map((c) => c.name),
    [...O1A_CRITERIA],
    "criteria are canonical order",
  );
  assert.equal(a.criteria[0].status, "Met");
  // A criterion the model omitted is filled as "None", not dropped.
  assert.equal(a.criteria.find((c) => c.name === "Judging")?.status, "None");
  assert.equal(a.likelihood, 88);
  assert.deepEqual(a.gaps, ["Add a judging credential"], "blank gaps are dropped");
});

test("parseQualifyResponse: tolerates ```json fences and surrounding prose", () => {
  const wrapped = "Here you go:\n```json\n" +
    JSON.stringify({ criteria: [], likelihood: 150, gaps: [] }) +
    "\n```\nThanks!";
  const a = parseQualifyResponse(wrapped, valid);
  assert.equal(a.criteria.length, 8);
  assert.equal(a.likelihood, 100, "likelihood is clamped to 0-100");
});

test("parseQualifyResponse: coerces unknown status to 'None'", () => {
  const model = JSON.stringify({
    criteria: [{ name: "Awards", status: "DEFINITELY", evidence: "x", rationale: "y" }],
    likelihood: 50,
    gaps: [],
  });
  const a = parseQualifyResponse(model, valid);
  assert.equal(a.criteria.find((c) => c.name === "Awards")?.status, "None");
});

test("parseQualifyResponse: falls back to the deterministic mock on garbage", () => {
  const a = parseQualifyResponse("not json at all", valid);
  const b = mockQualification(valid);
  assert.deepEqual(a, b, "garbage input yields the deterministic mock");
});

// — Mock determinism ─────────────────────────────────────────────────────────

test("mockQualification: deterministic, full eight, likelihood in range", () => {
  const a = mockQualification(valid);
  const b = mockQualification(valid);
  assert.deepEqual(a, b, "must be deterministic");
  assert.equal(a.criteria.length, 8);
  assert.ok(a.likelihood >= 0 && a.likelihood <= 100);
  // The rich profile keys several criteria; an empty-ish one keys none.
  assert.ok(a.criteria.some((c) => c.status === "Met"));
  const sparse = mockQualification({
    name: "x",
    classification: "O-1A",
    profile: "I like long walks on the beach and cooking pasta.",
  });
  assert.ok(sparse.criteria.every((c) => c.status === "None"));
  assert.ok(sparse.gaps.length === 8, "every unmet criterion produces a gap hint");
});

// — Multi-product (classification packs) ─────────────────────────────────────

test("parseQualifyRequest: defaults classification to O-1A; accepts known, rejects unknown", () => {
  const a = parseQualifyRequest({ profile: valid.profile });
  assert.equal(a.ok, true);
  if (a.ok) assert.equal(a.value.classification, "O-1A");
  const b = parseQualifyRequest({ profile: valid.profile, classification: "O-1B" });
  if (b.ok) assert.equal(b.value.classification, "O-1B");
  const c = parseQualifyRequest({ profile: valid.profile, classification: "BOGUS" });
  if (c.ok) assert.equal(c.value.classification, "O-1A", "unknown → O-1A");
});

test("mockQualification: scores against the chosen pack's criteria", () => {
  const o1b = mockQualification({
    name: "x",
    classification: "O-1B",
    profile:
      "Starring lead role in a distinguished production; reviews in major newspapers; high per-episode fee.",
  });
  const names = o1b.criteria.map((c) => c.name);
  assert.ok(names.includes("Lead role in distinguished productions"));
  assert.ok(names.includes("Reviews & press"));
  assert.ok(!names.includes("Scholarly articles"), "O-1B has no scholarly-articles criterion");
  assert.ok(o1b.criteria.some((c) => c.status === "Met"));
});
