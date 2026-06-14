import { test } from "node:test";
import assert from "node:assert/strict";

import {
  encodeSnapshot,
  decodeSnapshot,
  snapshotFromResult,
  snapshotQualifying,
  type PatentSnapshot,
} from "./letters-patent";
import { packFor } from "./packs";

const O1A_LEN = packFor("O-1A").criteria.length;

const snap: PatentSnapshot = {
  name: "Dr. Anya Krishnan",
  classification: "O-1A",
  likelihood: 78,
  statuses: Array.from({ length: O1A_LEN }, (_, i) => (i % 2 === 0 ? "Met" : "Partial")),
};

test("encode → decode round-trips a snapshot", () => {
  const token = encodeSnapshot(snap);
  assert.deepEqual(decodeSnapshot(token), snap);
});

test("token is URL-safe (no +, /, =, or whitespace)", () => {
  const token = encodeSnapshot(snap);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(token), `token not URL-safe: ${token}`);
});

test("decode rejects garbage, non-live programs, and wrong status counts", () => {
  assert.equal(decodeSnapshot("@@not-base64@@"), null);
  assert.equal(decodeSnapshot("not-a-real-token"), null);
  // A valid-looking token but a planned (non-live) program → null.
  const planned = encodeSnapshotRaw({ n: "x", c: "UK-Global-Talent", l: 50, s: "M" });
  assert.equal(decodeSnapshot(planned), null);
  // Wrong status count for the pack → null (tamper guard).
  const wrongLen = encodeSnapshotRaw({ n: "x", c: "O-1A", l: 50, s: "MS" });
  assert.equal(decodeSnapshot(wrongLen), null);
});

test("decode clamps likelihood and defaults a blank name", () => {
  const token = encodeSnapshotRaw({ n: "", c: "O-1A", l: 999, s: "M".repeat(O1A_LEN) });
  const out = decodeSnapshot(token)!;
  assert.equal(out.name, "Applicant");
  assert.equal(out.likelihood, 100);
});

test("snapshotFromResult: maps criteria statuses in order, coerces unknowns to None", () => {
  const s = snapshotFromResult({
    name: "A",
    classification: "O-1A",
    likelihood: 60,
    criteria: [{ status: "Met" }, { status: "weird" }, { status: "Strong" }],
  });
  assert.deepEqual(s.statuses, ["Met", "None", "Strong"]);
});

test("snapshotQualifying: counts Met + Strong only", () => {
  assert.equal(
    snapshotQualifying({ ...snap, statuses: ["Met", "Strong", "Partial", "None"] }),
    2,
  );
});

// Helper: encode a RAW compact object (to forge tampered tokens in tests),
// mirroring the module's internal base64url so we don't export internals.
function encodeSnapshotRaw(compact: { n: string; c: string; l: number; s: string }): string {
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
