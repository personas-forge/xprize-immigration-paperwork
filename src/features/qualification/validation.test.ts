import assert from "node:assert/strict";
import { test } from "node:test";

import { CLASSIFICATIONS } from "./packs";
import { livePrograms } from "./jurisdictions";
import {
  COMPLIANCE_VALIDATIONS,
  PROGRAM_VALIDATIONS,
  REVALIDATE_AFTER_DAYS,
  allValidations,
  daysBetween,
  isStale,
  validationFor,
  type ValidationRecord,
} from "./validation";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertWellFormed(r: ValidationRecord, label: string) {
  assert.ok(r.legalBasis.length > 0, `${label}: legalBasis`);
  assert.match(r.lastVerified, DATE_RE, `${label}: lastVerified is yyyy-mm-dd`);
  assert.ok(r.sources.length >= 1, `${label}: has at least one source`);
  for (const s of r.sources) {
    assert.ok(s.title.length > 0, `${label}: source has a title`);
    assert.ok(s.url.startsWith("https://"), `${label}: source url is https`);
  }
}

// — Completeness: every program is tracked ───────────────────────────────────

test("every visa program has a validation record", () => {
  for (const code of CLASSIFICATIONS) {
    const r = validationFor(code);
    assert.ok(r, `validation record exists for ${code}`);
    if (r) assertWellFormed(r, code);
  }
});

// — The CI gate: a LIVE program must be VERIFIED, cited, and primary-sourced ──

test("every LIVE program is verified against a primary/agency source", () => {
  for (const code of livePrograms()) {
    const r = validationFor(code);
    assert.ok(r, `${code} has a validation record`);
    if (!r) continue;
    assert.equal(r.status, "verified", `${code} must be verified to be offered`);
    assert.ok(r.threshold && r.threshold.length > 0, `${code} records its threshold`);
    assert.ok(
      r.sources.some((s) => s.kind === "primary-law" || s.kind === "agency-guidance"),
      `${code} cites a primary-law or agency-guidance source`,
    );
  }
});

test("the US market's compliance claims are verified and cited", () => {
  for (const key of ["us-federal-practice", "us-arizona-abs"]) {
    const r = COMPLIANCE_VALIDATIONS[key];
    assert.ok(r, `compliance record ${key} exists`);
    assert.equal(r.status, "verified", `${key} is verified`);
    assertWellFormed(r, key);
  }
});

// — The model-mismatch finding is recorded (planned UK) ──────────────────────

test("UK is gated (not live) and its model-mismatch is documented", () => {
  assert.ok(!livePrograms().includes("UK-Global-Talent"), "UK is not offered");
  const r = PROGRAM_VALIDATIONS["UK-Global-Talent"];
  assert.equal(r.status, "needs-review");
  assert.match(r.notes ?? "", /endorsement/i);
  assert.match(r.notes ?? "", /mismatch/i);
});

// — Freshness is a pure, testable function ────────────────────────────────────

test("daysBetween / isStale compute against a fixed reference date", () => {
  assert.equal(daysBetween("2026-01-01", "2026-01-31"), 30);
  assert.equal(daysBetween("2026-05-30", "2026-05-30"), 0);
  const rec = PROGRAM_VALIDATIONS["O-1A"];
  assert.equal(isStale(rec, rec.lastVerified), false, "fresh on the day it was verified");
  // One day past the window → stale.
  const justOver = addDays(rec.lastVerified, REVALIDATE_AFTER_DAYS + 1);
  assert.equal(isStale(rec, justOver), true);
  // Inside the window → not stale.
  const within = addDays(rec.lastVerified, REVALIDATE_AFTER_DAYS - 1);
  assert.equal(isStale(rec, within), false);
});

test("no validation record is dated in an impossible format", () => {
  for (const r of allValidations()) assert.match(r.lastVerified, DATE_RE);
});

function addDays(iso: string, days: number): string {
  const t = new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
