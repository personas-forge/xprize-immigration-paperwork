import assert from "node:assert/strict";
import { test } from "node:test";

import { caseRoadmap, type RoadmapStage } from "./roadmap";

function stateOf(stages: RoadmapStage[], key: string): string {
  return stages.find((s) => s.key === key)?.state ?? "";
}

test("caseRoadmap: qualified is always done; six stages in order", () => {
  const r = caseRoadmap("Intake", { hasEvidence: false, hasDraft: false });
  assert.equal(r.length, 6);
  assert.deepEqual(
    r.map((s) => s.key),
    ["qualified", "evidence", "drafted", "review", "filed", "decision"],
  );
  assert.equal(stateOf(r, "qualified"), "done");
  assert.equal(stateOf(r, "evidence"), "current", "no evidence yet → evidence is current");
});

test("caseRoadmap: pre-submission advances with evidence then draft", () => {
  const withEvidence = caseRoadmap("Drafting", { hasEvidence: true, hasDraft: false });
  assert.equal(stateOf(withEvidence, "evidence"), "done");
  assert.equal(stateOf(withEvidence, "drafted"), "current");

  const withDraft = caseRoadmap("Drafting", { hasEvidence: true, hasDraft: true });
  assert.equal(stateOf(withDraft, "drafted"), "done");
  assert.equal(stateOf(withDraft, "review"), "current", "ready to submit");
});

test("caseRoadmap: review / filed / decision follow status", () => {
  const review = caseRoadmap("Attorney Review", { hasEvidence: true, hasDraft: true });
  assert.equal(stateOf(review, "drafted"), "done");
  assert.equal(stateOf(review, "review"), "current");
  assert.equal(stateOf(review, "filed"), "upcoming");

  const filed = caseRoadmap("Filed", { hasEvidence: true, hasDraft: true });
  assert.equal(stateOf(filed, "review"), "done");
  assert.equal(stateOf(filed, "filed"), "done");
  assert.equal(stateOf(filed, "decision"), "current");
});

test("caseRoadmap: approved marks every stage done", () => {
  const r = caseRoadmap("Approved", { hasEvidence: true, hasDraft: true });
  assert.ok(r.every((s) => s.state === "done"));
});

test("caseRoadmap: a draft carries past Evidence even with an empty vault (F4 / fam-track-01)", () => {
  const draftNoEvidence = caseRoadmap("Drafting", { hasEvidence: false, hasDraft: true });
  assert.notEqual(
    stateOf(draftNoEvidence, "evidence"),
    "current",
    "Evidence must not be 'current' once a draft exists",
  );
  assert.equal(stateOf(draftNoEvidence, "evidence"), "done");
  assert.equal(stateOf(draftNoEvidence, "drafted"), "done");
  assert.equal(stateOf(draftNoEvidence, "review"), "current");
});
