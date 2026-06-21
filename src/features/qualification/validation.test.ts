import assert from "node:assert/strict";
import { test } from "node:test";

import { CLASSIFICATIONS } from "./packs";
import { livePrograms } from "./jurisdictions";
import {
  COMPLIANCE_VALIDATIONS,
  PROGRAM_VALIDATIONS,
  REVALIDATE_AFTER_DAYS,
  REVERIFY_WARN_DAYS,
  addDays,
  allValidations,
  daysBetween,
  freshnessOf,
  isStale,
  stalePrograms,
  todayIso,
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

test("daysBetween computes whole days between two yyyy-mm-dd dates", () => {
  assert.equal(daysBetween("2026-01-01", "2026-01-31"), 30);
  assert.equal(daysBetween("2026-05-30", "2026-05-30"), 0);
});

test("no validation record is dated in an impossible format", () => {
  for (const r of allValidations()) assert.match(r.lastVerified, DATE_RE);
});

test("freshnessOf classifies fresh / due-soon / stale and reports the due date", () => {
  const rec = PROGRAM_VALIDATIONS["O-1A"];
  // On the verification day: fully fresh, daysLeft == the window.
  const onDay = freshnessOf(rec, rec.lastVerified);
  assert.equal(onDay.level, "fresh");
  assert.equal(onDay.daysLeft, REVALIDATE_AFTER_DAYS);
  assert.match(onDay.dueBy, DATE_RE);
  // Inside the warn window → due-soon.
  const soon = addDays(rec.lastVerified, REVALIDATE_AFTER_DAYS - Math.floor(REVERIFY_WARN_DAYS / 2));
  assert.equal(freshnessOf(rec, soon).level, "due-soon");
  // Past the window → stale, daysLeft negative.
  const over = freshnessOf(rec, addDays(rec.lastVerified, REVALIDATE_AFTER_DAYS + 5));
  assert.equal(over.level, "stale");
  assert.equal(over.daysLeft, -5);
});

// — Fail-SAFE: an unparseable date must read as STALE, never "fresh" ──────────

test("freshnessOf fails safe to stale when lastVerified is unparseable", () => {
  for (const bad of ["", "2026-13-40", "not-a-date", "2026/05/30"]) {
    const rec: ValidationRecord = { ...PROGRAM_VALIDATIONS["O-1A"], lastVerified: bad };
    const f = freshnessOf(rec, todayIso());
    assert.equal(f.level, "stale", `"${bad}" must classify stale, not fresh`);
    assert.equal(f.unverifiable, true, `"${bad}" must be marked unverifiable`);
    assert.equal(isStale(rec, todayIso()), true, `"${bad}" must be stale via isStale`);
  }
  // A bad reference date must also not read as fresh.
  assert.equal(freshnessOf(PROGRAM_VALIDATIONS["O-1A"], "2026-13-40").level, "stale");
});

// — Commit-CI guard: no LIVE program may be overdue as of today ───────────────
// This is the enforcement docs/validation-framework.md promises ("a market
// can't go live stale"). It fails the `verify` job the moment a record drifts
// past REVALIDATE_AFTER_DAYS, so staleness is caught on commit, not only by the
// weekly workflow.

test("every LIVE program's validation record is currently fresh (not stale)", () => {
  const today = todayIso();
  for (const code of livePrograms()) {
    const r = validationFor(code);
    assert.ok(r, `${code} has a validation record`);
    if (!r) continue;
    assert.equal(
      isStale(r, today),
      false,
      `${code} is overdue for re-verification (lastVerified ${r.lastVerified}) — re-verify and bump the date before shipping`,
    );
  }
});

test("stalePrograms() reports overdue live programs (none today, all when far future)", () => {
  // Today: every live program is fresh, so the runtime monitor is empty.
  assert.deepEqual(stalePrograms(todayIso()), [], "no live program should be stale today");
  // Far past the window: every live program is overdue → all surfaced.
  const farFuture = addDays(todayIso(), REVALIDATE_AFTER_DAYS + 365);
  assert.deepEqual(
    [...stalePrograms(farFuture)].sort(),
    [...livePrograms()].sort(),
    "every live program is overdue once we are well past the window",
  );
});
