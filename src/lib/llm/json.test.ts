import assert from "node:assert/strict";
import { test } from "node:test";

import { extractJson } from "./json";

test("extractJson: parses a bare object", () => {
  assert.deepEqual(extractJson('{"a":1,"b":"x"}'), { a: 1, b: "x" });
});

test("extractJson: tolerates ```json fences and surrounding prose", () => {
  const wrapped = "Here you go:\n```json\n{\"ok\":true}\n```\nThanks!";
  assert.deepEqual(extractJson(wrapped), { ok: true });
});

test("extractJson: pulls the object out of surrounding prose", () => {
  assert.deepEqual(extractJson('prefix {"a":3} suffix'), { a: 3 });
});

test("extractJson: keeps nested objects (balances braces)", () => {
  assert.deepEqual(extractJson('{"a":{"b":2}}'), { a: { b: 2 } });
});

test("extractJson: stops at the first balanced object, not the last } (no over-grab)", () => {
  // A naive slice(indexOf('{'), lastIndexOf('}')+1) would sweep in a trailing
  // second object the model appended in prose and yield unparseable text. The
  // balanced-brace scan returns only the first object.
  assert.deepEqual(extractJson('{"a":1} note {"b":2}'), { a: 1 });
});

test("extractJson: skips a non-JSON fence that precedes the JSON fence", () => {
  // A reasoning ```text``` block (or ```sql```) before the real ```json``` fence
  // must not shadow it — the first fence WITH a `{` (or the raw text) wins.
  const out =
    "```text\nLet me think about this step by step.\n```\n\n```json\n{\"verdict\":\"ok\"}\n```";
  assert.deepEqual(extractJson(out), { verdict: "ok" });
});

test("extractJson: falls back to the raw text when a fence has no balanced object", () => {
  // First json fence is broken; the real object sits unfenced after it.
  assert.deepEqual(extractJson("```json\n{ oops\n```\nactually {\"a\":9}"), { a: 9 });
});

test("extractJson: returns null on garbage, broken JSON, or no object", () => {
  assert.equal(extractJson("not json at all"), null);
  assert.equal(extractJson("{ broken"), null);
  assert.equal(extractJson(""), null);
});
