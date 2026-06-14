# Moonshot pipeline — parked items (2026-06-14)

> Run shipped **10 of 21** accepted moonshots end-to-end (each on its own branch,
> merged to `main` with atomic commits, `tsc` + full test suite + `next build` +
> lint green, Vibeman PATCHed to `implemented`, harness-learnings updated).
>
> **Shipped:** #10 exhibit-cited petitions · #16 Instant Verdict · #7 best-path
> recommender · #1 live adjudication-risk engine · #19 adjudicator redline ·
> #20 RFE Risk Radar · #21 exhibit-bound brief · #17 programmatic SEO ·
> #2 provenance ledger · #18 Letters Patent.
>
> The 11 below stay `accepted` in Vibeman. Each has a real reason it was parked
> in this run and a concrete "what's needed". They were NOT started (no partial
> branches), except where noted as "core delivered via a shipped moonshot".

## Substantially delivered by a shipped moonshot (rescope, don't rebuild)

- **#8 Adversarial RFE red-team** (V7) — the per-criterion RFE-challenge
  prediction is **shipped as #20 RFE Risk Radar** (`buildRfeForecastPrompt` /
  `tryParseRfeForecast` / `mockRfeForecast`, `/api/rfe/forecast`, the radar UI
  with one-click Reinforce). #8's distinct increment is **legal-basis grounding**:
  inject `validationFor(classification).legalBasis` + `sources` into the forecast
  so each predicted challenge cites the regulation (8 CFR 214.2 / 204.5) it stems
  from, and surface a "Defend this case" section in `CriteriaReport`. That's a
  small enhancement on top of #20 — a few lines to thread `legalBasis` through
  `forecastSpec` and render it on the radar cards. **Left as a follow-up so #8
  isn't marked done on a partial.**

- **#11 Adversarial USCIS examiner** (V7) — the adversarial pre-adjudication is
  **largely the same engine as #20**. #11's distinct increment is a **whole-case
  pre-flight dossier** (reads criteria + `summarizeVault` gaps + the draft +
  the review thread together, not just criteria), recorded as a typed
  `case_reviews` event (new `ReviewKind 'adjudication'`) and gating
  `submitForReview` above a risk threshold. Needs: a new pure module over the
  combined inputs, a `/api/cases/[id]/pre-adjudicate` route, and a `case_reviews`
  write (review-log DB) + a submit gate. Moderate; deferred behind the DB-write
  surface.

## Need a dual-store DB migration (pglite-store.ts + firestore-store.ts)

The token economy / consent / membership tables live behind the dual Firestore
+ PGlite driver. These need schema columns/tables added to BOTH drivers, and the
Firestore path can't be exercised in this sandbox (no emulator), so they were
parked to avoid shipping an unverifiable change to payment/consent code.

- **#5 Tamper-evident AI cost-of-record** (V7) — add `prev_hash` + `row_hash` to
  `token_ledger`, compute `row_hash` inside `charge()`/`credit()` (the
  `FOR UPDATE` serialization already orders the chain), thread `caseId` into
  ledger metadata, add `verify(userId)` + a per-case export. **The hash-chain
  primitive is already shipped** in `src/lib/events/provenance.ts` (#2):
  `hashAuditRecord`/`verifyChain` with an injectable hash + canonical JSON are
  drop-in for the ledger row chain. What remains is the schema + wiring inside the
  charge/credit transactions and the export — payment-path, so it wants careful
  verification on both drivers.

- **#4 Token-denominated growth network** (V7) — `CreditReason` += `gift` /
  `referral`; a debit-sender + credit-recipient transfer as one transaction
  (idempotent on a transfer ref); a pending-grant-by-email row; a `/billing/gift`
  action; referral codes in Polar checkout metadata credited on first purchase;
  anti-abuse caps. Needs new ledger reasons + a transfer primitive in both store
  drivers + a Polar webhook branch (can't test the webhook here).

- **#13 Court-admissible attestation chain** (V6) — hash-chain `consents` +
  `case_reviews` (the same #2 primitive) inside `upsertProfileWithConsent` /
  `transitionCase`, add `Store.verifyAttestationChain`, a sealed PDF export, and
  periodic external anchoring (RFC-3161 / Merkle root). Needs the dual-store
  columns + a PDF generator + (for anchoring) an external timestamp authority.

- **#6 Firm Wallet** (V4) — `orgs`/`memberships` + an `owner_kind:'user'|'org'`
  column on `token_accounts`/`token_ledger`, org resolution in the charge guard,
  Polar org metadata, a firm console, seat caps. Large multi-tenant ledger change
  across both drivers; high blast radius on the money path.

## Need external services / infra not available in this run

- **#3 Adjudicator Ensemble** (V4) — run each structured op through N diverse
  engine/persona samples and compute per-criterion consensus. The `getLlm`
  dependency is injectable (a clean seam, and #1's gates are ready to adjudicate
  each sample), but a *meaningful* ensemble needs real, diverse model engines
  configured (the deterministic mock is single-valued, so consensus is trivially
  unanimous and unverifiable here). Ship when engines are wired in the eval env.

- **#9 Live regulatory-drift watch** (V5) — extend
  `scripts/check-validation-freshness.ts` to fetch each `ValidationRecord.sources[]`
  URL (eCFR / USCIS / GOV.UK), fingerprint the cited text, baseline the hashes,
  and flip a record to `needs-review` on drift. Needs network fetch at script
  runtime + a committed baseline-hashes file + CI wiring — can't fetch/verify the
  live sources in this sandbox.

- **#12 Expert letter engine with recommender intake** (V6) — a per-criterion
  recommender-letter drafter (pure, reuses the citation discipline) PLUS a
  scoped, time-boxed `case_grants` token with role `recommender`, a public intake
  page, and an inbound `addCaseDocument` from an outside party. The letter-draft
  module is doable in the scaffold, but the value is the scoped-outside-access
  grant (new DB table + a public authenticated surface) — deferred behind that.

- **#14 Passkey identity bound to bar license** (V4) — WebAuthn register/auth
  routes + a `credentials` table + step-up on sign/file + bar-number verification
  + optional KYC. Needs a WebAuthn library, a credentials table, and an external
  bar-API / KYC provider — external integrations not wireable/verifiable here.

- **#15 Attorney Marketplace** (V4, Effort 9) — `firms`/`firm_members`/
  `engagements` tables, `authorizeRoute` resolving an engagement instead of the
  global allowlist, `getCasesForFirm`, self-serve firm onboarding, applicant
  attorney-selection, marketplace economics. The largest item in the backlog;
  a multi-table, multi-surface tenancy rework — needs its own focused effort.

## Note

Where a parked item depends on a shipped one, the producer is in place:
- #5 and #13 can reuse the shipped **#2** hash-chain primitive (`provenance.ts`).
- #3 can reuse the shipped **#1** adjudication gates (`adjudication-gates.ts`) to
  score each ensemble sample, and the injectable `getLlm` seam.
- #8/#11 reuse the shipped **#20** forecast engine (`rfe.ts` forecast exports).
