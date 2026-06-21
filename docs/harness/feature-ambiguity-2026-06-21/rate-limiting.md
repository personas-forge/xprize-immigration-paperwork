# Rate Limiting — Feature Scout + Ambiguity Guardian

> Context #14 · Group: AI Infrastructure & Evaluation
> Total: 5 findings

## 1. No abuse alerting or limiter observability — a sustained flood is invisible
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/lib/tokens/rate-limit.ts:114-121` (the 429 branch) and `src/lib/ai/operation.ts:268-273`
- **Observation**: When `checkRateLimit` returns `ok:false` the route emits a 429 and that is the entire footprint — no `console.warn`, no counter, no signal. There is no count of how often any bucket trips, no per-key hit rate, and no way to tell "one user looping" from "an IP-rotation attack in progress." The `enforceCap` eviction path (`rate-limit.ts:83-92`), which only fires under an adversarial key burst, is likewise silent — the one event that most signals abuse logs nothing. The product's stated abuse model is "the only abuse surface is a flood" (`qualify/preview/route.ts:27`), yet a flood produces zero telemetry.
- **Proposal**: Emit a structured log/metric on every 429 (key scope, limit, retryAfterSec) and, separately, a louder warn when `enforceCap` actually evicts live buckets (the bucket map is being attacked). Optionally expose a counter (`limiter_block_total{scope}`) so an operator can alert when block rate spikes. This pairs naturally with the existing `cost-telemetry` seam already wired in `operation.ts:194-198`.
- **Value / Risk-if-ignored**: Without it, the limiter silently does its job until model cost or RSS spikes — the team learns about an abuse event from the Gemini bill or an OOM, not from a signal. Detection is the difference between "blocked and alerted" and "blocked but blind."
- **Effort**: S

## 2. No per-plan caps, admin override, or balance-aware limits — caps are flat for every user
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: feature
- **File**: `src/lib/tokens/rate-limit.ts:44-50` (`RATE_LIMITS`) and `src/lib/tokens/registry.ts:37-44` (`OPERATION_REGISTRY`)
- **Observation**: Caps are a single static number per operation (`draft:20`, `rfe:20`, `qualify:40`, …) baked into the registry, applied identically to every authenticated user regardless of plan, token balance, or trust. A paying power-user who legitimately needs 30 drafts/hour is throttled the same as a brand-new free-trial account; there is no per-plan tier, no admin/internal bypass key, and no relief valve for support to lift a cap on a stuck account. `checkRateLimit` takes `limit` as a plain argument, so the seam to vary it per-caller exists but is unused.
- **Proposal**: Allow the cap to be resolved per request — e.g. a `limitFor(operation, plan)` that reads the user's plan/tier (the token economy already knows the customer), plus an env-gated internal-bypass header for admin/load tooling distinct from the blunt `RATE_LIMIT_DISABLED=1` global off-switch (`rate-limit.ts:198-203`).
- **Value / Risk-if-ignored**: A flat cap either throttles your best customers (revenue/UX) or is set so generously it barely limits abuse — you can't have both with one number. As soon as paid tiers exist, per-plan caps become a selling point and a fairness requirement.
- **Effort**: M

## 3. Single-node limiter has no shared backing and no enforcement of the single-node assumption
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: functionality
- **File**: `src/lib/tokens/rate-limit.ts:54-61` (`globalBuckets` module Map) and the doc block at `:54-60`
- **Observation**: Counts live in `globalBuckets`, a module-level `Map`, correct only on ONE process. The code documents this extensively and even names the fix ("a shared backend (Redis/Upstash) can be dropped in"), and `checkRateLimit` already accepts an injectable `store` — but no shared-store implementation exists and nothing at runtime warns when the assumption is violated. Under any horizontal scaling (multiple containers, serverless concurrency) the effective cap silently multiplies by instance count; a cold start/HMR resets all counts to zero.
- **Proposal**: Implement the already-designed seam: an async store interface backed by Upstash/Redis (atomic INCR + EXPIRE per key) selected by env, defaulting to the in-memory Map. As a cheap interim, add a one-line startup warning when an env signal (e.g. `INSTANCE_COUNT>1` or a serverless platform marker) contradicts the single-node assumption.
- **Value / Risk-if-ignored**: The whole limiter is a production-readiness blocker the day the app scales past one node — the caps in `RATE_LIMITS` quietly stop meaning what they say and offer a fraction of the intended protection, with no warning.
- **Effort**: L

## 4. Anonymous preview routes hardcode `PREVIEW_LIMIT = 30`, bypassing the "single source of truth" registry
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: code_quality
- **File**: `src/app/api/qualify/preview/route.ts:35` and `src/app/api/qualify/preview/best-path/route.ts:23`
- **Observation**: Both anonymous preview routes define a route-local `const PREVIEW_LIMIT = 30` and pass it straight to `checkRateLimit`, never touching `RATE_LIMITS`/`OPERATION_REGISTRY`. This directly contradicts the limiter's and registry's stated contract that `OPERATION_REGISTRY` is the "SINGLE SOURCE OF TRUTH" from which all caps are derived (`rate-limit.ts:34-42`, `registry.ts:1-7`). The value `30` is also unexplained — why is the free, keyless, no-model preview capped LOWER (30) than the model-backed, money-spending `guidance`/`categorize` ops (40)? The reasoning is recorded nowhere, and the two copies can drift independently.
- **Proposal**: Either route the preview caps through the registry (add `qualify_preview`/`best_path_preview` entries, or an explicit `PREVIEW` cap export) so there is one place to change them, or document beside the literal exactly why previews are governed outside the registry and why 30 < 40. Remove the duplicated magic number.
- **Value / Risk-if-ignored**: Two undocumented copies of a security-relevant cap quietly violate the project's own stated invariant; a future "raise all caps" change made in the registry silently misses the two highest-traffic anonymous endpoints.
- **Effort**: S

## 5. Fixed-window counter permits a 2x burst across the window boundary, undocumented as a trade-off
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: edge_case
- **File**: `src/lib/tokens/rate-limit.ts:98-125` (`checkRateLimit`), window constant at `:52`
- **Observation**: This is a fixed-window counter: a bucket allows `limit` hits, then resets wholesale at `resetAt`. An attacker (or a retry storm) can fire `limit` requests at t=59.9s and another full `limit` at t=60.1s — `2 × limit` calls in ~0.2s — because the new window grants a fresh allowance the instant the old one elapses (`:108-112`). For `draft` (cap 20, the xl/12-token premium op) that is up to 40 paid generations back-to-back. The docstring calls the limiter "intentionally simple" but never names this burst-at-boundary behavior or `RATE_WINDOW_MS = 60_000` as a deliberate trade-off versus a sliding window; the test suite (`rate-limit.test.ts`) only checks single-window behavior, so the boundary case is unspecified.
- **Proposal**: Record the decision explicitly — either accept fixed-window and document that effective short-term burst is up to 2x cap (and confirm 2x of each cap is acceptable cost-wise), or move to a sliding/token-bucket window. At minimum add a comment beside `RATE_WINDOW_MS` and a test asserting the boundary behavior so it's an intended contract, not an accident.
- **Value / Risk-if-ignored**: The real enforced ceiling is double the number an operator reads in `RATE_LIMITS`. For the 12-token xl draft op that is a meaningful, silent cost/abuse gap, and a future maintainer tuning caps has no way to know the true worst case.
- **Effort**: S
