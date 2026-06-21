# Fix Wave 13 — Accessibility polish (deferred-backlog)

> 6 commits, 9 findings closed (1 Medium, 8 Low). All ui-perfectionist / a11y.
> Baseline preserved: tsc 0 → 0, tests 408 → 408 pass, lint clean, `next build` PASS.
> Mental model: *keyboard + screen-reader users get the same information, affordances,
> and motion comfort the visual UI gives everyone else.*

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `43e177c` | brand #4 (M), #5 (L) | brand/Wordmark.tsx, brand/Stamp.tsx |
| 2 | `21054e5` | marketing #5 (L) | components/Motion.tsx, app/page.tsx |
| 3 | `16a32d6` | consent #5 (L) | components/ConsentForm.tsx |
| 4 | `7cef78e` | o1a #5 (L), validation #5 (L) | qualification/CriteriaReport.tsx, app/validation/page.tsx |
| 5 | `0cb3ee8` | guidance #5 (L), evidence #5 (L) | guidance.ts (+panel), evidence.ts (+index, +EvidenceVault) |
| 6 | `416b7ec` | attorney-review #5 (L) | app/dashboard/review/loading.tsx (new) |

## What was fixed

1. **Seal hover ignored reduced-motion (brand #4, M).** The Wordmark seal's hover
   rotate snapped even for `prefers-reduced-motion` users; gated behind
   `motion-safe:` so they get a static mark.
2. **Stamp hid meaningful status + bypassed `cn` (brand #5, L).** Routed its
   classes through `cn` (+ a `className` prop callers can extend) and added a
   `decorative` prop (default true). `decorative={false}` exposes the stamp to AT
   as `role="img"` with a composed `label — meta` accessible name instead of
   `aria-hidden`.
3. **Process steps were role-on-div lists (marketing #5, L).** Made the
   Rise/Stagger motion wrappers polymorphic via an `as` prop (the `as` on Rise was
   already declared-but-ignored) so the "how it's built" group renders as a real
   `<ol><li>`; dropped the `role="list"`/`role="listitem"` attributes. The
   reduced-motion fallback renders the same tag.
4. **Required consents signaled only by a hidden `*` (consent #5, L).** Added
   `aria-required` and an sr-only "(required)" so the requirement is in the
   accessible name, not just a visual asterisk.
5. **Meters announced a bare number (o1a #5 + validation #5, L).** Both
   `role="meter"`s exposed only `aria-valuenow`. Added `aria-valuetext`: the
   screening meter speaks "42% estimated likelihood — meets/below threshold"; the
   freshness bar speaks its human label (days-until / overdue / unreadable), which
   also gives the color-only overdue state a non-visual cue.
6. **Client inputs had no caps; magic `20` (guidance #5 + evidence #5, L).**
   Exported the server bounds as the single source of truth (guidance `MAX_FIELD`;
   evidence `MAX_NAME` / `MIN_CONTENT` / `MAX_CONTENT`) and wired `maxLength` + a
   decorative live character counter into the situation textarea and the evidence
   name/content fields, so an over-limit entry can't waste a charged round-trip.
   The vault's hardcoded `20` is now `MIN_CONTENT`.
7. **Force-dynamic review queue rendered blank while loading
   (attorney-review #5, L).** Added a server-rendered `loading.tsx` skeleton
   mirroring the queue frame (top-bar strip, heading, placeholder rows) with an
   sr-only `role="status"` "Loading the review queue…" announcement.

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 408 pass | 408 pass |
| eslint (changed) | — | clean |
| next build | PASS | PASS |

## Patterns established (catalogue items 31-32)

31. **A `role="meter"`/progress element must carry `aria-valuetext`.** A bare
    `aria-valuenow` is announced as a unit-less number; the human-meaningful
    reading (percent, days, status) has to be spelled out for AT.
32. **Client validation bounds must be imported from the server, never re-typed.**
    A magic limit in the UI silently drifts from the authoritative one; export the
    constant and cap with `maxLength` so the form can't submit what the API will
    reject.

## Remaining backlog

W14 (UI consistency / drift / content / missing states, ~13 M/L). Wave 12 descoped.
No criticals; no Highs. (Deferred non-a11y item still open: `auth #5`, a `/welcome`
middleware-prefix hardening — security, tracked separately.)
