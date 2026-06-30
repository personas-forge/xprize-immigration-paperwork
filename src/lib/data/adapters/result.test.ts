import assert from "node:assert/strict";
import { test } from "node:test";

import { err, ok, wrapFound, wrapVersion } from "./result";

test("ok: wraps a value in the success branch", () => {
  const r = ok(42);
  assert.deepEqual(r, { ok: true, value: 42 });
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

test("wrapFound: true → ok(undefined); false → not_found", async () => {
  assert.deepEqual(await wrapFound(async () => true), { ok: true, value: undefined });
  assert.deepEqual(await wrapFound(async () => false), {
    ok: false,
    error: { kind: "not_found" },
  });
});

test("wrapVersion: number → ok(version); null → unconfigured", async () => {
  assert.deepEqual(await wrapVersion(async () => 3), { ok: true, value: 3 });
  assert.deepEqual(await wrapVersion(async () => null), {
    ok: false,
    error: { kind: "unconfigured" },
  });
});

test("wrapFound/wrapVersion: a throw normalizes to store_error", async () => {
  const boom = new Error("pg down");
  const thrower = async (): Promise<never> => {
    throw boom;
  };
  assert.deepEqual(await wrapFound(thrower), {
    ok: false,
    error: { kind: "store_error", cause: boom },
  });
  assert.deepEqual(await wrapVersion(thrower), {
    ok: false,
    error: { kind: "store_error", cause: boom },
  });
});
