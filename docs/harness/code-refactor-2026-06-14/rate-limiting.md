# Code Refactor Scan — Rate Limiting

> Total: 4 (C0 / H1 / M1 / L2)

## 1. Rate-limit preamble copy-pasted across routes that bypass the orchestrator
- **Severity**: high
- **Category**: duplication
- **File**: src/app/api/draft/route.ts:104-112, src/app/api/rfe/route.ts:74-82, src/app/api/evidence/categorize/route.ts:71-79, src/app/api/draft/save/route.ts:68-79
- **Scenario**: The shared orchestrator `executeAiOperation` already owns the entire rate-limit preamble — `if (enabled()) { rl = check(key(request, scope, user?), limits[bucket]); if (!rl.ok) return 429 + Retry-After + DISCLAIMER }` — at `src/lib/ai/operation.ts:213-228`. The `qualify` and `guidance` routes are declarative specs and inherit it (qualify: `rateLimit: { bucket, scope, byUser }` at qualify/route.ts:40; guidance/route.ts:40). But `draft`, `rfe`, and `evidence/categorize` still hand-roll the *identical* block inline, importing `RATE_LIMITS, checkRateLimit, isRateLimitEnabled, rateLimitKey` directly and reconstructing the same 429 body and `Retry-After` header. `draft/save` repeats it too (a non-charging route, so it can't move to the orchestrator, but the 429 envelope is still duplicated).
- **Root cause**: The ADR-0004 migration to `executeAiOperation` was completed for qualify + guidance but not for draft/rfe/categorize, which retain bespoke pipelines (they predate or were excluded from the migration). The rate-limit preamble rode along as copy-paste in each.
- **Impact**: The 429 contract (error key `rate_limited`, `retryAfterSec`, `disclaimer`, `Retry-After` header) is maintained in 4+ places. It has already drifted: draft/rfe/categorize include `disclaimer: DISCLAIMER` in the 429 body, but `draft/save` (route.ts:74-77) omits it. Any change to the rate-limit response envelope or keying must touch every route, and a missed edit silently diverges one endpoint.
- **Verification**: Read all five consuming routes + the orchestrator. Confirmed operation.ts:215-227 is the canonical block; confirmed draft.ts:104-112 / rfe.ts:74-82 / categorize.ts:72-78 / save.ts:69-78 each reconstruct it. Confirmed qualify/guidance do NOT (they pass a `RateLimitSpec`). Grep for `checkRateLimit`/`rateLimitKey` across the repo matched exactly these routes + operation.ts + tests.
- **Fix sketch**: Migrate draft/rfe/categorize onto `executeAiOperation` (as qualify/guidance already are) so the orchestrator's preamble is the sole copy; or, if their bespoke pipelines must stay, extract a tiny `applyRateLimit(request, { bucket, scope, byUser, userId }): NextResponse | null` helper in rate-limit.ts that returns the 429 (or null) and have the orchestrator call it too. Do NOT alter the before-charge ordering or per-user/per-IP keying — purely fold the existing identical block into one definition. Breaking-change risk: low if the 429 body is unified to the draft/rfe shape (with `disclaimer`); note `draft/save`'s current 429 has no disclaimer, so unifying changes that one body — confirm that envelope change is intended.

## 2. rate-limit.ts sits in src/lib/ but every consumer is an AI route / the AI orchestrator
- **Severity**: medium
- **Category**: structure
- **File**: src/lib/rate-limit.ts:1-148
- **Scenario**: The module's only runtime consumers are the five token-charged AI routes and `src/lib/ai/operation.ts`, and its caps are derived entirely from `src/lib/tokens/registry.ts` (`OPERATION_REGISTRY.*.rateLimit`, lines 44-50). Yet it lives at the generic `src/lib/` root, away from both its single source of truth (`src/lib/tokens/`) and its consumers (`src/lib/ai/`). The file's own header even says "it is only ever imported from server route handlers."
- **Root cause**: The limiter was added before the token registry and AI orchestrator were consolidated under `src/lib/tokens/` and `src/lib/ai/`; it never got relocated when its dependency/consumer cluster formed.
- **Impact**: Cosmetic/navigational. A reader landing in `src/lib/` sees a generic "rate-limit" that looks app-wide, when it is specifically the AI-token-route limiter coupled to `OPERATION_REGISTRY`. Co-locating would make the token/AI cluster self-documenting.
- **Verification**: Grep confirms imports come only from `src/app/api/{draft,rfe,qualify,guidance,evidence/categorize,draft/save}/route.ts`, `src/lib/ai/operation.ts`, and `src/lib/tokens/registry.test.ts`. Its only non-test import is `./tokens/registry`.
- **Fix sketch**: Move to `src/lib/tokens/rate-limit.ts` (next to the registry it derives from) or `src/lib/ai/rate-limit.ts` (next to its orchestrator consumer); update the ~7 import paths and the `@/lib/rate-limit` references. Pure move — no logic change, no behavior change. Low risk; verify the node `--test` runner still resolves the relative `./registry` import after the move.

## 3. Forwarded-client-IP extraction duplicated, with the security-hardened variant only here
- **Severity**: low
- **Category**: duplication
- **File**: src/lib/rate-limit.ts:135-139 vs src/app/welcome/actions.ts:36
- **Scenario**: `rateLimitKey` derives the client IP via `h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim()` and then validates it with `isValidIp` before trusting it (rate-limit.ts:101-139). `src/app/welcome/actions.ts:36` independently re-derives the *same* first-hop string (`x-forwarded-for` split + `x-real-ip`) but with NO `isValidIp` validation — it trusts whatever the client sends.
- **Root cause**: Two features needed "the caller's IP" and each wrote its own extraction; the security hardening (validate before trust, CHANGELOG line 83) was applied only to the rate-limit copy.
- **Impact**: Minor. Not a rate-limit defect (the limiter's copy is correctly hardened), but the divergence means the welcome action trusts an unvalidated client-controlled header. Worth noting because consolidating the extraction would also propagate the validation.
- **Verification**: Grep for `x-forwarded-for`/`x-real-ip` across `src/` returned exactly these two production sites (plus tests). Confirmed welcome/actions.ts:36 has no `isValidIp` guard.
- **Fix sketch**: Export a small `clientIp(request): string | null` (validated) from the relocated rate-limit module (or a shared `src/lib/http` helper) and have both call it. SAFETY: do not change `rateLimitKey`'s collapse-to-`anon`-on-invalid behavior — that is the spoofing guard; only share the extraction. Confirm welcome/actions.ts's intended behavior when the IP is invalid (today it passes garbage through).

## 4. checkRateLimit's windowMs parameter is dead in production (only tests pass it)
- **Severity**: low
- **Category**: cleanup
- **File**: src/lib/rate-limit.ts:72-78
- **Scenario**: `checkRateLimit(key, limit, windowMs = RATE_WINDOW_MS, now = Date.now(), store = globalBuckets)` exposes `windowMs` as the third positional arg, but every production caller (operation.ts:218-221, and the four inline routes) calls it with exactly two args, always defaulting to `RATE_WINDOW_MS` (60s). Only `rate-limit.test.ts` ever passes a custom `windowMs`/`now`/`store`. The window is therefore uniform across all buckets in production by construction.
- **Root cause**: `windowMs`/`now`/`store` were added as injection seams for testability (the file header calls this out). `now`/`store` earn their keep (purity + the future durable-store seam noted in the roadmap); `windowMs` is exercised only by tests and is positionally wedged before them.
- **Impact**: Cosmetic. The seam is harmless and arguably useful if per-bucket windows ever ship, but as written it is an unused production knob sitting between `limit` and the genuinely-injected `now`/`store`. No bug.
- **Verification**: Read every call site; only the 5 routes + orchestrator + tests call `checkRateLimit`. Confirmed all 6 production call sites pass 2 args; only rate-limit.test.ts passes 3-5.
- **Fix sketch**: Leave as-is unless tidying — the seam is legitimately used by tests. If trimming is desired, this is the lowest-value change; do NOT remove `now`/`store` (those are the testability + durable-backend seams the roadmap depends on, docs/plans/feature-roadmap-2026-06-13.md:89). Flag only; not recommended to action standalone.
