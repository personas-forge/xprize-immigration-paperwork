/**
 * Integration tests for the PGlite Store driver — the REAL embedded Postgres,
 * not a mock. The money-kernel guarantees pinned here (atomic debit, per-ref
 * idempotency, the one-shot signup grant, the balance/ledger agreement) live in
 * SQL — the `for update` row lock, the in-transaction seen-checks, the partial
 * unique indexes — which a mocked store cannot falsify. If a refactor
 * "optimizes" the lock away or moves a seen-check outside its transaction,
 * these tests are the tripwire (see the DEBIT IDEMPOTENCY CONTRACT comment in
 * pglite-store.ts).
 *
 * Harness: PGLITE_PATH is pointed at a FRESH temp dir BEFORE the store module
 * is imported — the PGlite handle opens lazily at pglitePath() and is pinned on
 * globalThis (`__immigrationPglitePromise`), so importing first could bind a
 * developer's ./.pglite and write test rows into their local data. The whole
 * file then shares that ONE embedded Postgres (one per process, by design);
 * isolation between test cases comes from unique per-test user ids, not
 * separate databases. The temp dir is left for the OS to reap: PGlite keeps
 * its files open for the life of the process, so an rm in teardown would fail
 * on Windows.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PGLITE_PATH = mkdtempSync(join(tmpdir(), "immigration-pglite-store-"));

const { getPgliteStore } = await import("./pglite-store");
const store = await getPgliteStore();

/** Unique per-test user ids: every test gets its own token account inside the
 *  shared PGlite, so tests stay independent whatever order they run in. */
let seq = 0;
const uid = (label: string): string => `pglite-test-${label}-${seq++}`;

test("charge(): debits exactly once and the ledger row carries the running balance", async () => {
  const u = uid("debit");
  await store.credit(u, 100, "purchase", `fund-${u}`, {});
  const out = await store.charge(u, 30, "draft", `req-${u}`);
  assert.deepEqual(out, { ok: true, balance: 70 });
  assert.equal(await store.getBalance(u), 70);
  // balance_after is the audit trail's running balance — if it drifts from the
  // account row, refund/support tooling reconstructs the wrong history.
  const [debit] = await store.getLedgerForUser(u, 1);
  assert.equal(debit.delta, -30);
  assert.equal(debit.reason, "debit");
  assert.equal(debit.operation, "draft");
  assert.equal(debit.balanceAfter, 70);
});

test("charge(): exact-balance boundary — balance == cost succeeds, one token short refuses", async () => {
  // balance == cost MUST succeed: a user who bought exactly one operation's
  // worth of tokens can spend it (an off-by-one here strands paid credit).
  const rich = uid("boundary-eq");
  await store.credit(rich, 50, "purchase", `fund-${rich}`, {});
  assert.deepEqual(await store.charge(rich, 50, "draft", `req-${rich}`), {
    ok: true,
    balance: 0,
  });

  // balance == cost - 1 MUST refuse — and refuse without writing: no debit row,
  // balance untouched, and the refusal reports the CURRENT balance so the
  // paywall can show a truthful "you have N" message.
  const poor = uid("boundary-lt");
  await store.credit(poor, 49, "purchase", `fund-${poor}`, {});
  assert.deepEqual(await store.charge(poor, 50, "draft", `req-${poor}`), {
    ok: false,
    balance: 49,
  });
  assert.equal(await store.getBalance(poor), 49);
  const reasons = (await store.getLedgerForUser(poor, 10)).map((e) => e.reason);
  assert.deepEqual(reasons, ["purchase"]); // the refusal left no ledger trace
});

test("charge(): a replay with the same ref debits at most once", async () => {
  // `ref` is the per-request idempotency key: an app-level retry of the SAME
  // logical charge (timeout, double-submitted form) must not debit twice. The
  // replay still reports ok — the charge DID happen — at the current balance.
  const u = uid("replay");
  await store.credit(u, 100, "purchase", `fund-${u}`, {});
  const ref = `req-${u}`;
  assert.deepEqual(await store.charge(u, 40, "draft", ref), { ok: true, balance: 60 });
  assert.deepEqual(await store.charge(u, 40, "draft", ref), { ok: true, balance: 60 });
  assert.equal(await store.getBalance(u), 60);
  const debits = (await store.getLedgerForUser(u, 10)).filter((e) => e.reason === "debit");
  assert.equal(debits.length, 1);
});

test("credit(): idempotent by (reason, ref) — a replay does not double-credit", async () => {
  // Webhook redelivery (Polar retries on non-2xx) replays the same order ref:
  // the balance must not double-mint.
  const u = uid("credit");
  const ref = `order-${u}`;
  assert.equal(await store.credit(u, 100, "purchase", ref, {}), 100);
  assert.equal(await store.credit(u, 100, "purchase", ref, {}), 100);
  assert.equal(await store.getBalance(u), 100);
  // The same ref under a DIFFERENT reason still applies: a debit and its later
  // reclaim share the request id ON PURPOSE — the (ref, reason) uniqueness keys
  // on both columns (see the token_ledger_ref_once comment in the DDL).
  assert.equal(await store.credit(u, 10, "reclaim", ref, {}), 110);
});

test("credit(): a negative credit (refund clawback) floors the balance at 0", async () => {
  // Clawing back a refund from an already-spent balance would violate the
  // `balance >= 0` column check and THROW, failing the whole refund; the floor
  // lets the refund succeed at 0 instead of leaving Polar and the ledger
  // disagreeing about whether it happened.
  const u = uid("clawback");
  await store.credit(u, 30, "purchase", `fund-${u}`, {});
  assert.equal(await store.credit(u, -500, "refund", `refund-${u}`, {}), 0);
  assert.equal(await store.getBalance(u), 0);
  const [entry] = await store.getLedgerForUser(u, 1);
  assert.equal(entry.delta, -500); // the ledger records the REQUESTED delta…
  assert.equal(entry.balanceAfter, 0); // …but the running balance is floored
});

test("grantSignupTokens(): mints exactly once per user", async () => {
  // The signup grant is farmable free credit — a re-login or retried
  // onboarding must not re-mint. Enforced by the in-transaction seen-check
  // with the token_ledger_signup_once partial unique index as backstop.
  const u = uid("grant");
  await store.grantSignupTokens(u, 500);
  await store.grantSignupTokens(u, 500);
  assert.equal(await store.getBalance(u), 500);
  const grants = (await store.getLedgerForUser(u, 10)).filter(
    (e) => e.reason === "signup_grant",
  );
  assert.equal(grants.length, 1);
});

test("getBalance() agrees with the ledger's final balance_after (unbroken chain)", async () => {
  const u = uid("chain");
  await store.grantSignupTokens(u, 500);
  await store.charge(u, 120, "draft", `req-${u}-a`);
  await store.credit(u, 300, "purchase", `order-${u}`, {});
  await store.charge(u, 50, "rfe", `req-${u}-b`);
  const ledger = await store.getLedgerForUser(u, 10); // newest first
  assert.equal(ledger.length, 4);
  // The account row and the audit trail must tell the same story: the balance
  // a user is shown IS the last line of their ledger.
  assert.equal(ledger[0].balanceAfter, 630);
  assert.equal(await store.getBalance(u), ledger[0].balanceAfter);
  // And every running balance is exactly the previous one plus its delta — a
  // skipped or double-applied entry breaks the chain right here.
  for (let i = 0; i < ledger.length - 1; i++) {
    assert.equal(ledger[i].balanceAfter - ledger[i].delta, ledger[i + 1].balanceAfter);
  }
});

test("charge(): two concurrent charges that only one can afford — exactly one wins", async () => {
  // DIFFERENT refs, so idempotency cannot save us: this is the pure race. The
  // `select … for update` row lock serialises the read-check-write per user
  // (PGlite additionally serialises transactions on its single connection, but
  // real Postgres would not) — without it both would read balance=10 and both
  // would "succeed", double-spending the account.
  const u = uid("race");
  await store.credit(u, 10, "purchase", `fund-${u}`, {});
  const outcomes = await Promise.all([
    store.charge(u, 10, "draft", `req-${u}-1`),
    store.charge(u, 10, "draft", `req-${u}-2`),
  ]);
  assert.equal(outcomes.filter((o) => o.ok).length, 1);
  assert.equal(await store.getBalance(u), 0);
  const debits = (await store.getLedgerForUser(u, 10)).filter((e) => e.reason === "debit");
  assert.equal(debits.length, 1);
});
