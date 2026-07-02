/**
 * Unit tests for the review actions' PURE pieces. `actions.ts` itself is a
 * server-only `"use server"` module (imports `@/lib/auth/session`, `next/cache`)
 * and cannot load under `tsx --test` — the same situation owner-only-gate.test.ts
 * documents — so the logic it consumes is split into pure siblings (`receipt.ts`,
 * `decisions.ts`) and pinned here. The DB-side transition semantics those actions
 * ride on (compare-and-set, sign-and-file receipt recording, event append) are
 * pinned against the real PGlite store in `src/lib/data/reviews.test.ts`; the
 * getUser/ownership gates on top remain covered by owner-only-gate.test.ts and
 * the Playwright review flow, not here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { USCIS_DECISIONS } from "./decisions";
import { isUscisReceipt, newReceiptNumber } from "./receipt";

test("isUscisReceipt accepts every service-center prefix with exactly 10 digits", () => {
  // The allowlisted prefixes are the real USCIS service centers. A receipt the
  // attorney records becomes the case's authoritative tracking number, so it
  // must at least be shaped like one before we persist it.
  for (const prefix of ["EAC", "WAC", "LIN", "SRC", "IOE", "MSC", "YSC", "NBC"]) {
    assert.equal(isUscisReceipt(`${prefix}2412345678`), true, prefix);
  }
});

test("isUscisReceipt is case-insensitive and trims surrounding whitespace", () => {
  // Attorneys paste receipts from emails and scanned PDFs: stray whitespace or
  // lowercase must not bounce a genuine receipt back as a "typo".
  assert.equal(isUscisReceipt("eac2412345678"), true);
  assert.equal(isUscisReceipt("  EAC2412345678  "), true);
});

test("isUscisReceipt rejects malformed values (wrong prefix / digit count / embedded text)", () => {
  // The ^…$ anchors and the exact digit count are the point: recording a typo
  // as authoritative is worse than asking the attorney to re-enter it, and a
  // substring match would wave through a receipt buried in pasted junk.
  for (const bad of [
    "",
    "EAC241234567", // 9 digits
    "EAC24123456789", // 11 digits
    "ABC2412345678", // not a service center
    "EAC24123A5678", // letter among the digits
    "XEAC2412345678", // leading junk (left anchor)
    "EAC2412345678X", // trailing junk (right anchor)
    "EAC 2412345678", // interior whitespace is NOT trimmed away
  ]) {
    assert.equal(isUscisReceipt(bad), false, JSON.stringify(bad));
  }
});

test("newReceiptNumber mints a value that passes the real-receipt validator", () => {
  // The demo receipt must be indistinguishable in SHAPE from a real one — the
  // `demo:true` metadata flag, not the format, is what marks it. A malformed
  // mint would fail any later re-validation of stored receipts. Sampled a few
  // times because the tail is random.
  for (let i = 0; i < 20; i++) {
    const receipt = newReceiptNumber();
    assert.match(receipt, /^EAC[1-9]\d{9}$/); // exactly 10 digits, no leading zero
    assert.equal(isUscisReceipt(receipt), true);
  }
});

test("USCIS_DECISIONS is the exact, case-sensitive allowlist the action enforces", () => {
  // attorneyRecordDecision rejects anything not in this list VERBATIM — the
  // append-only review log must never carry an arbitrary decision string, and
  // only "Approved" is terminal. Pinning the members makes adding/renaming one
  // a conscious act (the ReviewPanel <select> renders from this same array, so
  // form and validator can't drift).
  assert.deepEqual([...USCIS_DECISIONS], ["Approved", "RFE issued", "Denied"]);
  const allowlist = USCIS_DECISIONS as readonly string[];
  assert.equal(allowlist.includes("approved"), false); // case-sensitive on purpose
  assert.equal(allowlist.includes("Withdrawn"), false);
});
