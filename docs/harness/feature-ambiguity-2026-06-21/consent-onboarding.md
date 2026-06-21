# Consent & Onboarding — Feature Scout + Ambiguity Guardian

> Context #10 · Group: Identity & Access
> Total: 5 findings

## 1. CONSENT_VERSION is a free-floating env string with no recorded semantics or release-coupling
- **Lens**: ambiguity-guardian
- **Priority**: Critical
- **Category**: trade-off
- **File**: `src/lib/auth/consent.ts:7`
- **Observation**: The entire re-consent gate hinges on one string: `CONSENT_VERSION = process.env.NEXT_PUBLIC_CONSENT_VERSION ?? "2026-05-29"`. `requireOnboardedUser` (`src/lib/auth/session.ts:135-138`) and the welcome page (`src/app/welcome/page.tsx:28-31`) redirect to re-consent only when the stored version `!==` this value. Nothing records *what changed* at "2026-05-29", what the previous versions were, or that the env var MUST be bumped in lockstep with the terms/privacy copy. Because it is `NEXT_PUBLIC_*`, the value is baked at build time; a deploy that updates the legal copy but forgets to bump the env leaves every user silently operating under terms they never re-accepted — and a partial rollout where two server instances carry different `NEXT_PUBLIC_CONSENT_VERSION` values would re-prompt or skip users non-deterministically.
- **Proposal**: Treat the version as a release artifact, not an ad-hoc string. Define an ordered, in-repo constant list (e.g. `CONSENT_VERSIONS = ["2026-05-29", ...] as const` with a changelog comment per entry tying it to the terms/privacy copy commit), derive `CONSENT_VERSION` as the last entry, and assert at startup that the env override (if set) is a member of that list. Document in the file header that bumping copy REQUIRES appending a new version, and that the value must be identical across all instances of a deploy.
- **Value / Risk-if-ignored**: This is the UPL/compliance keystone. A missed bump means the audit trail asserts users accepted current terms when they accepted older ones — a wrong compliance outcome that is invisible until a regulator or opposing counsel asks. Encoding the version history and a membership check turns a silent drift into a fail-fast.
- **Effort**: S

## 2. Marketing opt-in is captured once at signup and can never be viewed, changed, or withdrawn
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/components/ConsentForm.tsx:98-101`
- **Observation**: The welcome form collects an optional `marketing` checkbox and persists `marketing_opt_in` (`src/lib/db/firestore-store.ts:149`, `src/lib/db/pglite-store.ts:266`). A repo-wide search shows that column/field is **written but never read anywhere** — there is no settings/account/profile page (`src/app/**/{settings,account,profile}` returns nothing), no API to update it, and the consent rows are append-only. A user who opts in (or out) at signup is locked into that choice forever, and cannot see what they agreed to.
- **Proposal**: Add a lightweight authenticated "Account & consent" page that (a) shows the current consent version, the date accepted, and the marketing opt-in state, and (b) lets the user toggle marketing — recorded as a NEW append-only consent/preference row (preserving the audit trail), not an in-place edit. A sibling project in this codebase family already shipped a `GET /api/me/export` + consent-history surface; mirror that seam.
- **Value / Risk-if-ignored**: "Withdraw marketing consent" and "see/export my data" are baseline CAN-SPAM / GDPR / CCPA expectations a paying applicant assumes exist; their absence is both a trust gap and a latent legal-request liability (you store the data but cannot service a subject-access or opt-out request without a manual DB edit).
- **Effort**: M

## 3. The one-time free token grant has no identity/abuse gate — it keys only on user id
- **Lens**: feature-scout
- **Priority**: High
- **Category**: functionality
- **File**: `src/app/welcome/actions.ts:75`
- **Observation**: Completing consent grants `FREE_SIGNUP_GRANT = 150` tokens (`src/lib/tokens/economy.ts:11`) via `grantSignupTokens(user.id, ...)`, idempotent **per user id** only (`src/lib/db/pglite-store.ts:379-383`, `firestore-store.ts:257-261`). There is no check that the account's email is verified, non-disposable, or otherwise distinct from prior signups — `grep` for `email_verified`/`disposable`/`abuse` in `src/lib/auth` finds nothing. Every fresh account (one click to make in most auth providers) mints real spendable AI-metering credit.
- **Proposal**: Gate the grant on a verified identity signal before issuing: require `user.emailVerified` (Firebase exposes it on the token) and/or reject known disposable-email domains, deferring the grant until verification if needed. Record the gate's decision so a declined grant is auditable. Keep the existing per-user idempotency as the second layer.
- **Value / Risk-if-ignored**: The signup grant is the most directly farmable money path in the product. With zero identity friction, the free-token economics are open to trivial multi-account abuse, draining the metered-LLM budget the token economy exists to protect.
- **Effort**: M

## 4. Re-consent does not detect a CHANGED marketing choice — only a version change is honored
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/lib/auth/session.ts:131-138`
- **Observation**: Both onboarding gates compare ONLY `getLatestConsentVersion(user.id) !== CONSENT_VERSION`. `upsertProfileWithConsent` always inserts a new consent row carrying the current `marketing`/`terms`/`privacy` booleans, but nothing ever surfaces or reconciles a user's marketing choice once `onboarded_at` is set and the version matches. The intent is unstated: is marketing meant to be immutable post-signup, or is the form simply the only place it can ever be set? A future dev reading `requireOnboardedUser` cannot tell whether "version match ⇒ skip" is deliberately ignoring marketing state or an oversight. Compounding it, `getLatestConsentVersion` in Firestore (`firestore-store.ts:165-172`) breaks ties with `at >= latest.at` where an un-committed `serverTimestamp()` reads as `0` — so "latest" is ambiguous if two rows share/lack a timestamp.
- **Proposal**: Record the decision explicitly: add a header comment in `session.ts` stating that the onboarding gate intentionally keys on consent *version* only, that marketing preference is mutable solely via the (to-be-added) account page and is NOT a re-prompt trigger. Separately, make `getLatestConsentVersion`'s ordering deterministic (skip rows with a null/zero timestamp, or order by a monotonic field) so "latest version" can never be decided by a 0-millis tie.
- **Value / Risk-if-ignored**: An auditor reconstructing "what did this user consent to, and when" needs the gate's intent and a deterministic "latest" to be unambiguous; today both are implicit, and a timestamp tie could report the wrong accepted version — a compliance-relevant misread.
- **Effort**: S

## 5. No "what you agreed to" receipt or consent-history view for the user or an auditor
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: user_benefit
- **File**: `src/app/welcome/actions.ts:48-60`
- **Observation**: Consent is persisted append-only with version, terms/privacy booleans, marketing, IP, user-agent and timestamp (`pglite-store.ts:263-277`), which is exactly the data a defensible consent receipt needs — yet there is no read path back to the user. After clicking "Agree & open my case file" the user gets no confirmation of what was recorded, no copy of the terms version, and no way to retrieve it later. `getLatestConsentVersion` returns only the bare version string; the full row (with IP/UA/date) is never exposed.
- **Proposal**: After successful consent, email or render a consent receipt (version, date, accepted clauses) and expose the full append-only history on the account page from finding #2 — read-only, listing each consent event with its version and date. This reuses existing stored fields; no new write schema is required.
- **Value / Risk-if-ignored**: A timestamped consent receipt is the artifact that makes the UPL/not-legal-advice gate actually defensible in a dispute ("the user demonstrably saw and accepted v2026-05-29 on this date"). Without surfacing it, the data exists but provides neither user trust nor easy evidentiary retrieval.
- **Effort**: M
