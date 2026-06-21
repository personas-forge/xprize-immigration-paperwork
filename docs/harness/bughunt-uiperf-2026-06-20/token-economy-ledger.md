> Total: 5 | Critical: 0 | High: 2 | Medium: 2 | Low: 1
> Context: Token Economy & Ledger
> Lens mix: bug-hunter 5, ui-perfectionist 0

Scope note: I simulated two concurrent paid operations on one account with a balance equal to exactly one op's cost, on BOTH drivers.
- PGlite `charge` (pglite-store.ts:289) holds `SELECT ... balance ... FOR UPDATE` inside `pg.transaction`, on a single-connection WASM Postgres, behind a `balance integer not null` column with `constraint balance_non_negative check (balance >= 0)` (line 51). Concurrent charges serialize; the second sees the decremented balance and returns `{ok:false}`. No lost update, no overspend. CORRECT.
- Firestore `charge` (firestore-store.ts:148) uses `runTransaction` read-then-write, which gives optimistic concurrency (contention → automatic re-run). Two concurrent charges cannot both commit off the same snapshot. No double-spend. CORRECT.
- Reclaim idempotency is double-protected: `operation.ts` tracks a `reclaimed` flag (line 294) AND the ledger dedupes by the per-user ref `reclaim:${user.id}:${requestId}` (guard.ts:60) via the `(ref, reason)` unique index / deterministic doc id. No double-reclaim. CORRECT.
- Dev grant route auth is well-guarded (404 unless non-prod AND no Firestore project AND `TOKENS_BYPASS=1`). CORRECT.

The race/overspend surface is clean. The remaining findings are driver-divergence, missing input validation at the ledger boundary, and observability — all real, none a same-account lost-update.

## 1. Firestore balance has no integer/non-negative backstop — a single non-numeric write poisons the account into unbounded free spend
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: data-integrity / driver-divergence / silent overspend
- **File**: src/lib/db/firestore-store.ts:148-172 (charge), :153 / :188 / :216 (`Number(snap.get("balance") ?? 0)`)
- **Scenario**: The prod driver reads `balance` as `Number(snap.get("balance") ?? 0)`. If the `balance` field is ever non-numeric (a bad merge, a manual console edit, an out-of-band writer, or a prior NaN write), `Number("…")` → `NaN`. In `charge`, `if (balance < cost)` is `NaN < cost` → `false`, so the debit SUCCEEDS, computes `next = NaN - cost = NaN`, and writes `balance: NaN` back. Every subsequent charge then also sees `NaN < cost === false` and free-passes forever. The account silently bills nothing and never blocks.
- **Root cause**: The PGlite store enforces two hard backstops the Firestore store lacks: the column is `integer` (rejects non-ints) AND `check (balance >= 0)` (rejects ever going negative). Firestore is schemaless and the code never validates that the read balance is a finite number, nor that `next >= 0`. The header comment claims the drivers "mirror semantics exactly" — they don't on the floor/type invariant.
- **Impact**: One corrupt balance value → that user gets unlimited free xl drafts (12 tokens each) indefinitely, with no error and no negative-balance signal. Also defeats the overspend guard: a `NaN` balance can never be "insufficient".
- **Fix sketch**: In Firestore `charge`/`credit`/`grantSignupTokens`, coerce-and-validate: `const balance = toFiniteInt(snap.get("balance"))` where `toFiniteInt` returns `Number.isFinite(n) && Number.isInteger(n) ? n : 0` (or throws a loud reconciliation error). Clamp `next = Math.max(0, balance - cost)` and refuse `if (!Number.isFinite(next) || next < 0)`. Mirror PGlite's `>= 0` invariant in code since Firestore can't express the CHECK constraint.

## 2. `charge` / `credit` / `reclaim` accept unvalidated cost/amount — a negative or huge value at the ledger boundary inverts or overflows the debit
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: input-validation / money-kernel
- **File**: src/lib/tokens/ledger.ts:19-50; src/lib/db/firestore-store.ts:148-206; src/lib/db/pglite-store.ts:289-346
- **Scenario**: `costOf` is safe (always returns a TIER_COST of 1/3/5/12), but the ledger primitives themselves take an arbitrary numeric `cost`/`amount` and never validate sign, finiteness, or magnitude. Any present-or-future caller that passes a computed value (e.g. a refund path, a metered-by-usage op, a webhook that trusts a Polar quantity, the dev route's `amount`) can pass a negative or `NaN`. A NEGATIVE `cost` to `charge` computes `next = balance - (-X) = balance + X` → a debit call silently CREDITS tokens. On Firestore there's no CHECK to stop it; on PGlite the CHECK only blocks going below zero, not an unwanted increase. A huge `amount` to `credit` overflows past Postgres `integer` (>2^31) and throws mid-transaction (or wraps on the Firestore Number path).
- **Root cause**: The "money kernel" trusts its callers. The type is just `number`; there's no `assertChargeable(n)` choke point asserting `Number.isInteger(n) && n >= 0 && n <= MAX_OP_COST`. The dev route clamps to `[1, 1_000_000]` (route.ts:24) but that guard lives only at that one call site, not in `credit` itself.
- **Impact**: A single mis-signed argument anywhere in the (growing) set of ledger callers mints tokens or corrupts a balance. This is the highest-leverage invariant in the system and it's unenforced at the boundary that all six metered ops + purchases + refunds funnel through.
- **Fix sketch**: Add a boundary guard in `ledger.ts` (and/or the store impls): `charge` asserts `cost` is a finite non-negative integer ≤ a sane cap (e.g. `TIER_COST.xl`); `credit`/`reclaim` assert `amount` finite, integer, within `[1, MAX_GRANT]`. Reject (throw / `{ok:false}`) rather than write. Keep the clamp in the dev route too, but make the ledger self-defending.

## 3. Firestore debit ledger rows are written with a non-deterministic auto-id and no requestId idempotency — a retry above the store can double-debit, and debits can't be reconciled by request
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: idempotency / reconciliation
- **File**: src/lib/db/firestore-store.ts:161 (`fs.collection(col("token_ledger")).doc()`); src/lib/db/pglite-store.ts:307-311
- **Scenario**: Every OTHER ledger write keys on a deterministic id for idempotency — credit uses `${reason}_${ref}` (line 179), grant uses `signup_${userId}` (line 211), and PGlite has the `token_ledger_ref_once (ref, reason)` unique partial index. But `charge` writes its debit row with an auto-id `.doc()` and the account update is NOT guarded by `requestId`. The guard passes a `requestId` into `charge` as `ref`, but nothing dedupes a debit by it. If anything above the store retries `chargeForOperation` for the same logical request (a route-level retry, an at-least-once invocation, a client double-submit that re-enters before the first completes), the user is debited twice for one operation. Firestore's own transaction retry is safe (re-runs the whole fn), but an APPLICATION-level retry is not.
- **Root cause**: The charge path is the only ledger mutation without a deterministic, idempotent key, despite already carrying a unique `requestId` (`ref`). The asymmetry is undocumented.
- **Impact**: Over-charging on retry/double-submit (each double-charge of `draft` is 12 tokens ≈ 12¢ of real value, plus user trust). Also: debit rows can't be deduped or looked up by request during reconciliation/disputes, unlike credits.
- **Fix sketch**: Key the debit ledger doc deterministically on the request: `ledgerCol.doc("debit_" + ref)` (Firestore) and add a `token_ledger_debit_once on token_ledger(ref) where reason='debit'` unique index (PGlite); inside the transaction, if that doc/row already exists, return the current balance without re-debiting. This makes `charge` idempotent-by-requestId like the rest of the kernel.

## 4. Dev grant route: `Number(amount) || 1000` treats `0` and other falsy inputs as "default 1000", and trusts a client-supplied amount up to 1M with a thin audit trail
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: edge-case / amount-handling
- **File**: src/app/api/dev/grant-tokens/route.ts:24-27
- **Scenario**: `const n = Math.max(1, Math.min(1_000_000, Number(amount) || 1000))`. Because `0`, `""`, `NaN`, `false`, and `null` are all falsy, `Number(0) || 1000` → `1000`. A caller requesting a grant of `0` (a legitimate "no-op / probe") silently receives 1000 tokens. Worse for fuzzing: `Number("0")` → `0` → `1000`. The clamp also accepts any value up to 1,000,000 from an unauthenticated-shaped JSON body (auth is checked, but the amount is fully client-controlled). The ledger entry is `reason:"adjustment"` with ref `dev:${Date.now()}:${user.id}` and `{dev:true}` — minimal provenance for a potentially 1M-token mint.
- **Root cause**: `|| 1000` conflates "absent" with "falsy-but-present (0)". Should be a presence/`Number.isFinite` check, not truthiness.
- **Impact**: Confusing/incorrect grants in dev and any preview where the route is live (non-prod + `TOKENS_BYPASS=1` + no Firestore). Low blast radius because it's gated off prod, but it's the one place that mints tokens by request value and its amount parsing is sloppy. (The auth GATE itself is correct — see scope note.)
- **Fix sketch**: `const raw = Number(amount); const n = Number.isFinite(raw) ? Math.max(1, Math.min(1_000_000, Math.trunc(raw))) : 1000;` so an explicit `0` clamps to 1 (or is rejected) instead of defaulting to 1000. Record the requested-vs-granted amount in metadata for audit.

## 5. Balance/store read failures are silently swallowed as `0` / free-pass — no observability when metering is unexpectedly off
- **Severity**: Low
- **Lens**: bug-hunter
- **Category**: observability / silent-degradation
- **File**: src/lib/tokens/ledger.ts:13-16 (`getBalance` → `store ? … : 0`); src/lib/tokens/guard.ts:43-44 (`!canMeter || !canIdentify → FREE_PASS`); src/lib/db/store.ts:282-305 (`getStore()` returns null / clears cache on init failure)
- **Scenario**: If the store import/init transiently fails, `getStore()` resolves `null` and clears its cache (store.ts:302), so `charge` free-passes (`return { ok: true, balance: +Infinity }`, ledger.ts:26) and `getBalance` returns `0`. In a misconfigured/degraded prod (Firestore admin init flaps, env briefly missing), the paywall silently opens for everyone and the dashboard shows balance `0` — with no warning log distinguishing "legitimately keyless" from "metering broke." `costOf` warns on an unknown op, but the far higher-stakes "store unavailable → everything is free" path is silent.
- **Root cause**: The free-pass is intentional for keyless/dev (correct), but the code can't tell a deliberate keyless build from a runtime store failure, and emits no signal for the latter.
- **Impact**: Revenue leak / overspend goes unnoticed until someone audits the ledger. Pure backend, but it's the difference between catching a metering outage in minutes vs. never.
- **Fix sketch**: When `isStoreConfigured()` is true (prod expects a store) but `getStore()` resolves null, `console.error`/emit a telemetry counter ("metering_unavailable") instead of silently free-passing; consider fail-CLOSED (return `{ok:false, reason:"unauthenticated"}` or a 503) on a prod build rather than granting unmetered access. Keep the silent free-pass only on the genuinely-keyless path.
