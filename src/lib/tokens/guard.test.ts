import assert from "node:assert/strict";
import { test } from "node:test";

import { chargeForOperation, type GuardDeps } from "./guard";
import { FREE_PASS_BALANCE } from "./ledger";
import { costOf } from "./registry";

// The charge-guard matrix — the paywall gate at the top of EVERY AI route.
// Environment-driven branches (metering switch, auth-provider detection) are
// exercised by mutating process.env around each case; identity + ledger are
// injected via GuardDeps (the session import is next/headers-bound). Firebase
// web config is captured at module load and is absent under the test runner,
// so `canIdentify` is controlled through the dev-auth flag.

const ENV_KEYS = ["TOKENS_BYPASS", "DB_DRIVER", "NODE_ENV", "NEXT_PUBLIC_DEV_AUTH"] as const;

function withEnv<T>(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => Promise<T>): Promise<T> {
  // Next's types mark NODE_ENV readonly; the runtime env object is plain and
  // mutable, and mutating it is exactly what this fixture is for.
  const mutable = process.env as Record<string, string | undefined>;
  const saved = ENV_KEYS.map((k) => [k, mutable[k]] as const);
  for (const k of ENV_KEYS) delete mutable[k];
  for (const [k, v] of Object.entries(env)) mutable[k] = v;
  return fn().finally(() => {
    for (const [k, v] of saved) {
      if (v === undefined) delete mutable[k];
      else mutable[k] = v;
    }
  });
}

const USER = { id: "user-1", email: "u@example.com" };

/** Deps whose ledger records every call; charge outcome is configurable. */
function fakeDeps(over: Partial<GuardDeps> = {}) {
  const calls = {
    resolveUser: 0,
    charge: [] as Array<{ userId: string; amount: number; operation: string; ref: string }>,
    reclaim: [] as Array<{ userId: string; amount: number; ref: string }>,
  };
  const deps: GuardDeps = {
    resolveUser: async () => {
      calls.resolveUser += 1;
      return USER;
    },
    charge: (async (userId: string, amount: number, operation: string, ref: string) => {
      calls.charge.push({ userId, amount, operation, ref });
      return { ok: true, balance: 100 - amount };
    }) as GuardDeps["charge"],
    reclaim: (async (userId: string, amount: number, ref: string) => {
      calls.reclaim.push({ userId, amount, ref });
      return amount;
    }) as GuardDeps["reclaim"],
    ...over,
  };
  return { deps, calls };
}

test("guard: TOKENS_BYPASS=1 outside prod → free pass, identity never resolved", async () => {
  await withEnv({ TOKENS_BYPASS: "1", DB_DRIVER: "pglite", NODE_ENV: "test" }, async () => {
    const { deps, calls } = fakeDeps();
    const res = await chargeForOperation("qualify", "req-1", deps);
    assert.ok(res.ok);
    assert.equal(res.cost, 0);
    assert.equal(res.balance, FREE_PASS_BALANCE);
    assert.equal(calls.resolveUser, 0, "a free pass must not touch the session");
    assert.equal(calls.charge.length, 0);
  });
});

test("guard: no store configured → free pass (keyless build)", async () => {
  await withEnv({}, async () => {
    const { deps, calls } = fakeDeps();
    const res = await chargeForOperation("qualify", "req-2", deps);
    assert.ok(res.ok && res.cost === 0);
    assert.equal(calls.charge.length, 0);
  });
});

test("guard: metering on but NO auth provider → free pass (cannot debit the unidentifiable)", async () => {
  // DB_DRIVER=pglite turns metering on without dev-auth; Firebase web config is
  // absent under the test runner, so no provider can identify the caller.
  await withEnv({ DB_DRIVER: "pglite" }, async () => {
    const { deps, calls } = fakeDeps();
    const res = await chargeForOperation("qualify", "req-3", deps);
    assert.ok(res.ok && res.cost === 0);
    assert.equal(calls.resolveUser, 0);
    assert.equal(calls.charge.length, 0);
  });
});

test("guard: metering on + provider + no session → 401 shape, nothing charged", async () => {
  await withEnv({ DB_DRIVER: "pglite", NEXT_PUBLIC_DEV_AUTH: "1", NODE_ENV: "test" }, async () => {
    const { deps, calls } = fakeDeps({ resolveUser: async () => null });
    const res = await chargeForOperation("qualify", "req-4", deps);
    assert.deepEqual(res, { ok: false, reason: "unauthenticated" });
    assert.equal(calls.charge.length, 0);
  });
});

test("guard: insufficient balance → refusal echoes the registry cost and the real balance", async () => {
  await withEnv({ DB_DRIVER: "pglite", NEXT_PUBLIC_DEV_AUTH: "1", NODE_ENV: "test" }, async () => {
    const { deps } = fakeDeps({
      charge: (async () => ({ ok: false, balance: 2 })) as GuardDeps["charge"],
    });
    const res = await chargeForOperation("draft", "req-5", deps);
    assert.equal(res.ok, false);
    if (!res.ok && res.reason === "insufficient") {
      assert.equal(res.cost, costOf("draft"));
      assert.equal(res.balance, 2);
    } else {
      assert.fail("expected the insufficient refusal");
    }
  });
});

test("guard: successful charge debits the registry cost once and wires a user-scoped reclaim", async () => {
  await withEnv({ DB_DRIVER: "pglite", NEXT_PUBLIC_DEV_AUTH: "1", NODE_ENV: "test" }, async () => {
    const { deps, calls } = fakeDeps();
    const res = await chargeForOperation("rfe", "req-6", deps);
    assert.ok(res.ok);
    assert.equal(res.cost, costOf("rfe"));
    assert.deepEqual(calls.charge, [
      { userId: USER.id, amount: costOf("rfe"), operation: "rfe", ref: "req-6" },
    ]);

    await res.reclaim();
    assert.deepEqual(calls.reclaim, [
      // The reclaim ref is scoped by user id so the GLOBAL (ref, reason) dedupe
      // can never fold one user's refund into another's.
      { userId: USER.id, amount: costOf("rfe"), ref: `reclaim:${USER.id}:req-6` },
    ]);
  });
});

// (The TOKENS_BYPASS prod hard-gate itself is pinned in economy.test.ts on
// isMeteringEnforced — the guard delegates to that single predicate, asserted
// by the free-pass cases above.)
