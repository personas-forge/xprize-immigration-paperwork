# Code Refactor — Authentication & Session
> Total: 5 (C0/H2/M3/L0)

## 1. Session-revoke + cookie-clear logic duplicated across two route handlers
- **Severity**: High
- **Category**: duplication
- **File**: src/app/api/auth/session/route.ts:59-74 (DELETE) and src/app/auth/signout/route.ts:23-35 (`revokeAndClearSession`)
- **Scenario**: Both handlers run byte-near-identical "best-effort revoke" boilerplate: read `SESSION_COOKIE` from the jar, `verifySessionCookie(cookie)` → `revokeRefreshTokens(decoded.uid)` inside a try/catch that `console.error`s, then `jar.delete(SESSION_COOKIE)`. The signout route already EXPORTS a reusable `revokeAndClearSession()`, yet the session-route DELETE re-inlines the same sequence instead of importing it. Grep: `Grep "revokeAndClearSession"` → defined+called only in signout/route.ts; the DELETE handler never imports it. The two copies differ only in the log prefix (`[auth/session]` vs `[signout]`).
- **Root cause**: The shared "kill the server-side session" operation was extracted into a named export in one route but not adopted by the sibling route that does the exact same thing.
- **Impact**: Two copies of a security-sensitive sequence (revoke-then-clear). A future hardening change (e.g. also clearing a refresh cookie, swallowing a new error code, switching to `revokeRefreshTokens` retry) must be made in both or the two sign-out paths silently diverge — exactly the divergence class that lets a stolen cookie outlive one path but not the other.
- **Fix sketch**: Have the DELETE handler `import { revokeAndClearSession } from "@/app/auth/signout/route"` (or hoist `revokeAndClearSession` into a small `@/lib/auth/session-cookie.ts` and import from both). DELETE becomes `await revokeAndClearSession(); return Response.json({ ok: true });`. One copy, one log prefix.

## 2. Consent-row write duplicated inside each store driver (upsertProfileWithConsent vs recordConsent)
- **Severity**: High
- **Category**: duplication
- **File**: src/lib/db/firestore-store.ts:148-157 & 215-224; src/lib/db/pglite-store.ts:276-290 & 322-337
- **Scenario**: Appending a consent/preference row is hand-rolled twice in EACH driver. Firestore: `upsertProfileWithConsent` writes `consents` with `{ user_id, consent_version, terms_accepted, privacy_accepted, marketing_opt_in, ip, user_agent, created_at }` (148-157), and `recordConsent` writes the identical object (215-224) — the inline comment at 213 even says "same shape … but WITHOUT the profile mutation". PGlite: the same `insert into consents (user_id, consent_version, terms_accepted, privacy_accepted, marketing_opt_in, ip, user_agent) values ($1…$7)` statement + its 7-element params array is copy-pasted in `upsertProfileWithConsent` (276-290) and `recordConsent` (322-337). This is per-driver duplication, NOT the intentional cross-driver Store-interface pattern.
- **Root cause**: The append-only consent insert was written first inside the upsert path, then copy-pasted into `recordConsent` rather than factored into one private helper per driver.
- **Impact**: A schema change to the consent record (new column, e.g. a consent-source or locale field) must be edited in four places. Miss one and the marketing-opt-in path writes a different row than the onboarding path — a compliance-audit divergence on the exact table whose whole purpose is a faithful "what they agreed to" trail.
- **Fix sketch**: Per driver add a private `appendConsentRow(input, txOrDb)` — Firestore: one function building the consent doc, called with `t` (transaction) from the upsert and with `adminDb()` from `recordConsent`; PGlite: one function taking a `Queryable` (it already abstracts `pg` vs `tx`) that runs the single insert. Both `recordConsent` and the consent half of `upsertProfileWithConsent` call it. No driver merge.

## 3. Ledger-entry projection duplicated within firestore-store (getLedgerForUser vs exportUserData)
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/db/firestore-store.ts:248-254 and 752-758
- **Scenario**: The mapping of a raw `token_ledger` doc to a `LedgerEntry` is identical in two methods: `{ delta: Number(v.delta ?? 0), reason: String(v.reason ?? ""), operation: v.operation == null ? null : String(v.operation), balanceAfter: Number(v.balance_after ?? 0), createdAt: tsToIso(v.created_at) }`. Grep: `Grep "balanceAfter: Number\(v.balance_after"` → two hits in this file (252, 756). `getLedgerForUser` sorts+slices; `exportUserData` sorts only — but the per-row shaping is the same five lines.
- **Root cause**: The export bundle method re-implemented the ledger row mapping instead of reusing the read method's projection.
- **Impact**: A new `LedgerEntry` field (or a coercion fix) has to land in both spots; otherwise the billing read-out and the GDPR export report different ledger shapes for the same rows.
- **Fix sketch**: Add a module-level `toLedgerEntry(v: Record<string, unknown>): LedgerEntry` next to `toStoredCase`/`tsToIso` and call `.map(toLedgerEntry)` in both methods. (The PGlite driver has the same twin in `getLedgerForUser`/`exportUserData`; a matching local `toLedgerEntry` there is the parallel cleanup — still per-driver, no merge.)

## 4. `requireOnboardedUser` carries a ~20-line essay comment + dead "marketing" rationale inline
- **Severity**: Medium
- **Category**: cleanup
- **File**: src/lib/auth/session.ts:134-148
- **Scenario**: The consent-version re-prompt block is 4 lines of code wrapped in ~14 lines of comment, including a long "INTENT (recorded)" paragraph (138-144) explaining why marketing preference is deliberately NOT a re-prompt trigger — narrating a decision about code that isn't here (there is no marketing check in this function at all). The actual logic is just: `if (!isDevAuth()) { const consented = await getLatestConsentVersion(user.id); if (consented !== CONSENT_VERSION) redirect("/welcome"); }`.
- **Root cause**: Design-discussion prose accreted in the function body over successive consent/onboarding passes instead of being condensed to the one load-bearing sentence (or moved to an ADR).
- **Impact**: The signal-to-noise ratio buries the actual gate; a reader must parse a "why we DON'T do X" essay to confirm the function only keys on version. Comment drift risk — the prose references behavior in sibling modules that could change without this note updating.
- **Fix sketch**: Collapse to ~2 lines: "Re-prompt when the accepted consent version is behind CONSENT_VERSION. Marketing preference is mutable independently (see account page) and intentionally not a trigger — full rationale in ADR/consent docs." No behavior change.

## 5. `setCaseStatus` has no domain call site — only the event-proxy keeps it alive (attractive-nuisance API)
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/lib/db/store.ts:311-316 (interface), firestore-store.ts:440-450, pglite-store.ts:566-580
- **Scenario**: `setCaseStatus` is an unconditional status writer; `transitionCase` (store.ts:317-324) is the guarded compare-and-set superset that also appends review events atomically and is the documented way to change case status. Grep `Grep "setCaseStatus"` over `src/`: the ONLY non-test references are (a) the interface + two driver bodies, and (b) `lib/events/store-events.ts:54-60`, where the `withDomainEvents` proxy intercepts the method NAME to emit `CaseStatusChanged`. There is NO actual `.setCaseStatus(...)` invocation in any route, server action, or `lib/data/*` (`lib/data/reviews.ts:7` only mentions it in a comment) — every real status change goes through `transitionCase`. So the method is reachable but un-invoked: it survives only because the event proxy and a test enumerate its name.
- **Root cause**: An earlier unguarded status setter was kept on the interface (and threaded through the event proxy) after the atomic `transitionCase` replaced its use, leaving a redundant method every driver must carry.
- **Impact**: Three implementations (~25 LOC) plus a `case "setCaseStatus":` arm in the event proxy + a dedicated test, all for a method nothing calls — and it bypasses the compare-and-set safety the team standardized on, so it's an attractive nuisance: a future call site could reach for the unguarded setter by autocomplete and reintroduce illegal/double transitions.
- **Fix sketch**: Remove `setCaseStatus` from the `Store` interface, both driver bodies, the `store-events.ts` switch arm, and its unit test; route any future guarded change through `transitionCase`. (Lower-effort alternative if you'd rather keep the seam: leave it but add a doc note that `transitionCase` is the only sanctioned status mutator.) Confirm once more there's no dynamic/string dispatch before deleting.
