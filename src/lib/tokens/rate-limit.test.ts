import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkRateLimit,
  rateLimitKey,
  isRateLimitEnabled,
  enforceRateLimit,
} from "./rate-limit";

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

test("rateLimitKey: prefers user id, else the TRUSTED (rightmost) forwarded hop, else anon", () => {
  // The rightmost XFF entry is the one our own edge appended (trustworthy); the
  // leftmost is the client's claim and must NOT determine the bucket.
  const req = new Request("http://x", {
    headers: { "x-forwarded-for": "9.9.9.9, 1.1.1.1" },
  });
  assert.equal(rateLimitKey(req, "draft", "user-1"), "draft:u:user-1");
  assert.equal(rateLimitKey(req, "draft", null), "draft:ip:1.1.1.1");
  assert.equal(rateLimitKey(new Request("http://x"), "rfe"), "rfe:ip:anon");
});

test("rateLimitKey: rotating the client-claimed (leftmost) XFF hop does NOT fan out buckets", () => {
  const mk = (xff: string) =>
    rateLimitKey(new Request("http://x", { headers: { "x-forwarded-for": xff } }), "guidance");
  // Attacker rotates the leftmost claim; our edge appends the same real IP last.
  assert.equal(mk("1.2.3.4, 8.8.8.8"), "guidance:ip:8.8.8.8");
  assert.equal(mk("1.2.3.5, 8.8.8.8"), "guidance:ip:8.8.8.8");
  assert.equal(mk("9.9.9.9, 8.8.8.8"), "guidance:ip:8.8.8.8");
  // Non-IP rightmost → no fan-out, collapses to the shared anon bucket.
  assert.equal(mk("1.2.3.4, garbage"), "guidance:ip:anon");
});

test("checkRateLimit: hard-caps the bucket map under an in-window key burst", () => {
  const store = new Map();
  const now = 5_000_000;
  // More distinct keys than MAX_BUCKETS within ONE window (nothing expired yet)
  // — expiry-only pruning would leak; the hard ceiling must hold.
  for (let i = 0; i < 10_050; i++) {
    checkRateLimit(`burst:${i}`, 5, 60_000, now, store);
  }
  assert.ok(store.size <= 10_000, `bucket map stays capped (size ${store.size})`);
});

test("isRateLimitEnabled: on by default, off only when RATE_LIMIT_DISABLED=1", () => {
  assert.equal(isRateLimitEnabled({}), true);
  assert.equal(isRateLimitEnabled({ RATE_LIMIT_DISABLED: "1" }), false);
});

test("enforceRateLimit: null under the cap, then a 429 carrying the disclaimer", async () => {
  // Unique scope so this exercises a fresh bucket in the module-global store.
  const req = new Request("http://x", { headers: { "x-forwarded-for": "7.7.7.7" } });
  const scope = "test_enforce_facade";
  assert.equal(enforceRateLimit(req, scope, 2, "DISC"), null, "1st call proceeds");
  assert.equal(enforceRateLimit(req, scope, 2, "DISC"), null, "2nd call proceeds");

  const blocked = enforceRateLimit(req, scope, 2, "DISC");
  assert.ok(blocked, "3rd call blocked");
  assert.equal(blocked!.status, 429);
  assert.equal(blocked!.headers.get("Retry-After") !== null, true);
  const body = (await blocked!.json()) as { error: string; disclaimer: string };
  assert.equal(body.error, "rate_limited");
  assert.equal(body.disclaimer, "DISC", "the caller-supplied disclaimer is on the 429");
});

test("enforceRateLimit: short-circuits to null when RATE_LIMIT_DISABLED=1", () => {
  const prev = process.env.RATE_LIMIT_DISABLED;
  process.env.RATE_LIMIT_DISABLED = "1";
  try {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "7.7.7.8" } });
    // Even past the cap, a disabled limiter never blocks.
    for (let i = 0; i < 5; i++) {
      assert.equal(enforceRateLimit(req, "test_disabled_scope", 1, "DISC"), null);
    }
  } finally {
    if (prev === undefined) delete process.env.RATE_LIMIT_DISABLED;
    else process.env.RATE_LIMIT_DISABLED = prev;
  }
});
