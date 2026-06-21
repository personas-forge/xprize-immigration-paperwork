# AI Operation Orchestrator — Feature Scout + Ambiguity Guardian

> Context #16 · Group: AI Infrastructure & Evaluation
> Total: 5 findings

## 1. No request idempotency key — a client retry double-charges and re-runs the model
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/lib/ai/operation.ts:280-281`
- **Observation**: Every call mints a brand-new request id with `d.newRequestId()` (`requestId = d.newRequestId()`), and that id is the only ledger ref for both the charge (`charge(user.id, cost, operation, requestId)` in `src/lib/tokens/guard.ts:50`) and the reclaim (`reclaim:${user.id}:${requestId}`, guard.ts:60). The ledger's `charge`/`credit` are idempotent *by ref* (`src/lib/tokens/ledger.ts:61-97`), but because the ref is generated server-side per call, a client that retries a dropped/timed-out request (or a double-clicked "Draft" button on the expensive `draft`/`rfe` long-tier ops) gets a fresh ref every time — so each retry is a *distinct* debit AND a *distinct* real Gemini call. There is no way for the caller to say "this is the same logical request."
- **Proposal**: Accept an optional client `Idempotency-Key` header (or `idempotencyKey` body field), validate it, and feed it into the request id so charge/reclaim dedupe across retries; when the same key arrives a second time, short-circuit to the prior outcome (or at minimum reuse the same ledger ref so the second charge no-ops). The ledger already supports ref-based idempotency — only the orchestrator's per-call id generation defeats it.
- **Value / Risk-if-ignored**: Without it, transient network failures on the two most expensive ops translate directly into double-billed users and duplicated model spend — a real money-and-margin leak and a support-ticket generator, precisely on the paid paths.
- **Effort**: M

## 2. `adjudicate`-skip-on-mock vs. `persist`-always: a saved doc may carry the source label but no risk assessment, with no recorded contract
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/lib/ai/operation.ts:393-419`
- **Observation**: Persistence (step 6) runs for **every** non-error outcome including `source === "mock"` — the qualify/rfe/categorize specs persist mock output to the case/vault (e.g. `src/app/api/qualify/route.ts:86-103` creates a real case from `mockQualification`). But adjudication (step 8) is deliberately *skipped* when `source === "mock"` (operation.ts:413, "a deterministic template's risk score would be constant theater"). The orchestrator therefore can persist attorney-facing work product (a stored draft/RFE/qualification) that was never adjudication-screened, while the *same* output served from a real engine *was*. The skip reasoning is documented; the interaction with always-on persist — "is an unadjudicated mock allowed to be saved and later signed?" — is not, and nothing flags the persisted record as un-screened.
- **Proposal**: Record the decision explicitly: either (a) tag persisted mock records with `adjudicated: false` / `source: "mock"` so downstream "attorney ready" UI can refuse to treat them as screened, or (b) state in the ADR/spec comment why an unadjudicated mock is acceptable to persist. The money/legal-outcome risk is a mock document silently entering the signable pipeline without the fabricated-specifics/UPL scan its engine-generated twin gets.
- **Value / Risk-if-ignored**: An attorney could sign/file a persisted mock that bypassed the very gate (`runAdjudication`) built to catch fabricated specifics and leaked case law — a legal-correctness hole hiding behind two individually-reasonable invariants.
- **Effort**: S

## 3. Surface per-operation cost/balance telemetry to the user on success, not only on the 402 wall
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: user_benefit
- **File**: `src/lib/ai/operation.ts:288-296, 421-425`
- **Observation**: The charge result carries `cost` and `balance` (`charged.cost`, `charged.balance`), but the orchestrator only ever shows them on the **402 insufficient-tokens** path (operation.ts:291-292). On a *successful* generation the response body is `{ ...responseBody, ...persisted, ...adjudication }` — the user is charged but never told what this op cost or what balance remains. The data is already in hand at line 281; it is simply dropped on the happy path. Mock/keyless responses (cost 0) are indistinguishable in the body from a billed one.
- **Proposal**: Merge a small `usage: { cost, balanceAfter, charged: source !== "mock" }` block into the success body (or an `X-Token-Cost`/`X-Token-Balance` header). This gives the UI a live running balance and a clear "this was free (mock)" signal without a separate balance fetch.
- **Value / Risk-if-ignored**: A metered product that hides per-action cost erodes trust and drives "why did my balance drop?" tickets; cheap to add since the values already flow through the charge result. Without it the client must round-trip a separate balance endpoint to reflect spend.
- **Effort**: S

## 4. `runWithBilling` fail-open silently re-runs `generate()` — undocumented duplicate-model-call assumption
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: trade-off
- **File**: `src/lib/ai/operation.ts:334-348`
- **Observation**: When the billing wrapper throws, the catch fails open and re-issues `raw = await llm.generate(text, options)` *ungauged* (operation.ts:347). The safety of this rests entirely on an inline assumption — "the real `runWithBilling` only `.run()`s an ALS context, so a throw is at setup, before `generate()` runs — no double model call" (operation.ts:344-345). That invariant lives only in a comment in *this* file; it is not enforced or asserted at the `runWithBilling` definition (`src/lib/cost-telemetry`). If a future refactor moves any awaited work (or the model call itself) inside the billing wrapper's try, a wrapper failure *after* a successful generation would trigger a **second** paid Gemini call — billed once but charged once, with double real model cost and no telemetry on the retry.
- **Proposal**: Make the assumption load-bearing where it can break: either guard so the retry only fires when the wrapper provably failed *before* invoking the inner fn (e.g. a sentinel/`started` flag set inside `fn` before `generate`), or add a contract comment + test at the `runWithBilling` definition asserting it must throw only during context setup. At minimum, log the retry so a duplicate-call regression is observable.
- **Value / Risk-if-ignored**: A cross-module invariant enforced only by a comment in the *consumer* is exactly the kind that rots — and here the failure mode is a silently doubled model bill on the happy path.
- **Effort**: M

## 5. Output caching for deterministic ops (qualify/categorize at temperature 0) — identical inputs re-pay and re-call the model
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: feature
- **File**: `src/lib/ai/operation.ts:299-378`
- **Observation**: The orchestrator always calls `llm.generate()` for any input that passes parse + charge — there is no cache layer. Yet `qualify` runs at `temperature: 0` (`src/app/api/qualify/route.ts:54-57`) and `categorize` uses strict JSON deterministic parsing — for these, identical input deterministically maps to identical output, so a re-submit (same profile, same document) re-charges the user and re-spends on Gemini for a byte-identical result. The pipeline already has clean seams (`spec.operation`, the validated `input`, the `guard`) where a content-addressed key could be derived.
- **Proposal**: Add an optional per-spec cache hook (e.g. `cacheKey?: (input) => string | null`) that, on a hit, returns the prior guarded output with `source: "cache"` and *skips the charge* — wired only for the deterministic ops, leaving free-form guidance/draft uncached. Persist/adjudicate semantics stay the same (a cache hit is engine-grade, not a mock).
- **Value / Risk-if-ignored**: Directly cuts model spend and user token burn on the deterministic, re-runnable screens; without it, the most idempotent ops are also the most wastefully re-billed. (Pairs naturally with finding #1's idempotency key as the cache key.)
- **Effort**: M
