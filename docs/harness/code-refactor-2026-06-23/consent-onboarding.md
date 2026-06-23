# Code Refactor — Consent & Onboarding
> Total: 4 (C0/H1/M2/L1)

## 1. Re-consent gate logic is duplicated, expressed as two independent inverses
- **Severity**: High
- **Category**: duplication
- **File**: src/app/welcome/page.tsx:28-31 and src/lib/auth/session.ts:132-148
- **Scenario**: The "is this user onboarded AND on the current consent version?" invariant is implemented twice. `welcome/page.tsx` redirects the user *away* when satisfied:
  ```
  if (profile?.onboarded_at) {
    const consented = await getLatestConsentVersion(user.id);
    if (consented === CONSENT_VERSION) redirect(dest);
  }
  ```
  `requireOnboardedUser` (session.ts) redirects *to* `/welcome` when the same invariant is violated:
  ```
  if (!profile || !profile.onboarded_at) redirect("/welcome");
  if (!isDevAuth()) {
    const consented = await getLatestConsentVersion(user.id);
    if (consented !== CONSENT_VERSION) redirect("/welcome");
  }
  ```
  grep `onboarded_at|getLatestConsentVersion|CONSENT_VERSION` confirms these are the only two app-entry consumers of the gate; both hand-roll the `onboarded_at` + version-equality check with no shared predicate.
- **Root cause**: No single source of truth for the onboarding/re-consent decision. Each call site re-derives it from the same two primitives (`profile.onboarded_at`, `getLatestConsentVersion` vs `CONSENT_VERSION`).
- **Impact**: This is the COMPLIANCE KEYSTONE the consent.ts header warns about, split across two files with opposite polarity. One subtle divergence (e.g. session.ts skips the version check under `isDevAuth()`, welcome/page.tsx does not gate on dev-auth) means a future edit to one branch silently desyncs the gate — the classic "duplicated logic causing divergence" risk, though today both agree on the net outcome.
- **Fix sketch**: Extract a pure predicate in `src/lib/auth/consent.ts` (or a small `onboarding.ts`), e.g. `isFullyConsented(profile, consentedVersion): boolean` (and/or `consentRedirectTarget(...)`), and have both `welcome/page.tsx` and `requireOnboardedUser` call it. Keep the dev-auth shortcut explicit in one place.

## 2. `profileFieldsFromUser(user)` recomputed twice in the consent action
- **Severity**: Medium
- **Category**: duplication / cleanup
- **File**: src/app/welcome/actions.ts:53 (and the earlier `user` resolution)
- **Scenario**: `submitConsent` calls `profileFieldsFromUser(user).avatarUrl` inline at line 53 to grab one field. `welcome/page.tsx:33` calls the same helper to destructure `fullName`. Within the action itself the helper is only invoked once, but it is invoked purely to reach into `.avatarUrl` while `fullName` is already collected from the form — so the call constructs the `{ fullName, avatarUrl }` object and discards `fullName`.
- **Root cause**: The helper returns a 2-field object but the action only needs `avatarUrl`; the value is fetched ad-hoc inside the `upsertProfileWithConsent` argument list rather than resolved once up front.
- **Impact**: Minor wasted allocation and a slightly opaque call site (reader must know `fullName` is intentionally ignored here). Low correctness risk, readability cleanup.
- **Fix sketch**: Resolve once near the top: `const { avatarUrl } = profileFieldsFromUser(user);` then pass `avatarUrl` into the upsert. Documents intent (only avatar is taken from provider metadata; name comes from the form).

## 3. `ConsentForm` field-contract comment duplicates the server-action source of truth
- **Severity**: Medium
- **Category**: structure / cleanup
- **File**: src/components/ConsentForm.tsx:3-10, 88-101 vs src/app/welcome/actions.ts:22-25
- **Scenario**: The form hardcodes input `name`s (`full_name`, `terms`, `privacy`, `marketing`) and a header comment asserts "the field names ... match the server action." The action independently reads `formData.get("full_name")`, `get("terms")`, etc. The required-ness ("terms+privacy are required") is asserted in the form's comment, enforced via `required` attributes, AND re-enforced server-side (`if (!terms || !privacy)`). The coupling is real but invisible to the type system.
- **Root cause**: FormData string keys are an untyped seam between client and server; the contract is maintained by matching string literals + prose comments instead of a shared constant/type.
- **Impact**: Renaming a field requires editing two files plus comments with no compiler help; a typo silently drops a consent value. This is structural debt, not a bug today.
- **Fix sketch**: Define the field-name keys (and which are required) once, e.g. `export const CONSENT_FIELDS = { fullName: "full_name", terms: "terms", privacy: "privacy", marketing: "marketing" } as const;` in a shared module imported by both the form's `name={...}` props and the action's `formData.get(...)`. Drops the "names match" comment in favor of a checked reference.

## 4. Stale/overstated comments in consent.ts about who reads the module
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/auth/consent.ts:1-4
- **Scenario**: The header says it is "Kept client-safe ... so it stays importable from a client component if a consent banner ever needs the version. Today the only readers are server-side (the welcome action + session)." grep for `from "@/lib/auth/consent"` confirms importers are `welcome/page.tsx`, `welcome/actions.ts`, `session.ts`, and `consent.test.ts` — all server-side; no client component imports it, so the "client-safe for a future banner" rationale is speculative and the enumerated reader list omits the welcome *page* (lists only "action + session").
- **Root cause**: Comment written against an anticipated future use that never materialized and a reader inventory that drifted as call sites were added.
- **Impact**: Cosmetic — mildly misleading documentation; a reader may hunt for a nonexistent client consumer or trust the incomplete reader list.
- **Fix sketch**: Trim the speculative client-banner justification to a one-liner ("no `server-only` import so it remains client-importable") and either drop the explicit reader enumeration or correct it to "welcome page + action + session gate." Note: the `NEXT_PUBLIC_*` / no-`server-only` posture itself is intentional per grounding — leave that; only tighten the prose.
