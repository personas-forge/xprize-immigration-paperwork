# Code Refactor — Rate Limiting

> Total: 4 (C0/H1/M1/L2)

Context files: `src/lib/tokens/rate-limit.ts`, `src/lib/tokens/rate-limit.test.ts` plus all
consumers grepped across `src/` (`checkRateLimit|rateLimitKey|isRateLimitEnabled|RATE_LIMITS|PREVIEW_RATE_LIMIT|RATE_WINDOW_MS|clientIp|trustedProxyHops`).
Runtime consumers confirmed: `src/lib/ai/operation.ts`, `src/app/api/qualify/preview/route.ts`,
`src/app/api/qualify/preview/best-path/route.ts`, `src/app/api/draft/save/route.ts`,
`src/app/welcome/actions.ts`, `src/app/dashboard/account/actions.ts` (+ tests).

Note on prior scan (`docs/harness/code-refactor-2026-06-14/rate-limiting.md`): its #2 (file location)
and #3 (`clientIp` extraction) have since been ACTIONED — the module now lives under
`src/lib/tokens/` and exports a validated `clientIp` that both consent actions consume. Findings
below are the *current* state, not a re-report.

---

## 1. The "429 from a RateLimitResult" response envelope is hand-rolled in 4 places — no shared helper
- **Severity**: High
- **Category**: duplication
- **File**: src/lib/ai/operation.ts:295-300; src/app/api/qualify/preview/route.ts:40-49; src/app/api/qualify/preview/best-path/route.ts:30-39; src/app/api/draft/save/route.ts:74-78
- **Scenario**: Every caller that holds a `RateLimitResult` builds the identical 429 by hand:
  ```ts
  return NextResponse.json(
    { error: "rate_limited", retryAfterSec: rl.retryAfterSec, disclaimer: DISCLAIMER },
    { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
  );
  ```
  This block is byte-identical at `operation.ts:296-299`, `draft/save/route.ts:75-77`, and (in its
  multi-line spelling) `qualify/preview/route.ts:41-48` and `best-path/route.ts:31-38`. `rate-limit.ts`
  owns `RateLimitResult` and `retryAfterSec` but ships **no** helper that turns one into a 429 —
  grep for `respondRateLimited|tooManyRequests|rateLimitResponse|429Response` across `src/` returns
  zero matches. So the module that defines the result shape leaves the response shape to four copies.
- **Root cause**: When draft/rfe/categorize migrated onto the `executeAiOperation` orchestrator (the
  prior scan's #1 partially actioned), the orchestrator absorbed its own copy of the 429 block but no
  one extracted the envelope into the limiter. The three non-orchestrated routes (two anonymous
  previews + the non-charging `draft/save`) legitimately can't route through `executeAiOperation`, so
  they kept hand-rolling it.
- **Impact**: The 429 contract — error key `rate_limited`, `retryAfterSec` field, `disclaimer`
  presence, and the `Retry-After` header — is maintained in four locations. The prior scan recorded
  that this exact envelope *already drifted once* (`draft/save` historically omitted `disclaimer`);
  it currently agrees, but any future change to the envelope (rename the field, add a
  `RateLimit-*` standard header, drop the disclaimer) must touch all four and a missed edit silently
  diverges one endpoint's wire contract.
- **Fix sketch**: Add one tiny pure helper beside `RateLimitResult` in `rate-limit.ts`, e.g.
  `tooManyRequestsResponse(rl: RateLimitResult, disclaimer: string): NextResponse` returning the
  canonical body+header, and call it from all four sites (the orchestrator included). Keep the
  before-charge ordering, per-user/per-IP keying, and `disclaimer` passed in by the caller (so the
  limiter need not import the guidance `DISCLAIMER`). Pure consolidation — no behavior change if the
  body is unified to the current shared shape.

## 2. The two anonymous preview routes duplicate the ENTIRE rate-limit preamble (only the scope string differs)
- **Severity**: Medium
- **Category**: duplication
- **File**: src/app/api/qualify/preview/route.ts:35-50 vs src/app/api/qualify/preview/best-path/route.ts:25-40
- **Scenario**: Both keyless preview endpoints open with the same 16-line guard — identical imports
  (`PREVIEW_RATE_LIMIT, checkRateLimit, isRateLimitEnabled, rateLimitKey`), identical
  `if (isRateLimitEnabled()) { const rl = checkRateLimit(rateLimitKey(request, <scope>), PREVIEW_RATE_LIMIT); if (!rl.ok) { …429… } }`.
  The ONLY difference is the scope literal: `"qualify_preview"` vs `"best_path_preview"`. Verified by
  printing both blocks side by side; they are character-for-character identical apart from the scope.
- **Root cause**: `best-path` was added as a sibling of the Instant-Verdict preview (both "moonshot"
  anonymous screeners) by copying the preview route's IP-keyed, charge-free preamble verbatim. There
  is no shared entry point for "anonymous, IP-keyed, `PREVIEW_RATE_LIMIT`, on its own scope".
- **Impact**: Two copies of the anonymous-abuse-surface guard — the most security-sensitive path
  (no balance to drain, no account to ban, per the module's own comment). Any tightening (lower the
  preview cap, add a header, change keying) must be mirrored in both, and a future third preview will
  copy it again. Smaller blast radius than #1 because both currently agree.
- **Fix sketch**: Export a focused guard from `rate-limit.ts`, e.g.
  `previewRateLimit(request: Request, scope: string): NextResponse | null` that runs the
  enabled→check→key→429 dance with `PREVIEW_RATE_LIMIT` and returns the 429 (or `null` to proceed);
  each route becomes `const limited = previewRateLimit(request, "qualify_preview"); if (limited) return limited;`.
  Naturally composes with #1's `tooManyRequestsResponse`. Don't change the per-IP keying or the
  charge-free contract.

## 3. `RATE_WINDOW_MS` and `trustedProxyHops` are `export`ed but consumed only inside the module
- **Severity**: Low
- **Category**: dead-code
- **File**: src/lib/tokens/rate-limit.ts:64 (`RATE_WINDOW_MS`), src/lib/tokens/rate-limit.ts:159 (`trustedProxyHops`)
- **Scenario**: Grepping every importer of the module (`from "@/lib/tokens/rate-limit"` / `"./rate-limit"`)
  enumerates exactly: `operation.ts` (RATE_LIMITS, checkRateLimit, isRateLimitEnabled, rateLimitKey),
  the two consent actions (clientIp), `draft/save` + the two previews (PREVIEW_RATE_LIMIT,
  checkRateLimit, isRateLimitEnabled, rateLimitKey), and the two tests. **No external file imports
  `RATE_WINDOW_MS` or `trustedProxyHops`.** Both are used *internally* — `RATE_WINDOW_MS` as the
  `windowMs` default at line 113, `trustedProxyHops` as `clientIp`'s `hops` default at line 179 — so
  they are live code, but the `export` keyword crosses no module boundary. (Confirmed
  `RATE_WINDOW_MS` matches only inside `rate-limit.ts` itself plus two prior `docs/harness/*` files.)
- **Root cause**: Both were exported defensively (likely "a route might want to reuse the window /
  hop count"); no route ever did. They remain internal helpers wearing a public modifier.
- **Impact**: Cosmetic. A reader of the public surface sees two exports that imply an external
  contract that doesn't exist, slightly widening the apparent API and inviting a future caller to
  couple to an internal detail (the fixed 60s window) that the module treats as private.
- **Fix sketch**: Drop `export` from `RATE_WINDOW_MS` and `trustedProxyHops` (keep them as
  module-private `const`/`function`). Pure visibility tightening — no call site changes, since none
  import them. NOTE: do not touch `clientIp` (exported and used by both consent actions) or the
  `now`/`store` seams on `checkRateLimit` (genuine test/durable-backend injection points).

## 4. `checkRateLimit`'s `windowMs` positional parameter is production-dead (only tests pass it)
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/tokens/rate-limit.ts:110-116
- **Scenario**: `checkRateLimit(key, limit, windowMs = RATE_WINDOW_MS, now = Date.now(), store = globalBuckets)`
  exposes `windowMs` as the 3rd positional arg, but every production caller passes exactly two args:
  `operation.ts:291-294` and the three inline routes all call `checkRateLimit(key, cap)` and inherit
  the 60s default. Only `rate-limit.test.ts` ever supplies `windowMs`/`now`/`store` (lines 10-12,
  20-22, 27-28, 59). The window is therefore uniform across all buckets in production by construction.
- **Root cause**: `windowMs`/`now`/`store` were added as test-injection seams (the file header says
  so). `now`/`store` earn their keep — purity and the documented future durable-store seam — but
  `windowMs` is exercised only by tests, wedged positionally between `limit` and the genuinely-used
  `now`/`store`.
- **Impact**: Cosmetic and unchanged from the 2026-06-14 scan's #4. Harmless seam; no bug. Listed for
  completeness so the context isn't padded with new trivia — it's a known, lowest-value item.
- **Fix sketch**: Leave as-is — the seam is legitimately used by tests and removing it would force
  per-bucket-window support to re-add it later. Flag only; NOT recommended to action standalone, and
  never remove `now`/`store`.
