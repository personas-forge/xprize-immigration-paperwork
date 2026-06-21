# Bug Hunter + UI Perfectionist — Fix Wave 8: UI consistency / drift / missing states

> 2 commits, 6 findings closed (1 High, 5 Medium). FINAL wave of the planned arc.
> Baseline preserved: tsc 0 → 0, tests 399 → 400 pass (+1 new), lint clean, `next build` PASS.
> Mental model: *the UI tells the truth and reflects its own state — no stale
> pricing, no phantom hover, no one-click data loss, no live-looking inert buttons.*

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `9e4897f` | marketing #2 (H), brand #3 (M) | manifest.webmanifest (+test), ui/Card.tsx |
| 2 | `1929abc` | attorney-review #2 (M), rfe #2 (M), evidence #3 (M), checkout #4 (M) | ui/Button.tsx, review/SubmitButton.tsx (new), ReviewPanel.tsx, RfeStudio.tsx, EvidenceVault.tsx, PurchaseToast.tsx |

## What was fixed

1. **Manifest advertised a retired model (#2, H).** The PWA `description` still
   read "AI-drafted, attorney-signed O-1 petitions. **$2,500 flat**…" — a false
   price + a we-supply-the-attorney claim contradicting every page (token-metered;
   YOUR attorney of record). Rewrote it to layout's canonical `siteDescription`;
   added a drift-guard test rejecting `$`/flat/attorney-signed/retainer.
2. **Card promised a hover it didn't have (#3, M).** The docstring described a
   hover-lift while the render was static and the `.lift` CSS sat dead. Corrected
   the docstring ("static by default") and added an opt-in `interactive` prop
   that applies the reduced-motion-safe `.lift` — reviving the dead rule.
3. **Review actions had no pending state (attorney-review #2, M).** The attorney
   console forms could double-fire a legally-meaningful action (submit, return,
   record decision, sign & file). Added a `SubmitButton` (`useFormStatus().pending`
   → disabled + label swap "Filing with USCIS…") + a shared `disabled:` style on
   `Button`.
4. **Paid RFE button looked live during the gap (rfe #2, M).** Disabled only on
   the async `status` flip; added a `busy` state (set in the generate try/finally)
   OR'd into the button so it disables for the whole charged call.
5. **One-click exhibit delete (evidence #3, M).** Removing a vault doc was an
   irreversible delete that burns the exhibit ordinal — added a confirm naming the
   doc + exhibit.
6. **Over-claiming purchase toast (checkout #4, M).** "tokens have been added"
   while the webhook credit is async → softened to "will appear momentarily."

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 399 pass | 400 pass (+1) |
| eslint (changed) | — | clean |
| next build | PASS | PASS (46/46 pages) |

## Patterns established (catalogue items 22-23)

22. **Single-source every claim, including metadata.** The one surface NOT fed
    from the canonical description (a PWA manifest, an OG tag) is exactly where a
    retired price/claim survives — assert it in a test so it can't drift back.
23. **A `disabled` derived from async state has a one-render gap.** For a button
    that costs money or files legally, drive the disabled attribute from a
    synchronous in-flight signal (`useFormStatus().pending` for form actions, a
    `busy` state set in try/finally for fetches) so it never looks live mid-flight.

## Campaign complete

All 8 planned waves done. 50 of 100 findings closed (all 7 criticals + every High
in the scan), 33 commits, branch `vibeman/bughunt-uiperf-2026-06-20` (UNMERGED off
`main`), tsc0 / tests 378→400 / lint / `next build` PASS throughout.

DEFERRED (all M/L, no criticals): consent #4 (double-submit window — fiddly with
useActionState+redirect), marketing #3/#4 (header/footer drift, landing-claude
duplicate content — needs an IA decision), case-file #4/#5 (duplicate criteria
table, demo masthead), o1a #4 / rfe #4 (empty-state copy), attorney-review #5
(loading skeleton), evidence #2/#5, brand #4/#5, validation #5, a11y mediums, and
the W7-deferred backend tail (event-bus #3/#4/#5, llm #2/#5, data-adapter
#1/#3/#4/#5, ai #4/#5), plus eval #5 (sentence-count — redo with a tokenizer).
See INDEX + per-wave docs.
