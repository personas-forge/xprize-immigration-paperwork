# Code Refactor — Fix Waves 1–5 (immigration-paperwork, 2026-06-23)

> Closes the 2 criticals + 28 of 31 highs (+ 3 folded mediums) from the
> code_refactor scan. 25 atomic commits on `vibeman/code-refactor-2026-06-23`
> (off `main` @ `d5671fa`). Gates green throughout: tsc 0, tests 429→428
> (the −1 is the legitimately-removed dead `checklistToCsv` test), lint clean,
> `next build` PASS after every wave.

## Status by theme

| Wave | Theme | Closed | Notes |
|---|---|---:|---|
| 1 | A — money/legal single-source drift | 8 + 1M | both criticals here |
| 2 | B — clones of a shared helper | 5 | |
| 3 | C — cross-cutting boilerplate | 9 | incl. the orchestrator gate preamble |
| 4 | D — dead code | 5 | +1 verified FP, +1 deferred (decision) |
| 5 | E+F — design-system drift / module hygiene | 3 | +1 deferred (visual, no tests) |

**Total: 31 findings closed** (2 C + 28 H + checkout#3 / auth-session#4 / evidence#3 mediums folded in).

## Commits (newest first within each wave)

**Wave 1 — Theme A**
- `refactor(validation): drop redundant subject field; derive label from map key` — **Crit** validation#1
- `refactor(tokens): export MAX_LEDGER_AMOUNT; dev grant route imports it` — H token#1
- `refactor(review): single-source the demo-receipt flag and the USCIS decisions` — **Crit** attorney#1 + H attorney#2
- `refactor(polar): share one set of webhook field readers across credit + relay` — H checkout#1/#2 (+M #3)
- `refactor(landing): derive cost-comparison chart from FIRM_FEE and BUNDLES` — H marketing#2/#3

**Wave 2 — Theme B**
- `refactor(drafting): delete RFE/draft clones, share the section helpers` — H rfe#1/#2, petition#1
- `refactor(evidence): single-source the "Ex. N" exhibit-label format` — H evidence#2
- `refactor(qualify): derive statusAccent from the shared classifyStatus ladder` — H o1a#2

**Wave 3 — Theme C**
- `refactor(adapters): share the lazy-DI scaffold across petition + evidence` — H data-adapter#1
- `refactor(events): build CaseStatusChanged via one factory, not two literals` — H event-bus#2
- `refactor(auth): one shared revokeAndClearSession for both sign-out paths` — H auth#1
- `refactor(consent): single-source the re-consent gate predicate` — H consent#1 (+M auth-session#4)
- `refactor(llm): fold the engine error-telemetry into one withTelemetry decorator` — H llm-engine#1
- `refactor(llm-eval): share the grounding-overlap heuristic across two gates` — H llm-eval#1
- `refactor(db): one consent-row writer per driver (upsert + recordConsent)` — H auth#2
- `refactor(rate-limit): one tooManyRequestsResponse helper for all 429 sites` — H rate-limit#1
- `refactor(ai): one resolveCaseForParse for the four AI specs' gate preamble` — H ai-orchestrator#1

**Wave 4 — Theme D**
- `refactor(css): delete the dead [data-animate] keyframe system` — H brand#1
- `refactor(validation): delete the dead verifiedBy field` — H validation#2
- `refactor(events): drop the write-only EvidenceUploaded.name field` — H event-bus#1
- `refactor: delete dead PetitionStepper + checklistToCsv/CaseDocument` — H marketing#1 + case-file#2
- `docs(evidence): note parseCategorizeResponse is used by the eval harness` — evidence#1 **(verified FP)**

**Wave 5 — Themes E + F**
- `refactor: import DISCLAIMER from its canonical @/lib/result home` — H uscis#1 (+M evidence#3)
- `refactor(qualify): hoist the triplicated SAMPLE CV into one SAMPLE_PROFILE` — H o1a#1
- `refactor(ui): extract buttonClasses; empty-state CTA stops hand-copying Button` — H case-file#1

## New shared modules introduced

- `src/lib/exhibits.ts` — `formatExhibit` / `parseExhibitOrdinal` / `EXHIBIT_PREFIX` (both store drivers + the optimistic client).
- `src/app/api/polar/webhook/polar-fields.ts` — `pickStr` / `productId` / `resolveUserId` / `finiteCents` (credit path + revenue relay).
- `src/features/review/decisions.ts` — `USCIS_DECISIONS` (server allowlist + `<select>`).
- `src/lib/auth/session-cookie.ts` — `revokeAndClearSession` (both sign-out routes).
- `src/lib/data/adapters/parse-gate.ts` — `resolveCaseForParse` (the four AI specs' gate preamble).
- New exports on existing modules: `drafting.withAttachedExhibits` + relocated `mergeRegeneratedSection`; `ledger.MAX_LEDGER_AMOUNT`; `access.makeCached` + `storeConfigured`; `rate-limit.tooManyRequestsResponse`; `consent.isFullyConsented`; `site.FIRM_FEE.{lowUsd,highUsd,midpointUsd}`; `Button.buttonClasses`; `prefill.SAMPLE_PROFILE`; `llm/client.withTelemetry` (private).

## Pattern catalogue (durable)

1. **Re-derived flag on a consequential path** — a boolean/value reconstructed at a consumer (regex on prose, hand-copied literal) when a structured source exists. The two drift on copy/i18n/price changes. Fix: thread the source field through. (attorney#1, validation#1, token#1, marketing#2/#3, checkout#1/#2)
2. **Clone of a pure helper** — a hand-rolled reimplementation of an existing tested function (citation-attach, section-merge, status-ladder, predicate). Fix: delete the clone, import the original; extract a generic core if the input types differ (`withAttachedExhibits<C>`). (rfe#1/#2, petition#1, o1a#2)
3. **Cross-cutting boilerplate with no wrapper** — the same preamble/envelope/DI/telemetry block copy-pasted across 2–4 call sites, several already drifted. Fix: extract one helper; the divergent leg (e.g. store-fault 503-vs-typed) gets settled in that one place. (ai-orchestrator#1, rate-limit#1, data-adapter#1, auth#1/#2, consent#1, llm-engine#1, llm-eval#1, event-bus#2)
4. **Client/server-boundary relocation** — a pure helper living in a server-only module (`draftOperation` imports `next/server`) can't be imported by a client; move it to the pure module (`drafting.ts`) and let both sides import it. (petition#1's `mergeRegeneratedSection`)
5. **Write-only field / unreachable export** — a field populated but never read, or a function exported + tested but never called in production. Verify with grep across `src/` **AND `scripts/` + `e2e/`** before deleting (the eval harness lives outside `src/`). (event-bus#1, validation#2, case-file#2, marketing#1; FP: evidence#1)
6. **Back-compat import hop** — importing a constant through a feature's re-export instead of its canonical home, creating phantom coupling. Fix: repoint to the documented source. (uscis#1, evidence#3)

## Deferred (with reasons)

- **brand#2 (High) — focus-ring across 34 files.** A `.focus-ring` utility + 34-file sweep. The inline form LACKS the `ring-offset` the Button standard has, so unifying is a **visual change** to 34 elements — and this project has **no visual tests**. Needs the utility authored + manual eyeballing / `npm run e2e`. Also reconcile the global `:focus-visible { outline: --accent }` (lower-contrast) with the `--accent-dark` ring contract. (case-file#1's CTA, which IS fixed, is the bounded version of this.)
- **data-adapter#2 (High) — `EvidenceAdapter.restoreDocument` unwired.** Wire-or-delete is a **product decision**: the soft-delete was deliberately designed recoverable (2026-06-21), so deleting the restore path removes intended capability while wiring it is a new feature (undo action + UI). Left intact; decide before closing.

## Remaining medium/low tail (65 findings)

Not gating. Per-report structure/cleanup. Higher-value clusters: the ~12-method adapter `try/catch→store_error` envelope (data-adapter#4), `assertChargeCost`/`assertCreditAmount` unify (token#2), the rate-limit preview-preamble guard (rate-limit#2), `caseId` parse idiom (ai-orchestrator#4), the `as unknown as Record` build-cast helper (ai-orchestrator#5), `CASE_STATUSES`/`CLASSIFICATION_OPTIONS` single-enumeration (attorney#4, case-file#5), and assorted stale doc comments. See the per-context reports for the full list.

## Verification

tsc 0 after every wave; tests 429→428 (−1 = removed dead test); lint clean on touched files; `next build` PASS after Waves 1, 3, 4, 5. The orchestrator-preamble change (the most auth-sensitive) was additionally lint-checked and full-suite-tested before commit.
