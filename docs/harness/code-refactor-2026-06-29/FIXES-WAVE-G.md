# Wave G — cleanup-tail sweep (closed)

Final cleanup-tail pass on top of Waves A–F. Behaviour-preserving consolidations
only. Built on `vibeman/code-refactor-2026-06-29` HEAD.

Gates throughout: `tsc --noEmit` clean after every item; full suite **455 → 465**
passing (+10 new focused tests, 0 deletions/weakenings). `npm test` =
`tsx --test "src/**/*.test.ts"`.

## Structural mediums (7/7 closed)

| # | Commit | Report | What |
|---|--------|--------|------|
| 1 | `1585453` | authentication-session #2 | Extracted the 5-line `typeof window` server-only guard (hand-copied across 9 modules with drifted comments) into one zero-dep `assertServerOnly(moduleName)` in `src/lib/serverOnlyGuard.ts`; reused it in auth session/db/route-authz, both firebase-admin handles, both Store drivers, and the token ledger. Collapsed the 3 divergent "why a runtime guard" comments to one. +2 tests. |
| 2 | `2ef80dd` | authentication-session #3, #4 | Hoisted pglite-store's function-scoped `iso()` (null-safe date→ISO) to module scope; reused at 6 row projections (getReviewEvents keeps its `?? ""`). Dropped the Firestore `grantSignupTokens` copy-pasted clawback comment + dead `Math.max(0,…)` (signup grant is invariantly positive) to match the PGlite twin. |
| 3 | `a9735a2` | data-adapter-layer #1 | Completed the `wrapStore` family: added `wrapFound` (bool→not_found) and `wrapVersion` (number\|null→unconfigured); collapsed 5 hand-rolled try/catch tails (evidence remove/restore/refileDocument, petition saveDraft/saveRfeResponse). +3 tests. |
| 4 | `68eb412` | case-file-dashboard #3 | Lifted CaseDetailView's private `Fact` masthead cell into a shared `components/Fact.tsx`; both mastheads render it (dashboard skeleton kept). Markup byte-identical. |
| 5 | `6f6e42f` | consent-onboarding #1 | Extracted `completeOnboarding(fields, { persistConsent, grantTokens })` in `lib/auth/onboarding` — owns the persist→grant order + CONSENT_VERSION/FREE_SIGNUP_GRANT, returns a discriminated result so welcome (fatal consent / verified-gated grant) and ensureDevSeeded (skip-consent-if-exists / always-grant) keep their own policy. Deps injectable. +5 tests. |
| 6 | `a73d489` | attorney-review-filing #3 | Declared the review-event author shape once as `ReviewEventInput`; referenced from addReviewEvent + transitionCase. Type-only. |
| 7 | `b889d4e` | llm-engine-observability #2, #5 | Moved the success-path `trackLlm` (and the empty-output→"error" rule) into `withTelemetry` — each engine `run` now returns an `EngineRun` (its own model/usage/latency). Derived `isLongTierOnFastFallback` from `geminiModelFor` (single source for the fallback rule). +1 test case. |

## Cheap lows (6 closed)

| # | Commit | Report | What |
|---|--------|--------|------|
| 8 | `6e87d43` | attorney-review #4, #5 | queue-age.ts imports the canonical `BadgeTone` (type-only) instead of a narrowed shadow; dropped the redundant `as SavedCaseSummary[]` cast in ReviewQueueView. |
| 9 | `f5ed378` | brand-design-system #5 (partial) | Removed CardSubtitle's no-op inline `color: var(--muted)` (`.microprint` already sets it). Override sites left inline — see FOLLOWUPS (Tailwind v4 cascade). |
| 10 | `03832b4` | rate-limiting #3 | Renamed the lone kebab-case scope `"draft-save"` → `"draft_save"` (in-process bucket key only; not persisted). |
| 11 | `29677ea` | checkout-token-bundles #3 | Trimmed `PolarOrder` to the 4 fields read off the cast (id/metadata/refunded_amount/amount); replaced the inline event type with the exported `WebhookEvent`. |
| 12 | `eadaf62` | llm-engine-observability #4 | Derived `ModelSource = LlmEngine \| "mock"` from the canonical union (and isModelSource's predicate). |
| 13 | `f562217` | uscis-form-field-guidance #3 | Dropped the unconsumed `blocked: true` flag from the guidance onBlocked body (block is conveyed by the attached `adjudication` report). |

## Verified already-closed (no action needed)

Re-grepped before touching; these prior-wave/earlier-pass fixes are already in HEAD:
- **token-economy-ledger #5** — `costOf` no longer references `economy.ts` in its body (remaining `economy.ts` mentions are legit module-relationship docs).
- **statusTone consolidation** (case-file #2 / brand #2 / attorney #2) — `src/features/case-file/caseStatusTone.ts` exists and is used.
- **createLocalStorageStore** (brand #1 / case-file #1) — `src/lib/createLocalStorageStore.ts` exists.
- **untrusted-body validation** (uscis #1) — `src/lib/validation.ts` (`asObjectBody`/`str`) exists.
- **enforceRateLimit façade** (rate-limit #1) — present in `rate-limit.ts`.
- **order_id via pickStr** (checkout #2) — done in Wave E.

## Deferred this wave → see FOLLOWUPS.md
- brand-design-system #5 remainder (override→token-class conversion is UNSAFE under Tailwind v4 cascade layers; broad per-page no-op scatter is a separate verified-codemod task).
- uscis-form-field-guidance #2 (`WithAdjudication<T>` — only 2/5 sites are clean intersections; not a clean uniform move).
