> Total: 5 | Critical: 1 | High: 2 | Medium: 1 | Low: 1
> Context: Consent & Onboarding
> Lens mix: bug-hunter 4, ui-perfectionist 1

## 1. Stored consent_version is never compared to current CONSENT_VERSION — users are never re-prompted after a copy change
- **Severity**: Critical
- **Lens**: bug-hunter
- **Category**: legal-consent integrity / version pinning
- **File**: src/lib/auth/session.ts:101-110 (gate) + src/app/welcome/page.tsx:17
- **Scenario**: A user consents under version `2026-05-29`. Later you bump `NEXT_PUBLIC_CONSENT_VERSION` (or edit Terms/Privacy copy and bump). The user signs in again. The gate `requireOnboardedUser()` redirects to `/welcome` only when `!profile.onboarded_at`; `WelcomePage` skips to `/dashboard` whenever `profile?.onboarded_at` is set. Neither path looks at the consent row's `consent_version`. The user keeps full access having only ever agreed to the *old* terms.
- **Root cause**: `CONSENT_VERSION` is dutifully written into every `consents` row (`consentVersion` in actions.ts:56, persisted in both stores) but is **write-only** — it is never read back. There is no `getLatestConsentVersion(userId)` and no comparison anywhere. `onboarded_at` (a boolean-ish "ever consented" flag) is the *only* gate condition, so version is effectively ignored after first auth.
- **Impact**: The whole point of versioning consent — re-securing agreement when legal copy changes — silently does not work. For a UPL-sensitive immigration product this means users operate under terms they never accepted; the audit trail says "v1" while you believe everyone is on "v2". A legal/compliance landmine, and the bug is invisible because the column *looks* populated.
- **Fix sketch**: Add `store.getLatestConsentVersion(userId)` (PGlite: `select consent_version from consents where user_id=$1 order by created_at desc limit 1`; Firestore: latest consents doc by `created_at`). In `requireOnboardedUser` (and `WelcomePage`'s skip check), redirect to `/welcome` when `latest !== CONSENT_VERSION` even if `onboarded_at` is set. Re-rendering `/welcome` already re-collects terms+privacy and appends a fresh consent row, so the only change is the gate predicate.

## 2. grantSignupTokens runs before the consent write inside the same try — an unrelated token-grant failure discards the user's consent
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: server-action error handling / ordering
- **File**: src/app/welcome/actions.ts:43-67
- **Scenario**: User checks terms+privacy and submits. `grantSignupTokens(user.id, ...)` is awaited *first* inside the `try`. If the token-account write throws (Firestore transient/contention, ledger transaction conflict, quota), control jumps to the single `catch` and returns "We couldn't save your consent. Please try again in a moment." But `upsertProfileWithConsent` never ran — so the message is literally true yet the cause was the *bonus tokens*, not consent. The user is bounced even though their agreement was valid and could have been recorded.
- **Root cause**: Two independent concerns share one `try` and one ordering. The code-comment justifies the ordering for the *crash-between-writes* case (leaves user not-onboarded → safe retry), but it conflates "grant" failures with "consent" failures: a failure in the *first, non-consent* write aborts the *consent* write and is misreported as a consent failure. The grant is idempotent and could be deferred/best-effort.
- **Impact**: Onboarding is gated on a non-essential side-effect succeeding. Under any token-store hiccup, consenting users cannot enter — and the error text misattributes the cause, complicating support/debugging. (Note: the no-store path is fine — `grantSignupTokens` no-ops and `upsertProfileWithConsent` throws "No database configured", correctly fail-closed.)
- **Fix sketch**: Persist consent FIRST (`upsertProfileWithConsent`), then grant tokens. Make the grant best-effort: wrap it in its own try and, on failure, still proceed to `/dashboard` (the grant is idempotent — a guard/top-up path can re-grant). Or keep order but use two catches with distinct messages so a grant failure does not masquerade as a consent failure.

## 3. catch {} swallows the persistence error with no logging — silent loss of diagnostic signal on consent-save failures
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: server-action error swallowing / observability
- **File**: src/app/welcome/actions.ts:63-67
- **Scenario**: Any throw from the grant or the consent transaction is caught by a bare `catch {}` that returns a friendly string. The actual error (DB constraint, Firestore permission, network) is discarded — never logged, never surfaced to telemetry. If consent saves start failing in production (e.g. a Firestore rules regression on the `consents` collection), you get user complaints of "it won't let me agree" with zero server-side breadcrumb.
- **Root cause**: The `catch` binds no error and contains no `console.error`/logger call. For a legal-consent write — the highest-integrity operation in onboarding — total error opacity is dangerous.
- **Impact**: Consent-save outages are undiagnosable from logs; you cannot distinguish "DB down" from "rules misconfig" from "validation". Combined with finding #2, you can't even tell whether the failing write was the grant or the consent.
- **Fix sketch**: `catch (err) { console.error("consent submit failed", { userId: user.id, err }); return {...} }` (or the app's logger). Keep PII out of the message but record enough to triage. Optionally split per-write so logs say which write failed.

## 4. No success/redirect feedback or post-submit lockout window — button re-enables before navigation, allowing a stray second submit
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: double-submit / loading-state completeness
- **File**: src/components/ConsentForm.tsx:24-27, 87-94
- **Scenario**: `useActionState` sets `pending` true during the action and disables the submit button (good, blocks the obvious double-click). But on the *success* path the action ends in `redirect("/dashboard")` (a thrown NEXT_REDIRECT). Between the action resolving and the browser actually navigating, `pending` flips back to false and the button re-enables with its original "Agree & open my case file" label — there is no success/"opening your file…" terminal state. On a slow network a user can click again during that gap, firing a second consent submit (append-only `consents` → a duplicate consent row for the same version).
- **Root cause**: The form has only two visual states (idle / pending) and no terminal "submitted, navigating" state; `pending` is treated as the whole lifecycle. The consents table has no per-(user,version) uniqueness, so a duplicate submit silently double-writes.
- **Impact**: Minor data noise (duplicate consent rows) and a brief window where the UI looks idle/clickable while a redirect is in flight — perceived as unresponsive, and a second click is not clearly prevented. Low blast radius but real on slow connections.
- **Fix sketch**: Track a `submitted` flag (set on success) to keep the button disabled + show "Opening your case file…" until navigation completes; or add a DB uniqueness constraint on `(user_id, consent_version)` for idempotency; or use `useFormStatus` in a child and render a distinct success state.

## 5. Required-state is conveyed only visually (aria-hidden `*`); checkboxes lack programmatic required indication and the legend isn't tied as a group label
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: a11y / required-field indication
- **File**: src/components/ConsentForm.tsx:58-76, 118-123
- **Scenario**: Terms and Privacy checkboxes carry the HTML `required` attribute (good — native validation fires), but the visible "required" marker is an `aria-hidden` red `*`, and there is no `aria-required`/textual "(required)" in the accessible name. A screen-reader user hears "I accept the Terms of Service, checkbox" with no signal that it is mandatory until the browser's native validation message appears on submit. The `<legend>` "Consent & agreements" groups the fieldset visually, but the individual checkbox labels don't reference it, so the grouping context is weak in some AT.
- **Root cause**: Required-ness is communicated purely through a decorative, `aria-hidden` glyph; the semantic `required` attribute helps validation but isn't reinforced in the label text for AT users.
- **Impact**: Screen-reader users (a meaningful slice of an immigration audience, many ESL/assistive-tech users) only discover the fields are mandatory by triggering a validation error, degrading the consent UX for exactly the population that most needs clarity before agreeing.
- **Fix sketch**: Append a non-hidden "(required)" to required checkbox labels (or add `aria-required="true"` and an `aria-describedby` note), and/or include the word "required" in the accessible name rather than relying on the `aria-hidden` asterisk. Keep the visual `*` but make the meaning available to AT.
