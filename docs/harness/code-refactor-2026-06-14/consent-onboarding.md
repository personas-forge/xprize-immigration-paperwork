# Code Refactor Scan — Consent & Onboarding

> Total: 4 (C0 / H1 / M2 / L1)

## 1. Divergent second source of truth for the legal/UPL disclaimer
- **Severity**: high
- **Category**: duplication
- **File**: src/components/ConsentForm.tsx:16-20
- **Scenario**: `ConsentForm` hardcodes its own `ATTORNEY_DISCLAIMER` constant and renders it through `<DisclaimerStamp text={ATTORNEY_DISCLAIMER} />`. Everywhere else in the app, the not-legal-advice safeguard is the single canonical `DISCLAIMER` constant (`src/lib/result.ts:37`, re-exported via `@/features/guidance/guidance` and `@/features/guidance`). The two strings are NOT the same text:
  - Canonical (`lib/result.ts`): "This is general informational guidance only, not legal advice. Immigration law is fact-specific and changes frequently. An attorney of record licensed to practice law is required to review your petition and advise on your situation before anything is filed with USCIS."
  - ConsentForm local: "Creating an account does not form an attorney–client relationship and is not legal advice. Immigration law is fact-specific; an attorney of record licensed to practice law reviews and signs every petition before anything is filed with USCIS."
- **Root cause**: The consent gate authored its own disclaimer copy instead of reusing the shared constant. Because the sign-up flow needed an "account-creation does not form an attorney–client relationship" nuance, someone forked the string rather than extending the canonical source.
- **Impact**: For a UPL-sensitive product this is the highest-value maintenance/correctness target: a legal disclaimer now has two divergent wordings, edited in two places. A future legal-review edit to `DISCLAIMER` (which has a dedicated regression test asserting its content — `src/lib/result.test.ts:36-46`, `src/features/guidance/guidance.test.ts:61-66`) silently does NOT propagate to the most legally significant surface, the consent screen. The two strings already disagree on what they assert (attorney–client relationship formation vs. general-guidance framing), so today there is no single authoritative disclaimer wording.
- **Verification**: Grepped the whole repo for the disclaimer text / `DISCLAIMER` / "not legal advice" / "attorney of record". Confirmed `DISCLAIMER` is defined once in `src/lib/result.ts:37` and re-exported (back-compat) from `src/features/guidance/guidance.ts:38` and `src/features/guidance/index.ts:4`. All ~10 other UPL surfaces (drafting, evidence, rfe, qualification, guidance, AI route error bodies) consume the shared constant via `DisclaimerStamp text={DISCLAIMER}` or the `Result` envelope. `ATTORNEY_DISCLAIMER` is local to ConsentForm.tsx and referenced nowhere else. ConsentForm already imports from the guidance feature (line 14), so the canonical constant is one import away. No test pins `ATTORNEY_DISCLAIMER`'s text (the only ConsentForm test, `ConsentForm.consent-copy.test.ts`, asserts the submit-button verb, not the disclaimer).
- **Fix sketch**: Replace the local constant with the canonical one — `import { DISCLAIMER } from "@/features/guidance"` (already an importer of that feature) and render `<DisclaimerStamp text={DISCLAIMER} />`. If the "creating an account does not form an attorney–client relationship" nuance is legally required at sign-up specifically, capture that as an explicit, named export beside the canonical `DISCLAIMER` (e.g. `SIGNUP_DISCLAIMER` in `lib/result.ts` or the guidance module) and add it to the existing disclaimer regression test, so there is still exactly one authored home per disclaimer string. Do not silently delete the account-relationship wording without legal sign-off.

## 2. Welcome page and submitConsent independently fetch/derive overlapping profile + name logic
- **Severity**: medium
- **Category**: structure
- **File**: src/app/welcome/page.tsx:16-22 and src/app/welcome/actions.ts:49-60
- **Scenario**: `page.tsx` derives `defaultName` from `user.user_metadata.full_name ?? .name ?? ""` and reads the profile to redirect onboarded users. `actions.ts` re-reads the user, re-derives `avatar_url` from `user_metadata`, and writes the profile. The "pull display fields off `user_metadata`" logic is split across the page and the action with slightly different field sets (page: full_name/name; action: avatar_url), and neither side shares a helper.
- **Root cause**: Server Component and Server Action each access `user.user_metadata` ad hoc; no shared "profile fields from AppUser" mapper.
- **Impact**: Moderate. The metadata key handling can drift (e.g., page falls back to `name`, the action does not consider it for anything), and a future metadata-shape change must be edited in two files. Not a bug today.
- **Verification**: Read both files end to end. `getProfile` is imported from `@/lib/auth/db` in page.tsx and `./db` in session.ts (same module, consistent). Confirmed `submitConsent` is the only consumer of the form (ConsentForm is rendered only by `welcome/page.tsx:54`). No shared mapper exists for `user_metadata` extraction.
- **Fix sketch**: Optional consolidation — extract a small `profileFieldsFromUser(user)` helper (returns `{ fullName, avatarUrl }`) used by both the page's `defaultName` default and the action's upsert, so the metadata-key fallbacks live in one place. Low urgency; structural tidiness only.

## 3. `email` prop on ConsentForm is display-only and duplicates server-side knowledge
- **Severity**: medium
- **Category**: cleanup
- **File**: src/components/ConsentForm.tsx:22-28,54-58
- **Scenario**: `ConsentForm` accepts `email` purely to render a "Signed in as {email}" line. The email is not submitted by the form (the server action re-derives it from `getUser()` at actions.ts:52). So the prop is presentational only and the value is already authoritative server-side.
- **Root cause**: Passing context-display data down as a prop rather than rendering it in the page header where the rest of the chrome lives.
- **Impact**: Low/moderate. Harmless but slightly muddies the component contract — a reader may assume `email` is load-bearing for consent capture (it is not; only full_name/terms/privacy/marketing are). The header comment (lines 3-7) already enumerates the load-bearing fields, which does NOT include email, so the prop is mildly inconsistent with the documented contract.
- **Verification**: Read ConsentForm fully — `email` is referenced only in the JSX at lines 54-58, never in a form field or hidden input. Confirmed actions.ts uses `user.email` from `getUser()`, not from `formData`. Confirmed ConsentForm has exactly one caller.
- **Fix sketch**: Either keep as-is (clearly harmless), or move the "Signed in as {email}" line into `welcome/page.tsx` header (which already shows email-adjacent identity chrome) and drop the prop, shrinking the component's surface to only its load-bearing inputs.

## 4. Stale provider-agnostic comment on consent.ts now that CONSENT_VERSION is server-only in practice
- **Severity**: low
- **Category**: cleanup
- **File**: src/lib/auth/consent.ts:1-7
- **Scenario**: The module header says `CONSENT_VERSION` is "read on both client and server" and therefore uses a `NEXT_PUBLIC_*` var with no `server-only` import. In the current tree the constant is imported only by two server modules — `welcome/actions.ts` (a `"use server"` action) and `lib/auth/session.ts` (which is itself runtime-guarded server-only). There is no client-side reader.
- **Root cause**: Comment describes an intended/earlier usage that the present import graph does not exercise.
- **Impact**: Cosmetic. The `NEXT_PUBLIC_` env name and the no-`server-only` stance are still defensible (keeps the module importable from a client component without a build error), but the stated justification ("read on both client and server") is no longer literally true and could mislead.
- **Verification**: Grepped repo for `CONSENT_VERSION` — only three hits: its definition, `welcome/actions.ts:7,54`, and `lib/auth/session.ts:9,33`. Both consumers are server-side. No client component imports `@/lib/auth/consent`.
- **Fix sketch**: Soften the comment to reflect reality (e.g., "kept client-safe — no `server-only` import — so it stays importable from client code if a consent banner ever needs the version") rather than asserting a client read that doesn't currently exist. Do not change the runtime value or env-var name. No behavior change.
