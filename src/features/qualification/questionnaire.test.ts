import assert from "node:assert/strict";
import { test } from "node:test";

import { DISCLAIMER } from "@/features/guidance/guidance";
import { packFor } from "./packs";
import {
  type Answers,
  answersToProfile,
  buildQuestionnaire,
  scoreQuestionnaire,
} from "./questionnaire";

const LIVE: ReadonlyArray<[string, number]> = [
  ["O-1A", 8],
  ["O-1B", 6],
  ["EB-1A", 10],
];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

test("buildQuestionnaire derives one question per criterion, in pack order, for each live program", () => {
  for (const [classification, count] of LIVE) {
    const q = buildQuestionnaire(classification);
    assert.ok(q, `${classification} questionnaire is built`);
    const pack = packFor(classification);

    assert.equal(q.classification, classification);
    assert.equal(q.label, pack.label);
    assert.equal(q.threshold, pack.threshold);
    assert.equal(q.disclaimer, DISCLAIMER);
    assert.equal(q.questions.length, count, `${classification} has ${count} questions`);

    // Same names, in the same order as the pack — packs.ts stays the source of truth.
    assert.deepEqual(
      q.questions.map((x) => x.criterion),
      pack.criteria.map((c) => c.name),
    );
    // ids unique and equal to the criterion-name slug (matches qualification.ts).
    const ids = q.questions.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `${classification} ids are unique`);
    assert.deepEqual(ids, pack.criteria.map((c) => slug(c.name)));
    // hint mirrors the criterion gap copy; prompt is non-empty.
    q.questions.forEach((question, i) => {
      assert.equal(question.hint, pack.criteria[i].gap);
      assert.ok(question.prompt.length > 0);
    });
  }
});

test("buildQuestionnaire gates planned/unknown programs to null (no silent O-1A fallback)", () => {
  assert.equal(buildQuestionnaire("UK-Global-Talent"), null);
  assert.equal(buildQuestionnaire("H-1B"), null);
  assert.equal(buildQuestionnaire(""), null);
});

test("scoreQuestionnaire: all-yes is likely-eligible with metCount = criteria count", () => {
  const q = buildQuestionnaire("O-1A");
  assert.ok(q);
  const answers: Answers = {};
  for (const question of q.questions) answers[question.id] = "yes";

  const outcome = scoreQuestionnaire(answers, "O-1A");
  assert.ok(outcome);
  assert.equal(outcome.verdict, "likely-eligible");
  assert.equal(outcome.metCount, q.questions.length);
  assert.equal(outcome.unsureCount, 0);
  assert.equal(outcome.unmetCriteria.length, 0);
});

test("scoreQuestionnaire: exactly threshold yes is likely-eligible", () => {
  const q = buildQuestionnaire("O-1A");
  assert.ok(q);
  const answers: Answers = {};
  q.questions.forEach((question, i) => {
    answers[question.id] = i < q.threshold ? "yes" : "no";
  });

  const outcome = scoreQuestionnaire(answers, "O-1A");
  assert.ok(outcome);
  assert.equal(outcome.metCount, q.threshold);
  assert.equal(outcome.verdict, "likely-eligible");
});

test("scoreQuestionnaire: (threshold-1) yes + 1 unsure is borderline", () => {
  const q = buildQuestionnaire("O-1A");
  assert.ok(q);
  const answers: Answers = {};
  q.questions.forEach((question, i) => {
    if (i < q.threshold - 1) answers[question.id] = "yes";
    else if (i === q.threshold - 1) answers[question.id] = "unsure";
    else answers[question.id] = "no";
  });

  const outcome = scoreQuestionnaire(answers, "O-1A");
  assert.ok(outcome);
  assert.equal(outcome.metCount, q.threshold - 1);
  assert.equal(outcome.unsureCount, 1);
  assert.equal(outcome.verdict, "borderline");
});

test("scoreQuestionnaire: all-no is insufficient with empty metCriteria; unknown ids ignored", () => {
  const q = buildQuestionnaire("O-1A");
  assert.ok(q);
  const answers: Answers = { "not-a-real-criterion": "yes" };
  for (const question of q.questions) answers[question.id] = "no";

  const outcome = scoreQuestionnaire(answers, "O-1A");
  assert.ok(outcome);
  assert.equal(outcome.verdict, "insufficient");
  assert.deepEqual(outcome.metCriteria, []);
  assert.equal(outcome.metCount, 0);
  // The bogus id contributed nothing.
  assert.equal(outcome.unmetCriteria.length, q.questions.length);
});

test("scoreQuestionnaire gates planned/unknown programs to null", () => {
  assert.equal(scoreQuestionnaire({}, "UK-Global-Talent"), null);
  assert.equal(scoreQuestionnaire({}, "nope"), null);
});

test("answersToProfile: includes yes + unsure criteria and is a usable profile string", () => {
  const q = buildQuestionnaire("EB-1A");
  assert.ok(q);
  const yesId = q.questions[0].id;
  const unsureId = q.questions[1].id;
  const answers: Answers = { [yesId]: "yes", [unsureId]: "unsure" };

  const profile = answersToProfile(answers, "EB-1A");
  assert.ok(profile.length >= 40, "answered profile meets MIN_PROFILE (40 chars)");
  assert.ok(profile.includes(q.questions[0].criterion.toLowerCase()));
  assert.ok(profile.includes(q.questions[1].criterion.toLowerCase()));
});

test("answersToProfile: empty / no-answer input yields an empty string", () => {
  assert.equal(answersToProfile({}, "O-1A"), "");
  const q = buildQuestionnaire("O-1A");
  assert.ok(q);
  const allNo: Answers = {};
  for (const question of q.questions) allNo[question.id] = "no";
  assert.equal(answersToProfile(allNo, "O-1A"), "");
  // Non-live program is also empty.
  assert.equal(answersToProfile({}, "UK-Global-Talent"), "");
});
