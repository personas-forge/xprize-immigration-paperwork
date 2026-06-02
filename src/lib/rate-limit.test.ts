import assert from "node:assert/strict";
import { test } from "node:test";

import { checkRateLimit, rateLimitKey, isRateLimitEnabled } from "./rate-limit";

test("checkRateLimit: allows up to the limit in a window, then blocks with Retry-After", () => {
  const store = new Map();
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) {
    assert.equal(checkRateLimit("k", 3, 1000, t0, store).ok, true, `call ${i + 1} allowed`);
  }
  const blocked = checkRateLimit("k", 3, 1000, t0, store);
  assert.equal(blocked.ok, false, "4th call blocked");
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSec >= 1, "reports a positive Retry-After");
});

test("checkRateLimit: a fresh window after resetAt allows again", () => {
  const store = new Map();
  assert.equal(checkRateLimit("k", 1, 1000, 0, store).ok, true);
  assert.equal(checkRateLimit("k", 1, 1000, 500, store).ok, false, "still in window");
  assert.equal(checkRateLimit("k", 1, 1000, 1000, store).ok, true, "window elapsed → new bucket");
});

test("checkRateLimit: distinct keys are independent", () => {
  const store = new Map();
  assert.equal(checkRateLimit("a", 1, 1000, 0, store).ok, true);
  assert.equal(checkRateLimit("b", 1, 1000, 0, store).ok, true, "b unaffected by a");
});

test("rateLimitKey: prefers the user id, else the first forwarded IP, else anon", () => {
  const req = new Request("http://x", {
    headers: { "x-forwarded-for": "9.9.9.9, 1.1.1.1" },
  });
  assert.equal(rateLimitKey(req, "draft", "user-1"), "draft:u:user-1");
  assert.equal(rateLimitKey(req, "draft", null), "draft:ip:9.9.9.9");
  assert.equal(rateLimitKey(new Request("http://x"), "rfe"), "rfe:ip:anon");
});

test("isRateLimitEnabled: on by default, off only when RATE_LIMIT_DISABLED=1", () => {
  assert.equal(isRateLimitEnabled({}), true);
  assert.equal(isRateLimitEnabled({ RATE_LIMIT_DISABLED: "1" }), false);
});
