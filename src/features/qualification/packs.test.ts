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
