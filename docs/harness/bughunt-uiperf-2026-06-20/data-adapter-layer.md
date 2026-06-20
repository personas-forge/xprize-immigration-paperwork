> Total: 5 | Critical: 0 | High: 2 | Medium: 2 | Low: 1
> Context: Data Adapter Layer
> Lens mix: bug-hunter 5, ui-perfectionist 0

Scope note: the `http.ts` file in this context is **AdapterError→HTTP response shaping** (status/body mapping), not an outbound HTTP client. There is no `fetch`/timeout/retry surface in the adapter layer to audit, so the "http adapter timeout/error-swallowing" lens collapses onto the Result-shaping correctness checks below. The `resolveCase` fail-closed gate (access.ts) was audited end-to-end against its callers and is correct — owner→ok, non-attorney→`forbidden` without ever calling `getCaseAnyOwner`, attorney-missing→`not_found`, throw→`store_error`, no-store→`unconfigured`. No fail-open path was found in the gate itself; the findings are about how adapter methods *downstream* of the gate translate store outcomes into `Result`.

## 1. `removeDocument` / `refileDocument` report `ok` for a no-op (wrong-case or missing document)
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: Result misuse — silent no-op reported as success
- **File**: src/lib/data/adapters/evidence.ts:118-151 (and data layer evidence.ts:51-69; stores pglite-store.ts:720-732, firestore-store.ts:552-567)
- **Scenario**: A caller owns case `c1` and passes `removeDocument({c1}, documentId)` where `documentId` actually belongs to case `c2` (another tenant), or does not exist at all. `resolveCase` passes (caller owns `c1`). The store delete is scoped `where id = $1 and case_id = $2`, so **zero rows are affected** — a correct cross-tenant defense — but `removeCaseDocument` returns `Promise<void>` with no affected-row count, so the adapter unconditionally returns `ok(undefined)`. `refileDocument` behaves identically (`update ... where id=$1 and case_id=$2`, no-op, `ok`).
- **Root cause**: The data-layer signature (`Promise<void>`) discards the store's "rows affected" signal. The adapter has no way to distinguish "removed/refiled" from "matched nothing", so both collapse into `ok`. The `Result` contract is meant to make error states explicit, but the *not_found* case for a mutation is structurally unrepresentable here.
- **Impact**: `src/features/evidence/actions.ts:40-42,59-60` then `revalidatePath()` and the UI renders a success for a delete/refile that changed nothing. A user (or attorney) who pastes a stale or wrong-case `documentId` is told the operation succeeded while the document remains untouched in its real case — a misleading audit trail on an immigration filing, and it masks client/UI bugs that send the wrong id.
- **Fix sketch**: Have `removeCaseDocument`/`refileCaseDocument` return the affected-row count (`pg` `result.affectedRows`; Firestore: the `snap.exists && case_id===caseId` boolean it already computes). In the adapter, map `0` to `err("not_found")` so the action surfaces "document not found" instead of a false success. At minimum, document that these are intentionally idempotent and stop revalidating on a no-op.

## 2. Same "no store" condition maps to two different error kinds across adapters (`store_error` vs `unconfigured`)
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: Result misuse — error kind mismatch (503 vs 500)
- **File**: src/lib/data/adapters/evidence.ts:97 vs src/lib/data/adapters/petition.ts:149,188
- **Scenario**: The store disappears (or was never configured) between the gate check and the write. `addCaseDocument` returns `null` **only** when `getStore()` is null (data evidence.ts:36-38). `evidence.addDocument` maps that `null` to `err("store_error")` → HTTP **500**. The exact same "store returned null because unconfigured" condition in `petition.saveDraft`/`saveRfeResponse` (`version === null`) is mapped to `err("unconfigured")` → HTTP **503**.
- **Root cause**: Two adapters interpret the identical sentinel (`null` from a "no-op when no store" data fn) with opposite intent. `petition.createCase` has the same ambiguity in reverse: `createCaseWithCriteria` returns `null` for *both* "no store" and "store configured but write produced nothing", and the comment claims it means a store fault — but an unconfigured store also yields `null` there, so a 503 condition is reported as a 500.
- **Impact**: A genuinely unconfigured/transient-down backend is reported to evidence clients as a 500 "internal error" (non-retryable signal, alarms ops) instead of the 503 "temporarily unavailable, try again" the project deliberately designed for anxious immigration users (see http.ts:29 message intent). Inconsistent observability and a worse, misleading client message on the evidence path.
- **Fix sketch**: Decide one contract for the `null`-from-data-fn sentinel. Cleanest: have the adapter check `storeConfigured()` first (as `createCase` and `saveDraft`'s null-path effectively want) and reserve `store_error` for an actual thrown exception; map a post-configured `null` write to `unconfigured` consistently in `addDocument` too.

## 3. `resolveCase` can downgrade an `unconfigured` store to `forbidden` on a mid-call store loss
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: TOCTOU / edge case — error kind downgrade
- **File**: src/lib/data/adapters/access.ts:58-71
- **Scenario**: `storeConfigured()` returns true at line 58. Before `getCaseForUser` runs (line 61), the store becomes unavailable in a way that returns `null` rather than throwing (e.g. a driver that yields no rows on a dropped connection). `getCaseForUser` → `null`, caller is not a configured attorney → the function returns `err("forbidden")` (line 71) for what is really a store-availability problem.
- **Root cause**: The gate trusts a single up-front `storeConfigured()` probe and then treats *any* `null` from `getCaseForUser` as "not the owner". A `null` that stems from store unavailability is indistinguishable from "this user doesn't own this case".
- **Impact**: A transient backend blip can present the legitimate owner with a 403 "You do not have access to this case" — alarming and wrong on an immigration platform, and it muddies forbidden-vs-outage telemetry. Low probability (most real failures throw → caught as `store_error`), hence Medium.
- **Fix sketch**: Accept this as the documented tradeoff (fail-closed is the right default for access), but note it explicitly; or, where the store can signal availability per-call, re-probe `storeConfigured()` before returning `forbidden` so an outage surfaces as `unconfigured`.

## 4. `addDocument`/`createCase` collapse two distinct outcomes into a bare `err("store_error")` with no `cause`
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: Error swallowing — lost diagnostic context
- **File**: src/lib/data/adapters/evidence.ts:97; src/lib/data/adapters/petition.ts:116
- **Scenario**: `addCaseDocument`/`createCaseWithCriteria` resolve to `null` (not a throw). The adapter returns `err("store_error")` with **no `cause`**. Per result.ts:53-54, `err("store_error")` still fires `console.error("[adapter] store_error", undefined)` — a store_error is logged with `undefined` context every time a write legitimately returns null.
- **Root cause**: `null` from these data fns is a non-exceptional sentinel, but it's funneled through the `store_error` constructor whose entire purpose (per result.ts JSDoc) is to log a *thrown* exception's `cause`. A null-write and a real Firestore/pg throw become indistinguishable in logs, and the null case logs a useless `undefined`.
- **Impact**: Operators chasing "[adapter] store_error" alerts can't tell a benign null-write from a real backend exception; noise that erodes the value of the single-seam logging the layer was built around.
- **Fix sketch**: Either attach a descriptive sentinel cause (`err("store_error", new Error("createCaseWithCriteria returned null"))`) or, per finding #2, route the configured-store null path to `unconfigured` so it doesn't log as a store fault at all.

## 5. `EvidenceAdapter.gate()` returns `AdapterResult<unknown>`, weakening the error-return type guarantee
- **Severity**: Low
- **Lens**: bug-hunter
- **Category**: Type polish — Result generic widened
- **File**: src/lib/data/adapters/evidence.ts:72-78
- **Scenario**: `gate()` is typed `Promise<AdapterResult<unknown>>`. Each method does `const gate = await this.gate(...); if (!gate.ok) return gate;`. On the error branch this is sound (the union's error arm carries no `T`), and TypeScript accepts returning `AdapterResult<unknown>`'s error arm as `AdapterResult<StoredDocument>` because `gate.ok` is `false`. But the widened `unknown` means a future refactor that forgets the `if (!gate.ok)` narrowing would silently compile, returning an `unknown`-valued ok.
- **Root cause**: `gate()` discards the `StoredCase` value type that `resolveCase` actually produces; the petition adapter avoids this by reusing its strongly-typed `resolveCase` wrapper directly.
- **Impact**: No live bug — purely a type-safety guardrail loosened on the access seam. Worth tightening because this layer's whole thesis is "make the gate impossible to forget/misuse."
- **Fix sketch**: Type `gate()` as `Promise<AdapterResult<StoredCase>>` (its real return) so any accidental success-path use is caught by the compiler, matching `PetitionAdapter.resolveCase`'s stronger signature.
