import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CLASSIFICATIONS,
  VISA_PACKS,
  criteriaNames,
  isClassification,
  packFor,
} from "./packs";

test("every classification has a well-formed pack", () => {
  for (const c of CLASSIFICATIONS) {
    const pack = VISA_PACKS[c];
    assert.equal(pack.classification, c);
    assert.ok(pack.threshold >= 1);
    assert.ok(pack.criteria.length >= pack.threshold, `${c} has enough criteria`);
    const names = pack.criteria.map((x) => x.name);
    assert.equal(new Set(names).size, names.length, `${c} criterion names are unique`);
    assert.ok(pack.label.length > 0);
  }
});

test("packFor falls back to O-1A; isClassification guards input", () => {
  assert.equal(packFor("nope").classification, "O-1A");
  assert.equal(packFor("EB-1A").classification, "EB-1A");
  assert.ok(isClassification("O-1B"));
  assert.ok(!isClassification("H-1B"));
  assert.ok(!isClassification(42));
  assert.ok(!isClassification(null));
});

test("criteriaNames returns the pack's ordered names", () => {
  assert.deepEqual(
    criteriaNames("O-1A"),
    VISA_PACKS["O-1A"].criteria.map((c) => c.name),
  );
  assert.equal(criteriaNames("O-1B").length, 6);
  assert.equal(criteriaNames("EB-1A").length, 10);
});

test("Scholarly-articles keyword match treats a conference TALK as not-a-publication (UAT T3)", () => {
  const scholarly = VISA_PACKS["O-1A"].criteria.find(
    (c) => c.name === "Scholarly articles",
  );
  assert.ok(scholarly, "O-1A pack has a Scholarly-articles criterion");
  // A talk is not a scholarly article — must NOT match on the word "conference"
  // (the keyless preview previously scored "Scholarly: Met" off a conference talk).
  assert.ok(
    !scholarly!.match.test("I gave two conference talks at industry meetups"),
    "a conference talk alone must not score Scholarly: Met",
  );
  // Real publications still match.
  assert.ok(scholarly!.match.test("published a paper in a peer-reviewed journal"));
  assert.ok(scholarly!.match.test("3,000 citations on arXiv"));
});
