import { test } from "node:test";
import assert from "node:assert/strict";

import { asObjectBody, str, JSON_OBJECT_BODY_ERROR } from "@/lib/validation";

test("asObjectBody narrows a plain object to a string-keyed record", () => {
  const out = asObjectBody({ a: 1, b: "x" });
  assert.deepEqual(out, { a: 1, b: "x" });
});

test("asObjectBody rejects non-objects and null (the historic guard)", () => {
  assert.equal(asObjectBody(null), null);
  assert.equal(asObjectBody(undefined), null);
  assert.equal(asObjectBody("string"), null);
  assert.equal(asObjectBody(42), null);
  assert.equal(asObjectBody(true), null);
});

test("asObjectBody preserves the historical array passthrough (typeof [] === 'object')", () => {
  // The five inlined guards all used `typeof body !== 'object' || body === null`,
  // which lets an array through. asObjectBody MUST keep that behaviour verbatim —
  // tightening it would silently change the contract of every AI parser.
  const arr = [1, 2, 3];
  assert.equal(asObjectBody(arr), arr);
});

test("JSON_OBJECT_BODY_ERROR is the exact string the parsers return", () => {
  assert.equal(JSON_OBJECT_BODY_ERROR, "Request body must be a JSON object.");
});

test("str trims, length-caps, and returns '' for non-strings", () => {
  assert.equal(str("  hello  ", 200), "hello");
  assert.equal(str("abcdef", 3), "abc");
  assert.equal(str(123, 10), "");
  assert.equal(str(null, 10), "");
  assert.equal(str(undefined, 10), "");
});

test("str matches the evidence document-name coercion it replaced", () => {
  // Parity with the prior inline branch:
  //   typeof name === 'string' && name.trim() !== '' ? name.trim().slice(0, MAX) : ''
  // All-whitespace and non-strings collapse to '' (the rejected case); a real
  // value is trimmed then capped.
  assert.equal(str("   ", 200), "");
  assert.equal(str("  Passport.pdf  ", 200), "Passport.pdf");
  assert.equal(str(42, 200), "");
});
