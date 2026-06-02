import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatSignedCurrency,
} from "./format";

const INVALID = "—";

// --- Rendering preserved: valid input must produce the exact same strings as before the guard ---

test("formatCurrency renders finite values unchanged", () => {
  assert.equal(formatCurrency(1234.5), "$1,234.50");
  assert.equal(formatCurrency(1234.5, false), "$1,235");
  assert.equal(formatCurrency(0), "$0.00");
});

test("formatSignedCurrency renders sign and U+2212 minus unchanged", () => {
  assert.equal(formatSignedCurrency(1000), "+$1,000.00");
  assert.equal(formatSignedCurrency(-1000), "−$1,000.00"); // U+2212 minus
  assert.equal(formatSignedCurrency(0), "$0.00");
});

test("formatNumber renders finite values unchanged", () => {
  assert.equal(formatNumber(1234567), "1,234,567");
});

test("formatPercent renders finite values unchanged", () => {
  assert.equal(formatPercent(92), "92%");
  assert.equal(formatPercent(92.345, 1), "92.3%");
});

// --- Guard: non-finite / non-number input degrades to the placeholder and never throws ---

test("formatPercent does not throw and returns placeholder for null/undefined (the crash fix)", () => {
  assert.doesNotThrow(() => formatPercent(null as unknown as number));
  assert.equal(formatPercent(null as unknown as number), INVALID);
  assert.equal(formatPercent(undefined as unknown as number), INVALID);
});

test("all helpers return placeholder for NaN", () => {
  assert.equal(formatCurrency(NaN), INVALID);
  assert.equal(formatSignedCurrency(NaN), INVALID);
  assert.equal(formatNumber(NaN), INVALID);
  assert.equal(formatPercent(NaN), INVALID);
});

test("all helpers return placeholder for Infinity / -Infinity", () => {
  assert.equal(formatCurrency(Infinity), INVALID);
  assert.equal(formatCurrency(-Infinity), INVALID);
  assert.equal(formatSignedCurrency(Infinity), INVALID);
  assert.equal(formatNumber(Infinity), INVALID);
  assert.equal(formatPercent(Infinity), INVALID);
});
