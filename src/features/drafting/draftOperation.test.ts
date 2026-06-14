import assert from "node:assert/strict";
import { test } from "node:test";

import { DISCLAIMER, mockDraft, type DraftRequest } from "./index";
import { draftSpec, type DraftInput } from "./draftOperation";

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
