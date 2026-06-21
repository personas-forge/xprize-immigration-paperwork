# Bug Hunter + UI Perfectionist — Fix Wave 6: Accessibility

> 3 commits, 8 findings closed (4 High, 4 Medium).
> Baseline preserved: tsc 0 → 0, tests 395 pass, lint clean, `next build` PASS (46/46 pages).
> Mental model: *keyboard + screen-reader users can perceive and operate every
> control and outcome — visible focus, announced results, real table semantics.*

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `b52de08` | brand #1 (H), #2 (M), marketing #1 (H), attorney-review #3 (M) | Button.tsx (+test), landing-claude + 34 files (focus-ring sweep) |
| 2 | `2295682` | o1a #3 (H), guidance #4 (M), evidence #4 (M) | CriteriaReport, FieldGuidancePanel, EvidenceVault |
| 3 | `d119fbd` | case-file #3 (H) | CaseList.tsx |

## What was fixed

### Focus visibility (WCAG 2.4.7 / 1.4.11)
1. **`Button` had no focus ring on 3 of 4 variants (#1, H).** `focus-visible:outline-none`
   was on the shared base but the ring only on `ghost`, so primary/secondary/seal
   (every CTA, incl. error-recovery Retry) were keyboard-invisible. Moved the ring
   to the base — all four variants now ring. The unit test loops all four (was
   ghost-only, which hid the regression). Also closes attorney-review #3 (the
   "Sign & file" seal button).
2. **Drifted ring colour across 34 files (#2, M).** 87 controls rang on the
   2.63:1 `--accent`/40 token (below 3:1). Uniformly swapped to
   `ring-[color:var(--accent-dark)]` (4.2:1 / 5.6:1, full opacity) — one audited
   ring app-wide.
3. **landing-claude CTAs had NO ring at all (#1 marketing, H)** — added the
   standard ring to its three CTAs (page had zero focus-visible classes).

### Live-region announcements (WCAG 4.1.3)
4. **Eligibility verdict was silent (o1a #3, H).** Only the likelihood meter (a
   bare %) was announced; the meets/below verdict + X-of-N count weren't. Added an
   sr-only `role="status"` verdict line in CriteriaReport (covers QualifyPanel +
   InstantVerdict).
5. **Guidance result silent (guidance #4, M).** Added a persistent sr-only
   `role="status"` region: "Generating…" → "Guidance ready — informational only,
   not legal advice." (the UPL note is now spoken, not just shown).
6. **Categorize silent (evidence #4, M).** The progress bar is `aria-hidden`;
   added a `role="status"` region announcing "Categorizing…" → "Document
   categorized under <criterion>, exhibit <n>."

### Table semantics
7. **Case-portfolio table (case-file #3, H).** Bare `<th>` (no `scope`) + a
   mouse-only `<tr onClick>`. Added `scope="col"` to every header, and gave the
   file-number link an `aria-label` + visible focus ring as the keyboard/SR
   action. The row click stays a mouse enhancement (a `<tr>`-as-button breaks
   table semantics — the recommended pattern is a labelled link in a cell).

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 395 pass | 395 pass (Button test refactored, same count) |
| eslint (changed) | — | clean |
| next build | PASS | PASS (46/46 static pages) |

## Patterns established (catalogue items 17-18)

17. **`outline-none` on a shared base needs a replacement ring on the base too.**
    Stripping the outline in a base class and re-adding the ring per-variant
    guarantees the variants someone forgets are keyboard-invisible — and a
    single-variant test reads as "covered."
18. **The primary outcome must live in a live region, not just pixels.** A result
    that swaps in (verdict, generated text, categorization) is silent to AT unless
    a persistent `role="status"`/`aria-live` region carries it — especially the
    not-legal-advice note on a UPL surface.

## What remains

Waves 7-8 per INDEX (reliability/resource: unbounded provenance ledger,
concurrent-publish ordering, cache staleness, orphan grandchild; UI consistency:
stale "$2,500" manifest, header/footer drift, landing-claude duplicate content,
dead Card hover, destructive-remove confirm). Deferred a11y mediums: brand #4
(Wordmark `motion-safe:`), brand #5 (Stamp `cn`/informational `aria-label`),
consent #5 (required-field indication), validation #5 / o1a #5 (meter labelling).
No remaining criticals.
