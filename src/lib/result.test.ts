import { test } from "node:test";
import assert from "node:assert/strict";

import { wrapResult, DISCLAIMER, CONSENT_DISCLAIMER, type Result } from "@/lib/result";
import { DISCLAIMER as GUIDANCE_DISCLAIMER } from "@/features/guidance/guidance";

test("wrapResult nests the payload under .data and attaches disclaimer + source", () => {
  const r = wrapResult({ hello: "world" }, "gemini");
  assert.deepEqual(r.data, { hello: "world" });
  assert.equal(r.disclaimer, DISCLAIMER);
  assert.equal(r.source, "gemini");
  // Exactly the envelope keys — no leaked/flattened payload fields.
  assert.deepEqual(Object.keys(r).sort(), ["data", "disclaimer", "source"]);
});

test("wrapResult is generic over the payload type (string, object, array)", () => {
  const s: Result<string> = wrapResult("guidance text", "mock");
  assert.equal(s.data, "guidance text");

  const arr: Result<number[]> = wrapResult([1, 2, 3], "claude");
  assert.deepEqual(arr.data, [1, 2, 3]);
  assert.equal(arr.source, "claude");
});

test("wrapResult does not let a payload field shadow the envelope fields", () => {
  // A T that itself has a `disclaimer`/`source` must NOT overwrite the
  // envelope's — that is the failure mode the nested envelope (vs a flattened
  // intersection) exists to prevent. They live under .data, untouched.
  const r = wrapResult({ disclaimer: "FAKE", source: "spoofed" }, "claude");
  assert.equal(r.disclaimer, DISCLAIMER);
  assert.equal(r.source, "claude");
  assert.equal(r.data.disclaimer, "FAKE");
  assert.equal(r.data.source, "spoofed");
});

test("DISCLAIMER carries the UPL safeguard (not-legal-advice + attorney-of-record)", () => {
  const d = DISCLAIMER.toLowerCase();
  assert.ok(d.includes("not legal advice"), "must state it is not legal advice");
  assert.ok(d.includes("attorney"), "must state an attorney of record is required");
  // Positive control: a non-empty, substantive string (guards against a
  // vacuously-passing assertion if the constant were ever emptied).
  assert.ok(DISCLAIMER.length > 80);
});

test("relocated DISCLAIMER is byte-identical to the guidance re-export (back-compat)", () => {
  assert.equal(GUIDANCE_DISCLAIMER, DISCLAIMER);
});

test("CONSENT_DISCLAIMER carries the UPL safeguard + the account-creation nuance", () => {
  const d = CONSENT_DISCLAIMER.toLowerCase();
  assert.ok(d.includes("not legal advice"), "must state it is not legal advice");
  assert.ok(d.includes("attorney"), "must reference an attorney of record");
  assert.ok(
    d.includes("does not form an attorney") && d.includes("relationship"),
    "must state account creation forms no attorney–client relationship",
  );
  assert.ok(CONSENT_DISCLAIMER.length > 80);
});
