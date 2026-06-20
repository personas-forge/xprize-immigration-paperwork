# Bug Hunter + UI Perfectionist — Fix Wave 2: Money & metering integrity

> 5 commits, 7 findings closed (7 High) + 1 folded Medium (ai-operation #5).
> Baseline preserved: tsc 0 → 0, tests 383 → 389 pass (+6 new), lint clean.
> Mental model: *every paid path must charge correctly or not at all — no
> charge-without-output, no minted tokens, no silently-lost work.*

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `fbe6206` | ai-operation #1, #2 (+#5 folded) | ai/operation.ts (+test) |
| 2 | `891c345` | token #1, #2 | tokens/ledger.ts (+test), firestore-store.ts |
| 3 | `526efee` | checkout #1, #2 | api/checkout/route.ts, api/polar/webhook/route.ts |
| 4 | `e09fce6` | evidence #1 | api/evidence/categorize/route.ts, EvidenceVault.tsx |
| 5 | `e2ed854` | rfe #1 | rfe/forecastOperation.ts, rfe.ts (+index, +test) |

## What was fixed

1. **Guard ran inside the model try → billed parser regression silently mocked
   (ai #1).** `spec.guard()` now runs OUTSIDE the model try on the returned text;
   a guard *throw* is a parser regression on an already-PAID response — logged
   loudly and reclaimed, not swallowed as a normal keyless mock. Folded ai #5: a
   `reclaim()` helper refunds at most once and can't escalate a serviceable mock
   into a 500.
2. **Adjudication ran on mocks (ai #2).** A deterministic template's "risk score"
   is theater on a UPL surface — gated on `source !== "mock"`.
3. **Firestore balance had no NaN/non-negative backstop (token #1).** One corrupt
   value made `NaN < cost` false → debits "succeed", write NaN back, free-spend
   forever. `safeBalance()` coerces every read to a finite non-negative int
   (fail-closed to 0) and logs corruption. PGlite was already safe (integer +
   CHECK); the drivers no longer diverge.
4. **Ledger trusted its callers (token #2).** A negative `cost` inverts a debit
   into a credit; a huge amount overflows. Added boundary guards in ledger.ts
   (the one chokepoint): charge/grant require a non-negative bounded integer;
   credit allows negative (refund) but bounded + finite + integer.
5. **Webhook trusted metadata over the paid product (checkout #1).** `productId`
   (signed, paid) is now authoritative; `metadata.bundle` is a fallback, and a
   disagreement credits the PAID bundle (was a possible 60x mint).
6. **Renewals could be uncreditable (checkout #2).** Checkout sets
   `externalCustomerId`; the webhook falls back to it so subscription cycle
   orders without per-order metadata still credit the right user (no retry-storm).
7. **Charged but document lost (evidence #1).** A failed case-backed save now
   emits `saveFailed`; the vault warns instead of showing a phantom doc.
8. **Forecast charged for an empty radar (rfe #1).** `parse` rejects (400, no
   charge) when no criterion is relied-on, on both the DB and inline legs.

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 383 pass | 389 pass (+6) |
| eslint (changed) | — | clean |

## Patterns established (catalogue items 5-8)

5. **A try that wraps both the paid call AND the parse conflates two failures.**
   Keep the billable call in its own try; run the parse/guard on the returned
   value separately so a parser bug doesn't masquerade as a provider failure
   (and refund revenue you actually owe).
6. **Validate money at the one chokepoint, not at each call site.** A ledger that
   trusts a `number` cost is one mis-signed argument away from minting tokens.
   Assert sign/finiteness/magnitude in the wrapper every caller funnels through.
7. **Schemaless stores need code-level invariants the SQL CHECK gave you.** When
   a Firestore driver "mirrors" a PGlite one, the integer/`>= 0` column
   constraints don't port — re-assert them in code or the two drift on the floor.
8. **Charge AFTER you know there's output, or refund when there isn't.** A
   pre-charge gate must validate the *substance* (is anything relied-on / will a
   save be attempted), not just array length — else you bill for an empty result.

## What remains

Waves 3-8 per INDEX. Remaining criticals: rate-limit XFF bypass (W3),
petition-drafting "Saved ✓" false-success (W4), 2× eval-harness false-green (W5).
