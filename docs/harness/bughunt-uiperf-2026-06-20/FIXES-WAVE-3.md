# Bug Hunter + UI Perfectionist — Fix Wave 3: Security boundary

> 3 commits, 8 findings closed (1 Critical, 6 High, 1 Medium).
> Baseline preserved: tsc 0 → 0, tests 389 → 393 pass (+4 new), lint clean.
> Mental model: *trust boundaries must fail closed — header trust, session
> revocation, redirect targets, and command construction.*

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `15be8e8` | rate-limit #1 (C), #2, #3 | tokens/rate-limit.ts (+test) |
| 2 | `c9d72f0` | auth #1, #2, #3, #4 | safe-next.ts (+test), login, welcome, ConsentForm, signout, session route, session.ts |
| 3 | `f853a7b` | llm-engine #1 | llm/engines.ts |

## What was fixed

1. **IP-keyed limiter fully bypassable (rate-limit #1, CRITICAL).** `clientIp`
   took the LEFTMOST `x-forwarded-for` hop — the client's claim. Rotating it minted
   a fresh bucket per request, so the cap on the anonymous AI/preview routes was
   never reached (real Gemini cost + DoS). Now takes the **rightmost-minus-N**
   trusted-edge hop (`TRUSTED_PROXY_HOPS`); non-IP/absent → shared `anon` bucket.
2. **Most-spoofable hop + griefing (rate-limit #2).** Same root; the rightmost
   selection also stops an attacker impersonating a victim's IP bucket.
3. **Unbounded bucket Map (rate-limit #3).** Expiry-only pruning is defeated by an
   in-window rotation burst (nothing expired yet). `enforceCap` hard-evicts the
   entries closest to expiry so the Map can't exceed the ceiling (memory-DoS).
4. **Sign-out didn't revoke (auth #1).** Deleting the local cookie left a
   copied/stolen bearer cookie valid for 5 days. Both sign-out paths now
   `revokeRefreshTokens(uid)` first; `checkRevoked=true` rejects every copy.
5. **Open-redirect + dead deep-linking (auth #2/#3).** `safeNext()` accepts only a
   same-origin relative path; `next` is now wired login → /welcome → consent,
   re-validated at each hop, so deep links work AND can't redirect off-site.
6. **Opaque admin failure (auth #4).** `getUser()` now logs the UNEXPECTED catch
   branch (admin/credential outage) so a "everyone signed out" incident is
   diagnosable instead of a silent infinite login loop.
7. **Shell-injection / Windows breakage (llm #1).** The Claude CLI bin path was
   interpolated unquoted into a `shell:true` string. Now quoted (handles
   `C:\Program Files\…`) and rejected if it contains shell metacharacters.

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 389 pass | 393 pass (+4) |
| eslint (changed) | — | clean |

## Patterns established (catalogue items 9-12)

9.  **Validating that a header is well-formed ≠ trusting it.** `x-forwarded-for`
    is fully client-controlled; an `isValidIp` check on the leftmost hop still
    lets an attacker rotate valid literals. Derive identity from a TRUSTED
    position (edge-appended hop / connection IP), not from a syntactic check.
10. **An eviction policy must bound the worst case, not the average.** "Drop
    expired on overflow" fails exactly when overflow is caused by live entries.
    A cap that can be exceeded isn't a cap — hard-evict to hold the ceiling.
11. **Deleting a bearer credential locally ≠ revoking it.** Cookie/session/token
    sign-out must invalidate the credential server-side; the local delete only
    cleans the one browser that asked.
12. **Capture-but-don't-validate is how open redirects ship.** A `?next=` written
    by trusted middleware is still attacker-controllable via the URL — every
    consumer must route it through a same-origin allowlist before redirecting.

## What remains

Waves 4-8 per INDEX. Remaining criticals: petition-drafting "Saved ✓"
false-success (W4), 2× eval-harness false-green (W5). Deferred from this wave:
rate-limit #4 (byUser anon fallback, M), #5 (single-node doc, M); auth #5
(/welcome edge protection, L).
