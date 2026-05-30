import assert from "node:assert/strict";
import { test } from "node:test";

import { VISA_PACKS, type Classification } from "./packs";
import {
  JURISDICTIONS,
  isLiveProgram,
  jurisdictionFor,
  livePrograms,
} from "./jurisdictions";

test("every jurisdiction program maps to a real pack, and vice versa", () => {
  const declared = Object.values(JURISDICTIONS).flatMap((j) => j.programs);
  // No duplicates across jurisdictions.
  assert.equal(new Set(declared).size, declared.length, "programs unique across jurisdictions");
  // Every declared program has a pack.
  for (const code of declared) assert.ok(VISA_PACKS[code], `pack exists for ${code}`);
  // Every pack is claimed by exactly one jurisdiction.
  for (const code of Object.keys(VISA_PACKS) as Classification[]) {
    assert.ok(declared.includes(code), `${code} is claimed by a jurisdiction`);
  }
});

test("US is live with the three federal programs; UK is planned", () => {
  assert.equal(JURISDICTIONS.US.status, "live");
  assert.deepEqual(JURISDICTIONS.US.programs, ["O-1A", "O-1B", "EB-1A"]);
  assert.match(JURISDICTIONS.US.representationNote, /attorney of record/i);
  assert.match(JURISDICTIONS.US.representationNote, /Arizona ABS/i);
  assert.equal(JURISDICTIONS.UK.status, "planned");
  for (const j of Object.values(JURISDICTIONS)) {
    assert.ok(j.disclaimer.length > 0, `${j.code} has a disclaimer`);
    assert.ok(j.representationRole.length > 0);
  }
});

test("only live programs are offered; planned ones are gated", () => {
  const live = livePrograms();
  assert.deepEqual(live, ["O-1A", "O-1B", "EB-1A"]);
  assert.ok(isLiveProgram("O-1A"));
  assert.ok(!isLiveProgram("UK-Global-Talent"), "planned program is not offered");
  assert.ok(!isLiveProgram("bogus"));
  assert.ok(!isLiveProgram(null));
});

test("jurisdictionFor derives the jurisdiction from the program", () => {
  assert.equal(jurisdictionFor("O-1B").code, "US");
  assert.equal(jurisdictionFor("UK-Global-Talent").code, "UK");
  assert.equal(jurisdictionFor("nonsense").code, "US", "unknown → US default");
});
