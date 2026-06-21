# Fix Wave 14 — UI consistency, drift & missing states (deferred-backlog, FINAL)

> 13 commits, 13 findings closed (9 Medium, 4 Low). All ui-perfectionist.
> Baseline preserved: tsc 0 → 0, tests 408 → 409 pass (+1 new), lint clean, `next build` PASS.
> Mental model: *one source of truth per surface; every screen tells the truth about
> what's a sample, what's saved, and what it will and won't do before charging.*
>
> This is the LAST wave of the bug-hunter + ui-perfectionist scan. All 50 findings
> are now resolved; no Criticals or Highs remain.

## Commits

| # | Commit | Finding | Files |
|---|---|---|---|
| 1 | `ec5ad18` | case-file #5 (L) | case-file/CaseFileDashboard.tsx |
| 2 | `5fd4299` | evidence #2 (M) | evidence/EvidenceVault.tsx |
| 3 | `35d9c8c` | o1a #4 (M) | qualification/CriteriaReport.tsx |
| 4 | `67d646b` | rfe #5 (L) | rfe/RfeRiskRadar.tsx |
| 5 | `51b1911` | guidance #3 (M) | guidance/FieldGuidancePanel.tsx |
| 6 | `3aa2614` | guidance #2 (M) | llm/adjudication-gates.ts (+test), api/guidance/route.ts |
| 7 | `a6afab2` | rfe #4 (M) | rfe/index.ts, rfe/RfeStudio.tsx |
| 8 | `383bf41` | consent #4 (M) | components/ConsentForm.tsx |
| 9 | `673d4a4` | case-file #4 (M) | case-file/CriteriaRows.tsx (new) + CriteriaTable + CaseDetailView |
| 10 | `9a6c867` | marketing #3 (M) | components/SiteChrome.tsx (new) + 6 marketing pages |
| 11 | `341984a` | marketing #4 (M) | landing-claude/page.tsx |
| 12 | `5654c99` | petition-drafting #4 (M) + #5 (L) | drafting/DraftStudio.tsx |

## What was fixed

1. **Demo masthead read as the user's data (case-file #5, L).** The dashboard's
   hardcoded "Dr. Anya Krishnan / 92%" hero sat above the real "Your cases" list.
   Labeled it "Sample case" with an illustrative note; the standalone 92% badge is
   now "Sample · 92% modeled likelihood".
2. **Optimistic exhibit drifted from persisted (evidence #2, M).** A new exhibit
   rendered as a bare "2" beside saved "Ex. 2"; the optimistic ordinal now uses the
   same `Ex. N` format the stores assign.
3. **Harsh empty screening (o1a #4, M).** An all-"None" profile showed "0 of 8 —
   38%" as if a verdict. When `qualifying === 0`, the estimate + meter are
   suppressed and reframed as a starting point pointing at the gaps.
4. **No recovery on forecast error + bare cost (rfe #5, L).** Added an inline
   "Try again" on the RFE forecast error and labeled the Reinforce button's bare
   "5" as "5 tokens".
5. **Disclaimer from server echo, dropped on error (guidance #3, M).** The UPL
   disclaimer now renders from the local const (not `result.disclaimer`) and is
   shown on the error path too — never optional on this surface.
6. **"3–6 short sentences" unenforced (guidance #2, M).** Added `clampSentences`
   (length-preserving, abbreviation-aware) and apply it in the guidance guard so a
   runaway answer is trimmed to the contract.
7. **Hollow RFE draft charged anyway (rfe #4, M).** With no addressable criteria,
   an RFE draft is generic boilerplate; compute the addressable count (reusing
   `isRelied`), disable the Draft button, short-circuit the charged call, and show
   inline guidance to score a criterion first.
8. **Append-only consent double-write (consent #4, M).** The `consents` table
   inserts a row per call with no `(user, version)` uniqueness; added a synchronous
   double-submit guard so two fast submits can't write two consent rows for one
   acceptance. (DB-level uniqueness is the deeper hardening — deferred to avoid a
   shared-DB migration in a UI wave.)
9. **Two drifted criteria tables (case-file #4, M).** Extracted one shared
   `CriteriaRows` (config props: exhibit column, primer button, evidence header);
   the dashboard and case-detail screens reuse it and keep their own card/header.
10. **Six drifted site-chrome copies (marketing #3, M).** Extracted one shared
    `SiteHeader`/`SiteFooter` (`@/components/SiteChrome`) used by home, qualify,
    billing, faq, validation, and visa — ~300 lines of duplicated, drifted chrome
    removed.
11. **Duplicate-content alt homepage (marketing #4, M).** `/landing-claude` is now
    `robots: noindex` with a canonical to `/`, and the shared footer no longer
    links to it.
12. **Un-stored draft looked unsaved + stale "Saved ✓" (petition-drafting #4 + #5).**
    Surfaced the persisted `version` to the section-regenerate client (the
    orchestrator already returns it) so an un-stored draft's v1 is reflected, and
    track the version across generate / regenerate / redline / save so the button
    reads "Saved · vN" instead of a sometimes-stale check.

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 408 pass | 409 pass (+1) |
| eslint (changed) | — | clean |
| next build | PASS | PASS |

## Patterns established (catalogue items 33-35)

33. **A demo/sample on a real surface must be labeled as one.** Hardcoded
    illustrative data above the user's own records reads as their data unless it
    says "sample".
34. **One surface, one component.** Duplicated tables / headers / footers drift the
    moment one copy is edited; extract a shared piece with config props and the
    drift can't recur.
35. **Don't charge for a no-op, and don't lie about save state.** Gate a paid action
    when its inputs make the output empty, and reflect the persisted version so the
    UI's "saved" claim is always true.

## Backlog — CLEARED

All 50 findings from the bug-hunter + ui-perfectionist scan are resolved across
Waves 1–11, 13, 14 (Wave 12 was descoped as low-value). No Criticals, no Highs,
no Mediums remain. The only deliberately-deferred item is `auth #5` (a `/welcome`
middleware-prefix hardening — a security item tracked separately, not part of this
scan's a11y/drift scope).
