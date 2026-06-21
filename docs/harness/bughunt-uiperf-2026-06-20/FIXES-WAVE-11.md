# Fix Wave 11 — Money truth & rate-limit integrity (deferred-backlog)

> 4 commits, 7 findings closed (1 Critical, 4 Medium, 2 Low).
> Baseline preserved: tsc 0 → 0, tests 405 → 408 pass (+3 new), lint clean, `next build` PASS (46/46 pages).
> Mental model: *every cent is accounted for exactly once, and the cap a money
> action advertises is the cap it enforces — no double-debit, no fan-out evasion,
> no price the grid can't honor.*

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `70f5484` | token #3 (C), checkout #3 (M), token #4 (M) | db/firestore-store.ts, db/pglite-store.ts, polar/webhook/route.ts, dev/grant-tokens/route.ts |
| 2 | `6091f47` | rate-limiting #4 (M), #5 (L) | ai/operation.ts (+test), tokens/rate-limit.ts |
| 3 | `0797d98` | rfe #3 (M) | features/rfe/forecastOperation.ts |
| 4 | `a809000` | checkout #5 (L) | tokens/economy.ts (+test), billing/BundleGrid.tsx, app/page.tsx |

## What was fixed

1. **Debit could double-charge on a retried request (token #3, C).** `charge`
   keyed only on the ledger `(ref, reason)` pair, but a retried operation reused
   the same `ref` with a fresh attempt — the second debit went through. Both
   drivers now make the debit idempotent: Firestore writes a deterministic
   `debit_${ref}` ledger doc and returns early if it already exists; PGlite
   short-circuits when a `(ref, reason='debit')` row is already present. A retry
   reads the prior balance instead of charging again.
2. **Refund clawback could drive a balance negative / throw (checkout #3, M).**
   `credit`/`grantSignupTokens` floored the post-credit balance at 0
   (`Math.max(0, cur + amount)`) — PGlite's `check (balance >= 0)` would otherwise
   THROW on an over-refund and abort the webhook. The Polar webhook also now logs
   an explicit `refund NOT clawed back: …` line when a reversal can't resolve a
   user/bundle/order, so the gap is observable for reconciliation instead of a
   silent 200.
3. **Explicit dev grant of 0 minted 1000 tokens (token #4, M).** `Number(amount)
   || 1000` treated an explicit `0` (and any non-finite value) as the 1000 default.
   Now `Number.isFinite(raw)` gates the default and the amount is clamped to
   `[1, 1_000_000]` and truncated; the requested value is echoed into metadata.
4. **Anonymous byUser traffic was keyed per-IP (rate-limiting #4, M).** For a
   `byUser` op with no authenticated caller, the limiter fell back to the
   spoofable client IP — an attacker rotating `x-forwarded-for` minted a fresh
   bucket per request, defeating the IP-rotation guarantee byUser exists for.
   An absent user now resolves to a shared `:u:anon` bucket (bounded by the map
   ceiling). New test asserts `rfe:u:anon`, never `:ip:`.
5. **Single-node limiter read as global (rate-limiting #5, L).** Documented above
   `globalBuckets` that counts are per-process — caps multiply under horizontal
   scaling and reset on cold start / HMR — and that the injectable `store` param
   is the seam for a shared (Redis/Upstash) backend.
6. **Attorney could draft but not forecast (rfe #3, M).** The forecast DB path
   built `CaseAccess` with `email: null`, so `resolveCase`'s configured-attorney
   leg never ran — an attorney-of-record got 403 on the RFE Risk Radar yet 200 on
   the actual draft. Forecast now passes `email: user.email ?? null`, authorizing
   identically to the responder.
7. **Ad-hoc currency strings + quiet a11y gap on the purchase button
   (checkout #5, L).** Bundle prices were hand-authored display strings ("$5",
   "$19/mo") while the per-token rate was computed — two conventions, neither
   locale-aware. `priceCents` is now the source of truth and every label is
   derived through a shared `Intl.NumberFormat` (`formatUsdCents` /
   `bundlePriceLabel` / `formatCentsPerToken`); a consistency test asserts
   `priceCents / tokens ≈ centsPerToken` so the grid can't advertise a discount it
   won't honor. The in-flight checkout button gained `aria-busy` and a polite
   `role="status"` live region ("Opening checkout…") so screen-reader users hear
   that a money action started.

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 405 pass | 408 pass (+3) |
| eslint (changed) | — | clean |
| next build | PASS | PASS (46/46 pages) |

## Patterns established (catalogue items 29-30)

29. **A charged operation must be idempotent on its request key, not just its
    ledger key.** A retry that reuses the same `ref` will double-debit unless the
    write itself short-circuits on a prior debit row/doc — flooring balances and
    logging the gap is necessary but not sufficient.
30. **A spoofable identity must collapse to a shared bucket, never fan out.** Any
    limiter / quota keyed on client-controlled input (XFF, anon id) needs a single
    catch-all key bounded by a hard ceiling, or the cap is bypassable by rotation.

## Remaining backlog

W13 (a11y polish, ~9 M/L), W14 (content/component drift, ~7 M/L). Wave 12 descoped.
No criticals remain; no Highs remain.
