import assert from "node:assert/strict";
import { test } from "node:test";

import { type AdapterResult, err, isOk, ok } from "./result";

test("ok: wraps a value in the success branch", () => {
  const r = ok(42);
  assert.deepEqual(r, { ok: true, value: 42 });
  assert.equal(isOk(r), true);
});

test("err: omits cause when not provided", () => {
  assert.deepEqual(err("forbidden"), { ok: false, error: { kind: "forbidden" } });
});

test("err: attaches cause only when provided (store_error)", () => {
  const boom = new Error("pg down");
  assert.deepEqual(err("store_error", boom), {
    ok: false,
    error: { kind: "store_error", cause: boom },
  });
});

test("isOk: narrows the false branch", () => {
  const r: AdapterResult<number> = err("not_found");
  assert.equal(isOk(r), false);
});
