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

- **brand#2 (High) — DONE (later commit).** Added a shared `.focus-ring` utility mirroring the Button ring and swept all 79 inline copies across 34 files; reconciled the global `:focus-visible` fallback to `--accent-dark`. VISUAL change (swept elements gained the ring-offset; global outline darkened) — no visual tests, so eyeball keyboard focus or run `npm run e2e`. tsc 0 / tests 427 / next build PASS.
- **data-adapter#2 (High) — DONE (WIRED).** Decision: wire, not delete. Added a `restoreDocument` server action + an "Undo" affordance in EvidenceVault that restores a just-removed document (keeps its original exhibit ordinal) — completing the soft-delete recovery design the backend already supported. tsc 0 / tests 427 / next build PASS.

**All deferred items are now closed.** Remaining = only the ~4 lows the scan recommended keeping (above) + the 1 verified FP.

## Medium/low tail — COMPLETED (continuation session, same branch)

The 65-item medium/low tail was subsequently worked through (the 3 mediums folded
into Waves 1–5 already counted). ~60 closed across ~17 more commits (sub-waves
T1–T8 done directly, then 5 parallel subagents over disjoint file areas: LLM,
Guidance, Qualify/Validation, Drafting/RFE/Petition, Review/Case-file/Marketing/Brand).
Gates green throughout: tsc 0, tests 428→427 (−1 = the removed redundant
`setCaseStatus` emit test), lint clean, `next build` PASS.

New shared seams from the tail: `assertBoundedInt`/`FREE_PASS_BALANCE` (ledger),
`wrapStore` (adapters), `tooManyRequestsResponse` was Wave 1; `parseCriteriaArray`
+ `toRfeCriterion` (criteria), `parseCaseId` + `isCaseOwner` (parse-gate/adapter),
`CONSENT_FIELDS`, `toLedgerEntry` (per driver), `CASE_STATUSES`/`VISA_CLASSIFICATIONS`
+ `CLASSIFICATION_OPTIONS`/`STATUS_OPTIONS`, `copyButtonLabel`, `withStore`
(petitions), `consentRow`/`appendConsentRow`. Dead code deleted: `setCaseStatus`
(unguarded setter, Store interface + both drivers + event proxy), `Stagger`/
`staggerParent`, `HoverCard` (consolidated on `.lift`), `.double-rule` CSS,
`"provisional"` status, `isMeteringBypassed`, `PetitionAdapter.getLatestRfeResponse`,
`ParseContext.request`, dead `useId` plumbing, the `"na"` eval verdict.

**Intentionally LEFT (the scan itself recommended keep/leave):**
- ai-orchestrator#3 (`requiresImages`) — forward-design for the planned OCR caller; deleting just means rebuilding it.
- ai-orchestrator#5 (`build` cast) — the dangerous `as unknown` laundering was removed (uscis#4); the remaining single `as Record<string, unknown>` is required by the orchestrator's `build` return type.
- rate-limit#4 (`windowMs`) — a legitimate test-injection seam; the scan explicitly says NOT to action it.
- event-bus#5 (`at: now()` ×4) — folding into per-event builders would ADD code; subsumed by the event-bus#2 `caseStatusChanged` factory.

A verify-before-fix FP from Wave 4 also stands: evidence#1 `parseCategorizeResponse` is live (the eval harness calls it).

## Verification

tsc 0 after every wave; tests 429→428 (−1 = removed dead test); lint clean on touched files; `next build` PASS after Waves 1, 3, 4, 5. The orchestrator-preamble change (the most auth-sensitive) was additionally lint-checked and full-suite-tested before commit.
