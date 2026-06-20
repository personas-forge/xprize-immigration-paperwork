> Total: 5 | Critical: 0 | High: 3 | Medium: 1 | Low: 1
> Context: Authentication & Session
> Lens mix: bug-hunter 4, ui-perfectionist 1

## 1. Sign-out never revokes the Firebase session cookie — a copied cookie stays valid for 5 days
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: Session handling / session fixation
- **File**: src/app/auth/signout/route.ts:7 · src/app/api/auth/session/route.ts:59-62 · src/lib/auth/session.ts:78
- **Scenario**: A user signs in on a shared/compromised machine. An attacker copies the `__session` / `__Host-session` cookie value. The user clicks "sign out". Both sign-out paths only call `cookies().delete(SESSION_COOKIE)`, which clears the cookie *in the user's browser*. The attacker's copied cookie is untouched and keeps authenticating for the full `SESSION_EXPIRES_MS` (5 days).
- **Root cause**: Sign-out deletes the local cookie but never calls `adminAuth().revokeRefreshTokens(uid)`. `getUser()` verifies with `verifySessionCookie(cookie, true)` (checkRevoked=true) — that machinery is *designed* to reject post-revocation cookies, but nothing ever revokes, so the `checkRevoked` flag buys no protection on sign-out. A Firebase session cookie is a bearer credential; deleting one copy does not invalidate the others. `grep revokeRefreshTokens` over `src/` returns zero hits.
- **Impact**: Sign-out is not a real logout. Stolen/copied session cookies survive an explicit sign-out for up to 5 days, on a product holding immigration applicants' PII. Also defeats "sign out everywhere" expectations after a password/account compromise.
- **Fix sketch**: In the DELETE handler (and `/auth/signout`), before deleting the cookie, verify it (`verifySessionCookie`, ignore errors) to recover the uid, then `await adminAuth().revokeRefreshTokens(uid)`. Because `getUser()` already passes `checkRevoked=true`, revoked cookies are then rejected immediately. Keep the cookie delete for the local browser.

## 2. `next` redirect target is dropped on login — deep-linked protected URLs always dump the user at /welcome→/dashboard
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: Redirect-after-login correctness / UX
- **File**: src/app/login/page.tsx:40 · src/middleware.ts:38
- **Scenario**: Unauthenticated user opens a deep link, e.g. `/dashboard/cases/abc/draft`. Middleware redirects to `/login?next=/dashboard/cases/abc/draft` (it carefully captures the original path). User signs in. The login handler hardcodes `window.location.href = "/welcome"`, completely ignoring the `next` param. `next` is set by middleware but consumed by *nothing* (`grep` for any `next` consumer returns zero hits). The user lands on the dashboard root and must re-navigate to where they were going.
- **Root cause**: The success path in `signInWithGoogleFirebase()` is a constant redirect to `/welcome`; the `next` search param is never read (no `useSearchParams`). `/welcome` itself also hardcodes `/dashboard`.
- **Impact**: Broken deep-linking; every interrupted-by-auth navigation loses its destination. Minor on its own, but the dead `next` plumbing invites #3 (an unsanitized re-introduction later) — and right now the careful middleware capture is pure dead weight.
- **Fix sketch**: Read `next` via `useSearchParams()` in the login page; after `/welcome` onboarding completes, forward to a validated `next`. CRITICAL: do not redirect to a raw `next` — gate it through a same-origin/relative-path allowlist (see #3) before any `window.location` / `redirect` assignment.

## 3. When `next` is wired up, it must be validated — current dead plumbing is an open-redirect waiting to ship
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: Open redirect (latent)
- **File**: src/middleware.ts:38 · src/app/login/page.tsx:40
- **Scenario**: Middleware writes the raw request path into `?next=`. The obvious "fix" for #2 is `window.location.href = searchParams.get("next") ?? "/welcome"`. An attacker then crafts `/login?next=https://evil.example/phish` (or `//evil.example`, or `/\evil.example`). The victim signs in on the *real* domain and is bounced to the attacker's look-alike, having just proven the site is trustworthy — a classic post-auth open redirect / phishing pivot.
- **Root cause**: There is no `next`-sanitization helper anywhere in the codebase (no `safe-next`, no allowlist check). Because the value is currently unused the danger is dormant, but the capture-but-don't-validate pattern is exactly how open redirects get introduced. `next.searchParams.set("next", path)` stores a server-controlled path today, yet nothing guarantees a future consumer restricts it to a relative same-origin path.
- **Impact**: Latent Critical-class open redirect on the auth flow the moment #2 is naively implemented. Flagging now so the fix for #2 ships *with* validation, not after an incident.
- **Fix sketch**: Add a `safeNext(raw): string` guard that accepts ONLY values starting with a single `/` and not `//` or `/\` (reject absolute URLs, protocol-relative, and backslash tricks), defaulting to `/dashboard`. Route every `next` consumer through it. Consider URL-decoding once and re-checking to defeat encoded `//`.

## 4. firebase-admin init failure is opaque and per-call — a missing/instant-expired credential surfaces as a blanket 401/"signed out", not a 503
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: Auth fail mode / availability + observability
- **File**: src/lib/firebase/adminApp.ts:17-24 · src/lib/auth/session.ts:78-89
- **Scenario**: In production `ensureAdminApp()` uses `applicationDefault()` credentials. If ADC is misconfigured/expired/lacks the IAM token-creator role, `verifySessionCookie()` throws. `getUser()` catches *every* throw and returns `null` (treated as "not signed in"). The protected layout then `redirect("/login")`. Every authenticated user is silently logged out, the login page works (POST mints a cookie), they bounce straight back to /login — an infinite, undiagnosable auth loop. Meanwhile middleware sees the cookie present and lets them through to the layout, so the failure only shows deep in the Node runtime.
- **Root cause**: `getUser()`'s single `catch {}` cannot distinguish "cookie genuinely invalid/expired/revoked" (correct → null) from "admin SDK can't verify ANYTHING right now" (infra outage → should be a 5xx / surfaced error). The session route logs admin errors (`console.error`), but the read path swallows them with no log and no signal. `ensureAdminApp()` also re-attempts `initializeApp` semantics only via `getApps().length`, so a partially-initialized/failed app state isn't distinguished.
- **Impact**: A credential/IAM regression manifests as "all users mysteriously signed out" with zero server logs from the read path — high MTTR, and indistinguishable from a real auth bug during an incident. PII workflow becomes globally inaccessible.
- **Fix sketch**: In `getUser()`, inspect the caught error's Firebase code: treat `auth/session-cookie-expired|revoked|invalid|argument-error` as → `null`; rethrow/log (and let the layout render a 503-ish error boundary) for credential/transport errors (`auth/internal-error`, ADC failures). At minimum `console.error` the unexpected branch so infra failures are observable.

## 5. Middleware matcher runs auth logic on every non-asset path but only the presence check is cheap; the protected set silently excludes /welcome (which holds the consent PII form)
- **Severity**: Low
- **Lens**: bug-hunter
- **Category**: Route protection scope / defense-in-depth
- **File**: src/middleware.ts:8-13,35 · src/app/welcome/page.tsx:13-14
- **Scenario**: `PROTECTED_PREFIXES = ["/dashboard"]` only. `/welcome` (the first-auth consent + name/email form) is NOT in the matcher's protected set, so middleware never edge-redirects an unauthenticated hit. `/welcome`'s page DOES self-gate (`getUser()` → `redirect("/login")`), so there is no actual unauth access today — but the protection lives solely in the page body, not at the edge, unlike `/dashboard`. Any future `/welcome`-adjacent route added without its own gate inherits zero edge protection.
- **Root cause**: The middleware presence-check and the real verification (`requireOnboardedUser` / page-level `getUser`) are two different gates with two different route sets that have drifted: `/dashboard` is gated in both, `/welcome` only in the page. The comment claims marketing pages stay public, but `/welcome` is not a marketing page.
- **Impact**: No live bug (page self-gates), so Low. But it's a single-point-of-failure for a PII consent surface: protection depends on remembering to re-add the page-level `getUser()` guard on every new authenticated route, with no edge backstop.
- **Fix sketch**: Add `/welcome` to `PROTECTED_PREFIXES` so the edge also requires a session cookie there (it still self-redirects onboarded users to /dashboard). Document that authenticated routes must be added to `PROTECTED_PREFIXES`, keeping the edge presence-check and the Node-runtime verification route sets in sync.
