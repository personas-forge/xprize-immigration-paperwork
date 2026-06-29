# Code Refactor — Authentication & Session
> Total: 5
> Critical: 0 | High: 0 | Medium: 2 | Low: 3

Context note: the 2026-06-23 refactor pass left this boundary genuinely clean. I
verified the prompt's two suspected hotspots and BOTH are non-issues:
- The two firebase admin modules do NOT overlap — `firebase/admin.ts` returns an
  `Auth` handle, `firestore/admin.ts` returns a `Firestore` handle, and both
  delegate the single `initializeApp` to the shared `firebase/adminApp.ts`
  (`ensureAdminApp`). Clean separation, not duplication.
- `server-only.d.ts` is NOT dead — `import "server-only"` is used by ~9 modules
  (`session-cookie.ts`, `tokens/guard.ts`, `tokens/ledger.ts`, `polar/client.ts`,
  `llm/client.ts`, `cost-telemetry.ts`, `data/petitions.ts`, …), so the ambient
  declaration is load-bearing for `tsc`.
- No dead exports in scope: `isConfiguredOps` / `canReviewQueue` (used by
  dashboard + review pages + petition adapter), the consent/export delegators in
  `auth/db.ts` (used by account page/actions + `api/me/export`), and
  `isMeteringEnforced` / `isStoreConfigured` are all live.

## 1. `authProvider()` `explicit` branch never changes the result — `NEXT_PUBLIC_AUTH_PROVIDER` is a no-op config knob
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/lib/auth/provider.ts:16-21 (env read at :17); documented as a real knob at .env.example:70-72
- **Scenario**: A deploy sets `NEXT_PUBLIC_AUTH_PROVIDER=firebase` (per `.env.example`) expecting it to *force* the provider. It does nothing the auto-detection wouldn't already do; an operator who set it to any other value would silently get the same Firebase-or-null behavior.
- **Root cause**: Trace every path:
  `if (explicit === "firebase") return isFirebaseConfigured() ? "firebase" : null;`
  then `if (isFirebaseConfigured()) return "firebase"; return null;`. Whatever
  `explicit` is, the function returns exactly `isFirebaseConfigured() ? "firebase" : null`. The `explicit` read and its branch are pure dead logic. `AuthProvider` is also a single-member union (`"firebase"`), so the whole "provider selector" is over-abstracted scaffolding for a Firebase-only app.
- **Impact**: A documented env var (`.env.example`) implies configurability that doesn't exist — misleading for operators and a maintenance trap (someone may "fix" the knob by adding cases, reintroducing branches). Dead branch + dead env read.
- **Fix sketch**: Reduce the body to `return isFirebaseConfigured() ? "firebase" : null;`, drop the `explicit` read, and delete the `NEXT_PUBLIC_AUTH_PROVIDER` line + comment from `.env.example` (or, if a real override is wanted later, make it actually able to return a non-firebase value). Update the doc comment at :6-9 accordingly.

## 2. `if (typeof window !== "undefined") throw …` server-only guard hand-copied 8× across the auth/persistence boundary, with drifted rationale comments
- **Severity**: Medium
- **Category**: consolidation
- **File**: src/lib/auth/session.ts:3-5; src/lib/auth/db.ts:5-7; src/lib/auth/authorizeRoute.ts:8-10; src/lib/firebase/admin.ts:5-7; src/lib/firebase/adminApp.ts:5-7; src/lib/firestore/admin.ts:6-8; src/lib/db/firestore-store.ts:22-24; src/lib/db/pglite-store.ts:8-10 (also tokens/ledger.ts:5 outside scope)
- **Scenario**: A new server-only module in this boundary is added; the author copies the 5-line guard and an ad-hoc module-name string, as the previous 8 did.
- **Root cause**: The team deliberately avoids `import "server-only"` in the test-reachable modules (the `tsx --test` runner can't resolve Next's bundled alias), so each module re-inlines the same client-import guard. The *justification comments* have since drifted and become inaccurate: `authorizeRoute.ts:2` says the package "isn't installed and is unresolvable", `session.ts:1-2` says it "isn't a dependency of this app" — yet sibling modules (`session-cookie.ts`, `tokens/guard.ts`) import `server-only` successfully (it's bundled by Next; `server-only.d.ts` satisfies `tsc`). Only `operation.ts:2` carries the correct "unresolvable under the `tsx --test` runner" qualifier.
- **Impact**: 8 identical guards = 8 places to keep in sync; the contradictory comments mislead the next reader about *why* the guard exists (it's the unit-test runner, not "not installed").
- **Fix sketch**: Add a tiny zero-dependency `src/lib/serverOnlyGuard.ts` exporting `assertClientFree(moduleName: string)` that does the `typeof window` throw, and call it at the top of each module (`assertClientFree("@/lib/auth/session")`). It's import-light, so it's safe even for the test-reachable modules. Collapse the three divergent justification comments to one accurate line.

## 3. `pglite-store.ts` re-inlines the same null-safe date→ISO conversion ~6× while an `iso()` helper sits scoped inside one function
- **Severity**: Low
- **Category**: duplication
- **File**: src/lib/db/pglite-store.ts — helper defined locally at :842; the same expression hand-inlined at :224-230 (toStoredCase), :280 (toLedgerEntry), :301-303 (getProfile), :348 (getConsentHistory), :734-736 (getReviewEvents)
- **Scenario**: Reading any persisted timestamp; every method re-writes `x ? new Date(x as string).toISOString() : null`.
- **Root cause**: `const iso = (v) => (v ? new Date(v as string).toISOString() : null)` already exists — but it's declared *inside* `exportUserData` (:842) and reused only there. Every other method re-implements the identical guarded conversion inline.
- **Impact**: ~6 copies of one trivially-shareable conversion; a change to the timestamp-coercion policy (e.g. handling a numeric epoch) has to be applied in 6 spots. Sits right next to the module-level `num`/`str` helpers (:197-198) that exist for exactly this reason.
- **Fix sketch**: Hoist `iso` to module scope beside `num`/`str` and replace the inline expressions (and the local copy in `exportUserData`) with it.

## 4. `grantSignupTokens` (Firestore) copy-pastes `credit`'s "refund clawback (negative amount)" floor comment onto an always-positive grant, and floors where the PGlite twin doesn't
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/db/firestore-store.ts:350-353 (comment 350-352, `Math.max(0, cur + amount)` at :353); compare credit's legitimate use at :319-322; PGlite twin omits the floor at src/lib/db/pglite-store.ts:472
- **Scenario**: A reader of the signup-grant path sees a comment about "a refund clawback (negative amount)" — but `grantSignupTokens` only ever receives the positive `FREE_SIGNUP_GRANT`; a clawback can never reach it.
- **Root cause**: The block was copied verbatim from `credit` (where the negative-amount floor is real). In `grantSignupTokens` the `Math.max(0, …)` is dead (amount > 0) and the comment is false. The PGlite driver's `grantSignupTokens` (:472) correctly uses a plain `cur + amount`, so the two drivers also disagree on shape for the same method.
- **Impact**: Misleading comment on a money path + a needless guard + cross-driver inconsistency that invites "are these supposed to differ?" confusion during audits.
- **Fix sketch**: In the Firestore `grantSignupTokens`, drop the clawback comment and use `cur + amount` to match the PGlite driver (signup amount is invariantly positive). Leave `credit`'s floor — that one is real.

## 5. Middleware comment names the dev-only `__session` cookie though production uses `__Host-session`
- **Severity**: Low
- **Category**: cleanup
- **File**: src/middleware.ts:20 (comment) vs :35 (code reads the `SESSION_COOKIE` constant); cookie name resolved in src/lib/firebase/config.ts:29-30
- **Scenario**: A reader debugging a prod login loop greps for `__session`, per the middleware comment, and never finds the actual prod cookie (`__Host-session`).
- **Root cause**: The comment hardcodes `__session` (the dev name) while the code correctly uses `SESSION_COOKIE`, which is `__Host-session` in production. The comment predates / didn't track the `__Host-` prefix change.
- **Impact**: Minor — stale doc that can misdirect a prod-cookie investigation. Code behavior is correct.
- **Fix sketch**: Change the comment to reference the `SESSION_COOKIE` constant (or "the session cookie (`__Host-session` in prod, `__session` in dev)") instead of the literal `__session`.
