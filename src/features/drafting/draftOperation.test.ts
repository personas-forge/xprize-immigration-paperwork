import assert from "node:assert/strict";
import { test } from "node:test";

import { DISCLAIMER, mockDraft, type DraftRequest, type DraftSection } from "./index";
import {
  draftSpec,
  mergeRegeneratedSection,
  pickMergeBase,
  type DraftInput,
} from "./draftOperation";

// Unit coverage for the /api/draft operation spec's TWO-PATH DISPATCH — the new
// risk in moving draft onto the orchestrator. The orchestrator itself (rate-limit
// → charge → reclaim → 401/402/429 + DISCLAIMER) is covered by operation.test.ts;
// these assert the draft-specific branching: full-letter vs single-section across
// operation / guard / mock / build. The parse + persist hooks do adapter I/O
// (owner-only gate, section-merge save) and are faithful translations of the
// prior route, exercised by tsc + the e2e API specs.

const valid: DraftRequest = {
  petitioner: "Dr. Anya Krishnan",
  classification: "O-1A",
  criteria: [
    { name: "Awards", status: "Met", evidence: "Best-paper award", rationale: "Recognized." },
    { name: "Scholarly articles", status: "Strong", evidence: "6 papers", rationale: "Sustained." },
  ],
};
const fullInput: DraftInput = { req: valid, focus: null, caseId: null };
const sectionInput: DraftInput = { req: valid, focus: "Awards", caseId: null };

test("operation: full letter bills 'draft', single section bills 'draft_section'", () => {
  const op = draftSpec.operation;
  assert.equal(typeof op, "function");
  if (typeof op === "function") {
    assert.equal(op(fullInput), "draft");
    assert.equal(op(sectionInput), "draft_section");
  }
});

test("guard (full): valid JSON → draft kind; garbage → null", () => {
  const good = draftSpec.guard(
    JSON.stringify({ sections: [{ heading: "Introduction", body: "x" }] }),
    fullInput,
  );
  assert.ok(good && good.kind === "draft");
  if (good && good.kind === "draft") {
    assert.equal(good.draft.sections[0].heading, "Introduction");
  }
  assert.equal(draftSpec.guard("not json", fullInput), null, "garbage → null (reclaim+mock)");
});

test("guard (section): pins heading to focus (not the model's), body from model; garbage → null", () => {
  const good = draftSpec.guard(
    JSON.stringify({ heading: "Model Renamed It", body: "Fresh body." }),
    sectionInput,
  );
  assert.ok(good && good.kind === "section");
  if (good && good.kind === "section") {
    assert.equal(good.section.heading, "Awards", "heading pinned to focus so the merge matches");
    assert.equal(good.section.body, "Fresh body.");
  }
  assert.equal(draftSpec.guard("garbage", sectionInput), null);
});

test("mock: full → draft kind; focus → section kind with heading pinned to focus", () => {
  const full = draftSpec.mock(fullInput);
  assert.equal(full.kind, "draft");
  if (full.kind === "draft") assert.ok(full.draft.sections.length > 0);

  const section = draftSpec.mock(sectionInput);
  assert.equal(section.kind, "section");
  if (section.kind === "section") assert.equal(section.section.heading, "Awards");
});

test("build: dispatches to the right envelope, always attaching DISCLAIMER + source", () => {
  const draftBody = draftSpec.build({ kind: "draft", draft: mockDraft(valid) }, "gemini", fullInput);
  assert.ok(Array.isArray((draftBody as { sections?: unknown }).sections), "full → .sections");
  assert.equal(draftBody.disclaimer, DISCLAIMER);
  assert.equal(draftBody.source, "gemini");

  const sectionBody = draftSpec.build(
    { kind: "section", section: { heading: "Awards", body: "b" } },
    "mock",
    sectionInput,
  );
  assert.ok((sectionBody as { section?: unknown }).section, "section → .section");
  assert.equal(sectionBody.disclaimer, DISCLAIMER);
  assert.equal(sectionBody.source, "mock");
});

// Regenerate-merge: the persisted version must reflect the user's CURRENT edits to
// OTHER sections, not the last stored draft (regression for the silent edit-loss).
const clientHeld: DraftSection[] = [
  { heading: "Introduction", body: "MY UNSAVED EDIT to the intro." },
  { heading: "Awards", body: "old awards body (about to be regenerated)" },
  { heading: "Conclusion", body: "MY UNSAVED EDIT to the conclusion." },
];

test("pickMergeBase: prefers the client's current sections when they include the focus heading", () => {
  const base = pickMergeBase(clientHeld, "Awards");
  assert.ok(base, "client set is used as the merge base");
  assert.deepEqual(
    base?.map((s) => s.heading),
    ["Introduction", "Awards", "Conclusion"],
  );
  // It's a copy of {heading, body} — not the same references.
  assert.notEqual(base, clientHeld);
});

test("pickMergeBase: falls back to null for legacy clients (no/empty sections) or a set missing the focus", () => {
  assert.equal(pickMergeBase(null, "Awards"), null);
  assert.equal(pickMergeBase(undefined, "Awards"), null);
  assert.equal(pickMergeBase([], "Awards"), null);
  // A set that doesn't contain the section being regenerated can't be trusted.
  assert.equal(pickMergeBase(clientHeld, "Press Coverage"), null);
});

test("mergeRegeneratedSection: replaces only the focus body, preserving every other section's (edited) body", () => {
  const merged = mergeRegeneratedSection(clientHeld, "Awards", "FRESH regenerated awards prose.");
  assert.deepEqual(merged, [
    { heading: "Introduction", body: "MY UNSAVED EDIT to the intro." },
    { heading: "Awards", body: "FRESH regenerated awards prose." },
    { heading: "Conclusion", body: "MY UNSAVED EDIT to the conclusion." },
  ]);
});

test("mergeRegeneratedSection: with duplicate headings, replaces ONLY the first (no clobber)", () => {
  const dupes: DraftSection[] = [
    { heading: "Critical role", body: "first role argument" },
    { heading: "Press", body: "press argument" },
    { heading: "Critical role", body: "SECOND distinct role argument" },
  ];
  const merged = mergeRegeneratedSection(dupes, "Critical role", "REGENERATED");
  assert.deepEqual(merged, [
    { heading: "Critical role", body: "REGENERATED" },
    { heading: "Press", body: "press argument" },
    // The second same-named section must survive untouched.
    { heading: "Critical role", body: "SECOND distinct role argument" },
  ]);
});

test("regenerate merge end-to-end (pure): the unsaved intro/conclusion edits survive a section regenerate", () => {
  // What persist does: pick the client base, then merge the new section into it.
  const base = pickMergeBase(clientHeld, "Awards");
  assert.ok(base);
  const persisted = mergeRegeneratedSection(base!, "Awards", "FRESH awards prose.");
  assert.equal(persisted.find((s) => s.heading === "Introduction")?.body, "MY UNSAVED EDIT to the intro.");
  assert.equal(persisted.find((s) => s.heading === "Conclusion")?.body, "MY UNSAVED EDIT to the conclusion.");
  assert.equal(persisted.find((s) => s.heading === "Awards")?.body, "FRESH awards prose.");
});
