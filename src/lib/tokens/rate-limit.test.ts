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
  assert.equal(await enforceRateLimit(req, scope, 2, "DISC"), null, "1st call proceeds");
  assert.equal(await enforceRateLimit(req, scope, 2, "DISC"), null, "2nd call proceeds");

  const blocked = await enforceRateLimit(req, scope, 2, "DISC");
  assert.ok(blocked, "3rd call blocked");
  assert.equal(blocked!.status, 429);
  assert.equal(blocked!.headers.get("Retry-After") !== null, true);
  const body = (await blocked!.json()) as { error: string; disclaimer: string };
  assert.equal(body.error, "rate_limited");
  assert.equal(body.disclaimer, "DISC", "the caller-supplied disclaimer is on the 429");
});

test("enforceRateLimit: short-circuits to null when RATE_LIMIT_DISABLED=1", async () => {
  const prev = process.env.RATE_LIMIT_DISABLED;
  process.env.RATE_LIMIT_DISABLED = "1";
  try {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "7.7.7.8" } });
    // Even past the cap, a disabled limiter never blocks.
    for (let i = 0; i < 5; i++) {
      assert.equal(await enforceRateLimit(req, "test_disabled_scope", 1, "DISC"), null);
    }
  } finally {
    if (prev === undefined) delete process.env.RATE_LIMIT_DISABLED;
    else process.env.RATE_LIMIT_DISABLED = prev;
  }
});

// — Shared (multi-instance) checker ——————————————————————————————————————————

import { checkRateLimitShared, type SharedRateLimitStore } from "./rate-limit";

/** Hand-rolled shared counter — deterministic stand-in for the Store method. */
function fakeShared(): SharedRateLimitStore & { keys: string[] } {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    async rateLimitHit(key, resetAt) {
      const k = `${key}@${resetAt}`;
      keys.push(k);
      const next = (counts.get(k) ?? 0) + 1;
      counts.set(k, next);
      return next;
    },
  };
}

test("shared checker: counts against the shared store and refuses past the limit", async () => {
  const shared = fakeShared();
  for (let i = 0; i < 2; i++) {
    const r = await checkRateLimitShared("k", 2, 1000, 100, shared);
    assert.equal(r.ok, true, `hit ${i + 1} allowed`);
  }
  const blocked = await checkRateLimitShared("k", 2, 1000, 100, shared);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec >= 1, "Retry-After derives from the window boundary");
});

test("shared checker: window boundary is epoch-aligned, so all instances agree", async () => {
  const shared = fakeShared();
  // now=100 and now=900 fall in the same [0,1000) window → same counter key;
  // now=1100 starts the next window → fresh counter.
  await checkRateLimitShared("k", 5, 1000, 100, shared);
  await checkRateLimitShared("k", 5, 1000, 900, shared);
  await checkRateLimitShared("k", 5, 1000, 1100, shared);
  assert.deepEqual(shared.keys, ["k@1000", "k@1000", "k@2000"]);
});

test("shared checker: FAILS OPEN to the in-memory window when the store throws", async () => {
  const broken: SharedRateLimitStore = {
    rateLimitHit: async () => {
      throw new Error("counter outage");
    },
  };
  // The limiter protects model cost; refusing paid traffic on a counter
  // hiccup would be the worse failure. The in-memory floor still applies.
  const r = await checkRateLimitShared(`fail-open-${Date.now()}`, 3, 1000, Date.now(), broken);
  assert.equal(r.ok, true);
});

test("shared checker: null shared store = the plain in-memory behavior", async () => {
  const key = `mem-${Date.now()}`;
  assert.equal((await checkRateLimitShared(key, 1, 1000, 0, null)).ok, true);
  assert.equal((await checkRateLimitShared(key, 1, 1000, 1, null)).ok, false);
});
