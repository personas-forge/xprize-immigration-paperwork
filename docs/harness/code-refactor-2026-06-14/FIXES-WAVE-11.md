# Code Refactor — Fix Wave 11 — token-economy de-shim + llm-engine docs + review spine

> 4 commits, 6 findings closed (3 M / 3 L). Baseline preserved:
> tsc 0→0; tests 283→275 pass / 0 fail; `next build` PASSES; lint clean.
> (Test delta: −9 redundant token tests removed, +1 extractJson regression = −8.)

## Commits

| # | Commit | Findings | Severity | Kind |
|---|--------|----------|----------|------|
| 1 | `d20f923` | token-economy #2, #3, #4 | M/M/L | structure / duplication / cleanup |
| 2 | `1ae3a31` | llm-engine #4 | L | doc/test cleanup |
| 3 | `eee7d24` | llm-engine #3 | M | dead-code (vendored → document) |
| 4 | `2f418c6` | attorney-review #2 | M | duplication |

## What was fixed

1. **De-shimmed `economy.ts` (token-economy #2/#3/#4).** economy.ts re-exported
   `costOf`/`OpTier` and aliased `OP_COST = TIER_COST` purely as back-compat
   shims over `registry.ts` (the documented single source of truth), forcing a
   two-hop import for the metering vocabulary.
   - **#2** — retargeted the 3 `costOf` importers (`guard.ts`, `QualifyPanel`,
     `FieldGuidancePanel`) at `@/lib/tokens/registry`; dropped the `costOf`
     re-export. The `OpTier` re-export had zero importers → removed.
   - **#3** — removed the `OP_COST` alias. economy.test.ts's cost-tier assertions
     were fully redundant with registry.test.ts (which already pins
     `costOf`/`TIER_COST` for all 6 ops + unknown + ordering), so they were
     dropped rather than retargeted; registry.test.ts lost its two
     economy-derivation tests (economy no longer derives) but keeps the
     rate-limit derivation invariant.
   - **#4** — fixed the now-stale provenance comments in economy.ts/registry.ts
     that named the removed `OPERATIONS`/`OP_COST` surface.
   - economy.ts now owns ONLY the purchase side (grant, bypass, bundles). Same
     function reference everywhere; no behavior change.

2. **extractJson test name + JSDoc (llm-engine #4).** The test was titled
   "takes the outermost braces (first { to last })" — that describes the
   `lastIndexOf('}')` strategy the implementation deliberately rejects (it
   over-grabs when the model appends a second object in prose). Renamed to
   "keeps nested objects (balances braces)", added a regression pinning
   `extractJson('{"a":1} note {"b":2}') === { a: 1 }`, and tightened the JSDoc
   to state the balanced-first-object contract.

3. **Documented the length-only LLM output guard (llm-engine #3).** The vendored
   `guard()` engine carries a full rule surface (json/jsonKeys, PII patterns,
   mustInclude/mustMatch/mustNotMatch, maxWords) but the app's only `GuardRules`
   instance is `{ minWords, maxChars }`. A reader could mistake the unexercised
   PII/JSON branches for a coverage gap. Commented on `LLM_OUTPUT_GUARD` that
   length-only is intentional, the rest is vendored-not-prunable, and how to opt
   in. No code change (report explicitly says: do NOT prune — vendored).

4. **Extracted the review-action spine (attorney-review #2).** The five review
   actions repeated the configured-attorney gate 3× and the
   `transitionCase → if (applied) revalidateCase` tail 4×.
   - `requireAttorney()` collapses the 3× gate into one fail-closed helper.
   - `applyTransition(input)` collapses the 4× tail (apply-only-then-revalidate).
   - **Gate NOT weakened**: the owner-only `resolveCase({ email: null })` gates
     in submitForReview/addReviewNote stay explicit (the `email: null` arg is
     exactly what owner-only-gate.test.ts pins). owner-only-gate 3/3 green.

## Intentionally left

- **llm-engine #2 (M, toSection/sections coercion)** — ALREADY RESOLVED in Wave 3.
  The triplicated `toSection` + `tryParseSections` were single-sourced into
  `@/features/drafting` (shared by rfe + saveRecovery). The report framed it as
  "belongs beside extractJson in lib/llm"; W3 instead placed it in drafting (the
  `DraftSection` type owner) to avoid the feature→lib cycle — the report itself
  sanctioned that alternative. No triplication remains.
- **attorney-review #4 (L, relocate `formatWhen`)** — the report's own verdict is
  "no action recommended": a 3-line pure helper in the server-component page,
  single call site, zero duplication. Relocating it into the review feature
  means either importing a helper from a `"use client"` module into a server
  component, or creating a new module — coupling cost for no dedup payoff. Left.

## Verification

| Gate | After Wave 10 | After Wave 11 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 283 / 0 | 275 / 0 |
| `next build` | PASS | PASS |
| lint (touched files) | clean | clean |

## Cumulative status

~68 of 88 findings closed across 11 waves + 3 follow-ups; CRITICAL closed; 1 FP
rejected. Branch `refactor/code-refactor-2026-06-14`, off `main`, not pushed.

## Remaining tail (M/L; none blocking)

- **FAQ answer content** — flagged for the user (service-scope/legal claims; needs
  a business decision).
- Lower-value dups not taken: criteria-table merge (case-file #2, god-component
  risk), `createPersistentValue` (case-file #3, contract mismatch), SiteHeader/
  Footer dedup (marketing #2, drifted nav), RfeStudio paywall JSX (rfe #5),
  validation #5.
- Intentionally kept: addReviewNote double-resolve (L), ai-orchestrator #3
  type-mirroring, validation #4 `provisional`, consent #3 `email` prop,
  rate-limiting #4 `windowMs`, event-bus #4 `Clock`, attorney-review #4
  `formatWhen`.
