> Total: 5 | Critical: 0 | High: 3 | Medium: 2 | Low: 0
> Context: AI Operation Orchestrator
> Lens mix: bug-hunter 5, ui-perfectionist 0

This is a pure-backend orchestrator (`operation.ts` + `operation.test.ts`, no `.tsx`), so all five findings are bug-hunter, per the lens rule.

## 1. `spec.guard()` throwing after a billable model call refunds the charge and silently downgrades to mock
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: silent-failure
- **File**: src/lib/ai/operation.ts:311-326
- **Scenario**: An engine is configured. `llm.generate()` succeeds (real model cost incurred, e.g. a long EB-1A draft). Then `spec.guard(raw, input)` throws — e.g. `tryParseCategorizeResponse`/`tryParseDraftResponse` hits an input shape the parser didn't anticipate (a deeply nested object that trips a `.map` on a non-array, a thrown `JSON.parse` inside a non-`tryParse` helper, a RangeError on a huge string). The bare `catch {}` on line 321 treats this identically to a model throw: it reclaims the charge, returns `spec.mock(input)` stamped `source:"mock"`, and 200s.
- **Root cause**: The inner `try` (300-326) wraps BOTH the model call AND `spec.guard()`. The catch assumes any throw means "the model failed, so refund and mock." But a guard throw means the model already *succeeded and was paid for* — the provider billed the platform, yet the user is refunded and silently handed a deterministic template. The guard bug is also swallowed: no log, no telemetry, indistinguishable from a normal keyless mock in the response.
- **Impact**: Billing/margin leak (model cost paid, revenue reclaimed) + success theater — a parser regression presents as a normal mock forever, so the platform serves templated immigration content while believing the model answered. The known-structure note explicitly carves out "genuine billed-as-real silent fallback"; this is the inverse but equally a billing-integrity bug.
- **Fix sketch**: Narrow the try: run `spec.guard()` OUTSIDE the model `try/catch` (it operates on already-returned text, no reclaim semantics). A guard *throw* should be treated like `guard()===null` (reclaim+mock) only deliberately, and should emit telemetry distinguishing "guard threw" from "guard returned null" so the parser bug surfaces. At minimum, log the caught error before reclaiming so guard regressions aren't invisible.

## 2. `adjudicate` runs and attaches a real-looking risk report even on the mock/error path
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: edge-case
- **File**: src/lib/ai/operation.ts:362-369 (with build at 358)
- **Scenario**: Engine throws or returns unusable output → `output = spec.mock(input)`, `source = "mock"`. Execution still falls through to step 8. `spec.adjudicate(output, input, "mock", responseBody)` runs against the *mock* output and attaches `{ adjudication }` to the body. The client (e.g. the draft UI) renders a live "adjudication-risk score" computed over deterministic template text, not the petition the user thinks was generated.
- **Root cause**: The adjudication gate (moonshot #1) is documented as scoring "the just-built response against adjudicator-shaped invariants," implying a real model artifact. Nothing gates it on `source !== "mock"`. A mock is a fixed template, so its adjudication score is a constant theater number that looks like a real risk assessment of the user's case.
- **Impact**: Wrong output / misleading UX on a compliance-sensitive surface — an immigration self-petitioner could read a falsely reassuring (or alarming) "risk score" derived from boilerplate. For a UPL-sensitive product this is a credibility/correctness hazard, not cosmetic.
- **Fix sketch**: Guard the adjudication block with `if (spec.adjudicate && source !== "mock")`, OR pass `source` through and have specs short-circuit to `null` for mock. Mirror the existing honesty invariant ("a mock is never billed as model output") by ensuring a mock is never adjudicated as model output.

## 3. `cachedDefaults` is memoized forever, including `runWithBilling` and the LLM client — env/provider changes are pinned to first call
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: state-corruption
- **File**: src/lib/ai/operation.ts:178-203 (cachedDefaults), 288 (getLlm via cached deps)
- **Scenario**: `defaultDeps()` caches the entire deps bundle on first call, including `getLlm` *bound through the cached object* and `charge`. In a long-lived Node server (`runtime = "nodejs"`, `force-dynamic`), if an operator hot-rotates a key or the LLM client is designed to re-read `process.env` per `getLlm()` call, that still works (getLlm is re-invoked per request) — BUT the cached `runWithBilling` and `charge` *function references* are frozen at the value resolved during the first dynamic import. If `@/lib/cost-telemetry` or the guard module is ever re-imported with different state, the orchestrator keeps the stale closure. More concretely: a first request that loses the import race could cache a partially-initialized module.
- **Root cause**: Module-level mutable cache (`let cachedDefaults`) with no invalidation, populated by a `Promise.all` of dynamic imports. The cache exists only to avoid re-importing; it conflates "import once" (safe) with "snapshot the wired config once" (assumes config is immutable for process lifetime).
- **Impact**: Maintenance/operability — config changes (telemetry toggles, provider swaps) silently don't take effect until restart; hard to diagnose because the unit suite never exercises `defaultDeps()`. Low blast radius in current deployment but a latent surprise.
- **Fix sketch**: Cache only the import *modules*, not a derived deps object, OR document explicitly that deps are process-lifetime-immutable by design and gate config reads (telemetry url/key) inside the wrapped functions (which `cost-telemetry.config()` already does — so the real fix is just a comment clarifying the contract and confirming `getLlm` re-reads env per call).

## 4. `runWithBilling` wraps only `generate()`, but `guard` parse cost and a throwing billing wrapper aren't covered / can mask the model call
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: silent-failure
- **File**: src/lib/ai/operation.ts:305-310
- **Scenario**: `const billing = d.runWithBilling ?? passthrough; await billing({customerId, feature}, () => llm.generate(...))`. If a *custom* `runWithBilling` (or the real `@/lib/cost-telemetry` one under an AsyncLocalStorage edge) throws synchronously or rejects for a reason unrelated to the model (e.g. telemetry context setup failure), that rejection is caught by the inner `catch` at 321 and treated as a model failure → reclaim + mock. A telemetry/billing-context fault thus suppresses an otherwise-working model call.
- **Root cause**: The billing wrapper is inside the model `try`, so its failure is indistinguishable from a model failure. Telemetry is meant to be a no-op-safe side concern ("No-op telemetry-side when unconfigured"), but a throwing wrapper degrades the actual product path.
- **Impact**: A misconfigured/overloaded telemetry sink could silently force every paid generation down to mock output (and reclaim), turning an observability problem into a product outage that looks like "the model is always unavailable."
- **Fix sketch**: Make the billing wrap fail-open: `try { raw = await billing(...) } catch (e) { /* telemetry context failed */ raw = await llm.generate(text, options) }` — OR keep the real `runWithBilling` strictly non-throwing (it already only `.run()`s an ALS context, so confirm and document that contract; reject custom wrappers that can throw). The default passthrough is fine; the risk is the injected/real one.

## 5. Reclaim failure on the unusable-output and guard paths is unguarded (only the outer mock-failed catch guards reclaim)
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: recovery-gap
- **File**: src/lib/ai/operation.ts:312-322 vs 333-339
- **Scenario**: Model returns unusable output → `guarded === null` → line 314 `await charged.reclaim()` is awaited *without a try/catch*. If `reclaim()` itself rejects (ledger transient fault, network blip to Firestore), the rejection propagates up to the OUTER catch (328), which then tries to reclaim AGAIN — but `reclaimed` is already `true` (set on line 313 before the failed reclaim), so the outer `if (!reclaimed)` skips the retry, and the route returns a 500 `generation_failed`. The user is charged (reclaim never succeeded) AND gets a 500 instead of the mock they'd otherwise receive.
- **Root cause**: `reclaimed = true` is set *before* `await charged.reclaim()` (line 313 precedes 314). The flag means "we attempted reclaim," not "reclaim succeeded." A reclaim throw on the guard-null path therefore both (a) leaves the charge debited and (b) escalates a recoverable unusable-output case into a hard 500. The outer catch correctly wraps its own reclaim in try/catch (334-338), but the inner one does not.
- **Impact**: Edge-case data/billing integrity — on a ledger hiccup, the user loses tokens for a mock they never received, and a degraded-but-serviceable path (return mock) becomes a 500. Rare (needs reclaim to fail) but it's exactly the partial-failure case the orchestrator claims to own.
- **Fix sketch**: Wrap the guard-null reclaim in try/catch like the outer path (`try { await charged.reclaim(); } catch { /* best-effort refund */ }`), and still fall through to mock+200 rather than letting it bubble to the 500. Keep `reclaimed = true` so no double-refund, but ensure a reclaim throw doesn't deny the user the mock response.
