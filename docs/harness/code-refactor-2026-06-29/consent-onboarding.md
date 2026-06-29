# Code Refactor — Consent & Onboarding
> Total: 2
> Critical: 0 | High: 0 | Medium: 1 | Low: 1

_Scope: `src/lib/auth/consent.ts`, `src/components/ConsentForm.tsx`, `src/app/welcome/page.tsx`, `src/app/welcome/actions.ts` (plus the call-graph: `src/lib/auth/session.ts`, `src/lib/auth/db.ts`, `src/middleware.ts`, `src/app/dashboard/account/actions.ts`)._

This context is **clean** — the prior 2026-06-23 pass did its job. The three hypotheses in the brief were each checked against current code and found to be **non-issues**:

- **Dead exports in `consent.ts`** — none. Every export is live: `CONSENT_VERSION` (session/welcome/account), `CONSENT_FIELDS` (ConsentForm + action), `isFullyConsented` (welcome page + `requireOnboardedUser`), `CONSENT_VERSIONS`/`isKnownConsentVersion`/`ConsentVersion` (used internally by `resolveConsentVersion` and exercised by `consent.test.ts`; the comment explicitly documents the test-export). No misleading/unused symbol.
- **Signup-grant logic duplicated with the token-economy grant** — the grant *logic* is properly centralized in `grantSignupTokens` (`src/lib/tokens/ledger.ts:113`); both onboarding sites call the same idempotent helper with the same `FREE_SIGNUP_GRANT` constant. Not duplicated logic. (The *call recipe* is mildly repeated — see Finding 1.)
- **`requireOnboardedUser` redirect overlapping middleware** — intentional, documented defense-in-depth: `src/middleware.ts:16-20` is an Edge-runtime cookie *presence* check; `requireOnboardedUser` (`session.ts:126`) is the Node-runtime *real* verify + onboarding/consent gate. Different runtimes, different jobs, no redundant redirect to remove.

The two items below are minor, honest consolidation observations — neither is a correctness risk.

## 1. Onboarding "recipe" (persist consent @ current version + grant signup tokens) duplicated across two entry points
- **Severity**: Medium
- **Category**: duplication
- **File**: `src/app/welcome/actions.ts:52-83` and `src/lib/auth/session.ts:33-46`
- **Scenario**: Two onboarding entry points encode the same two-step recipe: `upsertProfileWithConsent({ …, consentVersion: CONSENT_VERSION, … })` immediately followed by `grantSignupTokens(userId, FREE_SIGNUP_GRANT)`. The real consent flow (`welcome/actions.ts`) does it for a Google user; `ensureDevSeeded` (`session.ts`) does it for the synthetic dev user. Both files independently import the same trio — `CONSENT_VERSION`, `grantSignupTokens`, `FREE_SIGNUP_GRANT` — to assemble it.
- **Root cause**: There is no single "complete first-time onboarding" helper; the persist-consent-then-grant sequence is hand-assembled per call site.
- **Impact**: A future change to the onboarding/grant policy (e.g., grant amount tied to a new condition, or a new field added to the consent write) must be mirrored in two places or the dev and prod paths silently diverge. Low blast radius today (both paths are covered by tests), but it's a money + compliance recipe, which raises the cost of an unmirrored edit.
- **Fix sketch**: Optional. The two paths *intentionally diverge* on gating (prod gates the grant on `user.emailVerified`; dev grants unconditionally) and on error handling (prod persists consent first with a user-facing error return; dev wraps both in one try/catch with a retry-reset), so a naïve extraction would re-introduce branching and pay little. If consolidated, a thin `completeOnboarding(user, { fields, gateGrant })` in `lib/auth` could own the persist+grant order and the shared constants; keep the divergent gating/error policy at the call sites. Given the small win, documenting the pairing (or leaving as-is) is also defensible — flagging mainly so a future grant-policy edit knows both sites exist.

## 2. Consent-state load-and-evaluate is open-coded (opposite polarity) in the welcome page and `requireOnboardedUser`
- **Severity**: Low
- **Category**: duplication
- **File**: `src/app/welcome/page.tsx:31-39` and `src/lib/auth/session.ts:132-142`
- **Scenario**: Both sites run the same orchestration — `getProfile(user.id)`, then (guarded on `onboarded_at`) `getLatestConsentVersion(user.id)`, then evaluate `isFullyConsented(profile, consented)` — just with inverted branch outcomes (the welcome page *skips to app* when fully consented; `requireOnboardedUser` *redirects to /welcome* when not).
- **Root cause**: The comparison predicate `isFullyConsented` was already extracted (good — that's why the two can't drift to opposite polarities), but the surrounding "fetch profile + fetch latest consent + evaluate" plumbing was not.
- **Impact**: Very low. If the gate ever needs an extra input (e.g., a per-user consent override, or skipping the version read under a flag), the load sequence must be edited in both places. The shared predicate already prevents the dangerous drift (the polarity bug), so this is purely a tidiness/maintainability note.
- **Fix sketch**: Optional — extract a small `loadConsentState(userId): Promise<{ profile, consented, fullyConsented }>` (or `isUserFullyConsented(userId)`) in `lib/auth` that both the welcome page and `requireOnboardedUser` call, leaving each to choose its own redirect direction. Low priority; the current shared predicate already covers the correctness-critical part.
