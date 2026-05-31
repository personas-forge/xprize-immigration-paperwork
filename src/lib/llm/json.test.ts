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

test("extractJson: takes the outermost braces (first { to last })", () => {
  assert.deepEqual(extractJson('{"a":{"b":2}}'), { a: { b: 2 } });
});

test("extractJson: returns null on garbage, broken JSON, or no object", () => {
  assert.equal(extractJson("not json at all"), null);
  assert.equal(extractJson("{ broken"), null);
  assert.equal(extractJson(""), null);
});
