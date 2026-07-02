import { test } from "node:test";
import assert from "node:assert/strict";

import { createIdempotencyKeys } from "@/lib/idempotency";

// The server's accepted key shape (operation.ts IDEMPOTENCY_KEY_RE) — a key
// outside it is silently ignored and the charge dedupe DISENGAGES, so this is
// the load-bearing compatibility assertion, not a style check.
const SERVER_KEY_RE = /^[A-Za-z0-9_.:-]{1,200}$/;

test("current() is stable across consecutive calls (a retry reuses the key)", () => {
  const keys = createIdempotencyKeys();
  const first = keys.current();
  // A network failure / error body / 402 path makes NO helper call — the next
  // attempt must land on the very same key or the retry double-charges.
  assert.equal(keys.current(), first);
  assert.equal(keys.current(), first);
});

test("current(fingerprint) is stable while the inputs are stable", () => {
  const keys = createIdempotencyKeys();
  const fp = JSON.stringify({ name: "Anya", profile: "…" });
  const first = keys.current(fp);
  assert.equal(keys.current(fp), first);
});

test("a changed fingerprint rotates the key (changed inputs = new intent)", () => {
  const keys = createIdempotencyKeys();
  const a = keys.current("body-a");
  const b = keys.current("body-b");
  assert.notEqual(b, a);
  // …and the new fingerprint is now the stable one.
  assert.equal(keys.current("body-b"), b);
});

test("rotate() yields a fresh key even for identical inputs (success = intent done)", () => {
  const keys = createIdempotencyKeys();
  const fp = "same-body";
  const first = keys.current(fp);
  keys.rotate();
  const second = keys.current(fp);
  // A deliberate re-run of the SAME op after success is a NEW paid run —
  // reusing the key here would make it free via the server dedupe.
  assert.notEqual(second, first);
});

test("rotate() before any current() is harmless", () => {
  const keys = createIdempotencyKeys();
  keys.rotate();
  assert.match(keys.current(), SERVER_KEY_RE);
});

test("independent managers never share keys (distinct ops keep distinct intents)", () => {
  const a = createIdempotencyKeys();
  const b = createIdempotencyKeys();
  assert.notEqual(a.current(), b.current());
});

test("keys match the server's accepted shape", () => {
  const keys = createIdempotencyKeys();
  assert.match(keys.current(), SERVER_KEY_RE);
  keys.rotate();
  assert.match(keys.current("with-fingerprint"), SERVER_KEY_RE);
});
