# Code Refactor — Rate Limiting
> Total: 3
> Critical: 0 | High: 0 | Medium: 1 | Low: 2

Context scope: `src/lib/tokens/rate-limit.ts` + `rate-limit.test.ts` (the prompt's
`src/lib/rate-limit.ts` path is stale — the limiter lives under `tokens/`). The
limiter CORE is clean: every export is used (`checkRateLimit`, `rateLimitKey`,
`clientIp`, `isRateLimitEnabled`, `tooManyRequestsResponse`, `RATE_LIMITS`,
`PREVIEW_RATE_LIMIT`, `RateLimitResult`), no dead code, no `console.log`, no
commented-out blocks, no TODOs. The five token-charged AI routes do NOT duplicate
the wiring — `src/lib/ai/operation.ts` (the orchestrator) owns the enable→key→
check→respond sequence once (lines 287-299). The findings below are the
non-orchestrated callers and two doc/naming nits.

## 1. Three non-orchestrated routes hand-build the identical rate-limit guard block
- **Severity**: Medium
- **Category**: consolidation
- **File**: `src/app/api/qualify/preview/route.ts:34-40`, `src/app/api/qualify/preview/best-path/route.ts:24-30`, `src/app/api/draft/save/route.ts:68-74`
- **Scenario**: The orchestrator centralizes the limiter call for the 5 charged AI routes, but the 3 routes that DON'T use it each copy the same 5-line block: `if (isRateLimitEnabled()) { const rl = checkRateLimit(rateLimitKey(request, "<scope>", <userId?>), <CAP>); if (!rl.ok) return tooManyRequestsResponse(rl, DISCLAIMER); }`. The two preview blocks are byte-identical apart from the scope string; `draft/save` adds `user?.id` and swaps the cap. All three also repeat the same 5-symbol import list from `@/lib/tokens/rate-limit`.
- **Root cause**: There is no route-facing one-call helper. The limiter exposes the four primitives (`isRateLimitEnabled` / `rateLimitKey` / `checkRateLimit` / `tooManyRequestsResponse`) but no façade that runs them in order, so each non-orchestrated caller re-assembles the sequence by hand — the exact boilerplate the orchestrator was built to delete (`operation.ts:287-299`).
- **Impact**: ~15 lines duplicated across 3 files; the enable-check / key-strategy / 429-shape invariant is enforced in 4 separate places (orchestrator + 3 routes). If the contract changes (e.g. add a `Retry-After`-style field, change the enable env var), every copy must move in lockstep — the `rate-limit.ts` header comment already records that "the disclaimer was once dropped on one path," i.e. this kind of drift has bitten before.
- **Fix sketch**: Add one helper next to `tooManyRequestsResponse`, e.g. `export function enforceRateLimit(request, scope, limit, userId?, disclaimer): NextResponse | null { if (!isRateLimitEnabled()) return null; const rl = checkRateLimit(rateLimitKey(request, scope, userId), limit); return rl.ok ? null : tooManyRequestsResponse(rl, disclaimer); }`. Each route collapses to `const limited = enforceRateLimit(request, "qualify_preview", PREVIEW_RATE_LIMIT, undefined, DISCLAIMER); if (limited) return limited;`. Keep `disclaimer` as a PARAM (don't import `@/lib/result` into the limiter) to preserve the module's deliberate "limiter needn't import a feature constant" decoupling noted at `rate-limit.ts:36`. The orchestrator can adopt the same helper or keep injecting primitives — either way the non-orchestrated paths stop re-deriving the sequence.

## 2. Stale module doc lists only 3 of the 5 rate-limited AI endpoints
- **Severity**: Low
- **Category**: cleanup
- **File**: `src/lib/tokens/rate-limit.ts:5-8`
- **Scenario**: The header comment says "The AI endpoints (/api/draft, /api/rfe, /api/guidance) debit tokens per call but nothing caps call FREQUENCY...". `RATE_LIMITS` (lines 63-69) and the registry now define FIVE buckets — `draft, rfe, qualify, guidance, categorize` — and the in-file comment at lines 56-61 correctly enumerates all five. The header is a frozen snapshot from before `qualify`/`categorize` were added.
- **Root cause**: The motivating comment wasn't updated when `qualify` (ADR-0005, referenced at line 58) and `categorize` gained route buckets.
- **Impact**: Misleads a reader into thinking only 3 routes are governed; mild, since the authoritative `RATE_LIMITS` map and the lower comment are correct. Pure doc drift.
- **Fix sketch**: Replace the parenthetical with "the five token-charged AI endpoints (draft, rfe, qualify, guidance, evidence/categorize)" or drop the explicit list and point at `RATE_LIMITS` as the source of truth.

## 3. Inconsistent separator in rate-limit scope strings (underscore vs hyphen)
- **Severity**: Low
- **Category**: naming
- **File**: `src/app/api/draft/save/route.ts:70` (`"draft-save"`) vs `src/app/api/qualify/preview/route.ts:36` (`"qualify_preview"`), `best-path/route.ts:26` (`"best_path_preview"`), and the orchestrated `qualify/best-path/route.ts:27` (`"best_path"`)
- **Scenario**: Scope strings (the bucket-key namespace prefix passed to `rateLimitKey`) use snake_case everywhere except `"draft-save"`, which is the lone kebab-case outlier.
- **Root cause**: Each route picks its own literal with no shared convention or central enum; the limiter only requires the scopes be distinct, so nothing enforced consistency.
- **Impact**: Cosmetic only — these strings are never compared cross-route and are correctness-neutral. Slight readability/consistency nit; flagged for honesty, not urgency.
- **Fix sketch**: Rename `"draft-save"` → `"draft_save"` to match, or (if combined with finding #1) define the scope literals as a small `const` map so the convention is visible in one place. Either is a one-token change; verify no external consumer keys off the literal first (it's an in-process map key, so safe).
