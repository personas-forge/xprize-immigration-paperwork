# Feature-Scout + Ambiguity-Guardian — Fix Waves 5–8 (product-capability builds)

> The feature half of the campaign — ~14 findings shipped across the 4 feature
> waves, 9 commits, on the SAME branch `vibeman/feature-ambiguity-2026-06-21`.
> Gates GREEN: **tsc 0 · tests 427 → 429 · next build PASS.**
> Strategy: ship the cleanly-buildable, high-value items; defer the ones needing
> external infra (DocuSign/OCR/Polar portal), a legal-deadline product decision,
> or a durable-outbox build — each flagged below.

---

## Wave 5 — Attorney workflow & filing safety

| Finding | Commit | What shipped |
|---|---|---|
| attorney-review #1 (H) | `7f1a662` | **Pre-file integrity gate** — sign-and-file now loads the latest draft and fails-closed when there's no draft/empty sections (was: an attorney could file a blank case under their bar license) |
| attorney-review #2 (H, partial) | `7f1a662` | **Honest receipt** — confirm form takes an optional REAL USCIS receipt (format-validated); with none, records a DEMO receipt (filed-event `metadata.demo`) and ReviewPanel flags "Not a genuine USCIS receipt" |
| attorney-review #4 (H) | `5849bf8` | **Queue-age (SLA-clock) contract recorded** at the consuming site — updated_at == last-entered-review for an in-queue case; a re-submit intentionally restarts the clock (no redundant column) |
| event-bus #1 (C) | `482fc15` | **Real attorney-notify channel** — env-gated `resolveNotifyFn()` POSTs each milestone to `ATTORNEY_NOTIFY_WEBHOOK_URL` (provider-agnostic, +recipients +bearer, 5s timeout, throws→NOT-DELIVERED log); console fallback when unconfigured |

**Deferred (flagged):** attorney-review #2-full (DocuSign e-sign + USCIS receipt ingest — external integration); attorney-review #3 (RFE/Denied lifecycle — needs a legal-deadline product decision on the RFE response window + a status-vocabulary expansion); event-bus #2 (durable outbox/dead-letter — L, schema + relay).

## Wave 6 — Drafting & screening deliverables

| Finding | Commit | What shipped |
|---|---|---|
| petition-drafting #1 (H) | `e0e32a3` | **Letter export on the happy path** — Copy letter + Download .txt toolbar on the done view, reusing the existing exhibit-indexed `draftClipboardText` serializer (was reachable only via a save FAILURE) |
| eligibility-screening #2 (H) | `fdcd62f` | **EB-1A final-merits caveat** — the screening verdict now states clearing 3 criteria is only step one of EB-1A's two-step Kazarian bar (was: identical confident green verdict to O-1A on a green-card path); decision recorded in packs.ts |

**Deferred (flagged):** rfe #1 / petition-drafting #4 (RFE/draft version history — M, store read + UI); evidence #2 (PDF/image upload — needs Document AI OCR); eligibility-screening #1 (resumable/persisted screening — M); form-field-guidance #2 (guidance history — M); eligibility-screening #4 (profession-aware screening — M).

## Wave 7 — Case-file honesty + design primitives

| Finding | Commit | What shipped |
|---|---|---|
| case-file-dashboard #1 + #2 (H) | `9cf807b` | **Real case-detail eligibility read-out** — the DB-backed CaseDetailView now shows "N of M qualify · need K · X partial" + a Meets/Below badge via `summarizeCriteria`, threshold from the case's OWN pack (never a hardcoded O-1A constant) — was a bare `{n} criteria` count, present only on the mock dashboard |
| ai-orchestrator #2 (H) | `b424454` | **Recorded the persist-mock vs skip-adjudication-on-mock contract** — a saved mock carries no risk report, intentionally + safely (template has nothing to catch; source:mock + "Placeholder output" UI; filing separately gated) |

**Deferred (flagged):** brand-design Toast/Modal primitives + z-index scale (M — design-system refactor); case-file #4 (SidePanels dead CTAs / fabricated metadata — M); case-file #3/#5 (cache-TTL + formatWhen docs — small).

## Wave 8 — Billing/account UX + observability + eval

| Finding | Commit | What shipped |
|---|---|---|
| token-economy #1 + checkout #2 (H) | `7ff513c` | **Token-ledger history** — new `Store.getLedgerForUser` (both drivers) + a "Recent activity" read-out on /billing (operation/reason label, date, signed delta, running balance) — was a bare balance; the #1 prepaid trust feature |
| marketing #4 (M) | `4e603bc` | **FAQ JSON-LD** — `FAQPage` structured data emitted from the same QA array (rich-result eligibility for cost/lawyer queries) |
| llm-eval #1 (H) | `4e603bc` | **Eval qualify temperature parity** — the harness now sends `temperature: 0` for qualify to match production (was a higher-variance default on the op flagged as the top stability risk) |

**Deferred (flagged):** checkout #2 receipts/invoices + #3 subscription affordances/portal (Polar customer-portal API); auth #4 (multi-attorney org/role mgmt — large, product decision); rate-limit #1 (abuse alerting — S, pairs with cost-telemetry); marketing #2 (social-proof/testimonials band — M, needs real content); llm-eval #2 (regression baseline/golden-diff — M).

### Post-W8 follow-up — GDPR account self-service (auth #1, High) ✅ SHIPPED

| Finding | Commits | What shipped |
|---|---|---|
| auth #1 (H) | `49e4a60` `5ca17c8` `b196e87` | **Account deletion + GDPR data export.** `Store.exportUserData` + `deleteUserData` (both drivers — PGlite FK-cascade delete in one tx; Firestore batched delete); `GET /api/me/export` (auth-gated JSON download, keyed on session uid); a new `/dashboard/account` page with "Download my data (.json)" + a Danger-zone delete (two-step + typed `delete my account` confirm → cascade delete → `adminAuth().deleteUser` → clear session); "Account" link added to the site nav. tsc0/tests429/next-build PASS. |

⚠ The delete removes the user's COPY of case data; a filed petition is the attorney's record. Order is data-first then auth-account so a failed data delete leaves a retryable state.

### Post-W8 follow-up — consent receipt + marketing preference (consent #2/#5) ✅ SHIPPED

| Finding | Commit | What shipped |
|---|---|---|
| consent #2 (H) | `1215043` | **Viewable/changeable marketing preference** — a toggle on `/dashboard/account` that records the change as a NEW append-only consent row (preserves the audit trail; never re-prompts since onboarding keys on version only). `marketing_opt_in` was previously write-only. |
| consent #5 (M) | `1215043` | **Consent history / receipt** — the full append-only consent log surfaced (version + date + terms/privacy/marketing badges). New `Store.getConsentHistory` + `recordConsent` (both drivers; recordConsent appends WITHOUT a profile mutation) + `updateMarketingPreference` action. |

---

## Pattern catalogue additions (feature waves)

12. **Serializer-without-a-button** — a built, tested export serializer wired only into an error path (SaveFailedAlert) means the core deliverable is inaccessible on the happy path. Wire it to a visible control; near-zero new logic.
13. **Honesty on a stub** — a fabricated value shown indistinguishably from a real one (demo USCIS receipt) is a trust/liability hazard. Either capture the real value (validated) or label the stub unmistakably ("Demo — not filed").
14. **Honest-data-only-on-the-demo** — when the illustrative/mock surface has the honest read-out (eligibility summary) but the REAL user-scoped surface has a bare count, the product answers its core question only on fake data. Route the real surface through the same helper.
15. **Inert seam, no sink** — an injectable seam (NotifyFn) shipped with only a console default is a feature that looks done but delivers nothing. Add an env-gated real sink so it ships functional-but-inert until configured, not permanently fake.
16. **Recorded-data, no read-back** — a table that captures everything (token_ledger) with no UI to read it forces "where did it go?" support tickets. The read endpoint + a list is usually all that's missing.
17. **Defer on a legal/product decision, don't guess** — an RFE response deadline (~87 days, varies) or a destructive account-delete cascade is not a default to hardcode mid-wave. Flag it for the owner rather than ship a guess on a legal surface.

---

## Branch status

Both fix-wave sets (W1–4 correctness + W5–8 features) are on `vibeman/feature-ambiguity-2026-06-21`, UNMERGED off `main`. ~34 commits total (1 scan-doc + 23 W1–4 + 1 W1–4 summary + 9 W5–8). All gates green throughout.

⚠ Before relying on the new infra in prod: set `ATTORNEY_NOTIFY_WEBHOOK_URL` (+ token) to activate notifications; the Firestore `getLedgerForUser` sorts in-memory (fine for bounded ledgers — add a composite index if a user's ledger grows large); verify the demo-receipt labeling reads correctly on a real filed case.
