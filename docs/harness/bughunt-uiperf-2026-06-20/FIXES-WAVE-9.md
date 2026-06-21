# Fix Wave 9 — Silent failures & error surfacing (deferred-backlog)

> 3 commits, 6 findings closed (**3 High**, 3 Medium). Post-campaign backlog wave.
> Baseline preserved: tsc 0 → 0, tests 400 → 402 pass (+2 new), lint clean, `next build` PASS.
> Mental model: *a failure must look like a failure — no operation reports success
> for nothing, surfaces nothing on error, or writes against an unverified resource.*
>
> NOTE: these 3 Highs were mis-reported as "closed" at campaign end — they had
> slipped into the deferred pile. This wave closes them.

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `41bc2cf` | data-adapter #1 (H), #3 (M), #4 (M) | store.ts, pglite/firestore stores, data/evidence.ts, adapters/evidence (+test), adapters/access.ts, adapters/petition.ts |
| 2 | `e255dc8` | case-file #1 (H) | useCaseFileData.ts, CaseFileDashboard.tsx |
| 3 | `506ce06` | attorney-review #1 (H), #4 (M) | review/actions.ts, review/ReviewActionForm.tsx (new), ReviewPanel.tsx |

## What was fixed

1. **No-op delete/refile reported success (data-adapter #1, H).** `removeDocument`
   /`refileDocument` returned `ok` even when the delete/update matched ZERO rows
   (wrong-case or already-gone id). Threaded an affected-row boolean through the
   Store interface → both drivers → data layer → adapter; the adapter maps `false`
   → `err("not_found")`.
2. **Dashboard ate the fetch error (case-file #1, H).** `CaseFileDashboard` read
   only `data` from `useCaseFileData`, so a fetch rejection left every card on
   infinite skeletons with no error/retry. Added a `reload()` to the hook (busts
   the cache + re-fetches) and a dashboard error banner with a Retry button.
3. **Review actions failed silently (attorney-review #1, H).** Status-changing
   server actions returned `void` and bailed silently — a swallowed sign-and-file
   looked identical to success on a legal filing flow. They now return a
   `ReviewActionState`; a new `ReviewActionForm` (useActionState) renders the
   error as `role="alert"`, and `applyTransition` distinguishes applied / no-op /
   thrown-fault.
4. **Store-loss mis-reported as forbidden (data-adapter #3, M).** `resolveCase`
   re-probes `storeConfigured()` before denying, so a transient outage is
   `unconfigured` (503), not a wrong `forbidden` (403) to the real owner.
5. **Null-write logged as a bare store_error (data-adapter #4, M).** `createCase`'s
   configured-store-null now carries a descriptive `cause` so ops can tell it from
   a real backend throw. (addDocument's was already routed to `unconfigured`.)
6. **Attorney note skipped case resolution (attorney-review #4, M).** The attorney
   branch of `addReviewNote` now resolves the case (email leg) before appending,
   so a note can't orphan an audit row against a non-existent caseId.

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 400 pass | 402 pass (+2) |
| eslint (changed) | — | clean |
| next build | PASS | PASS (46/46 pages) |

## Patterns established (catalogue items 24-26)

24. **Return the affected-row count, not void.** A mutation that can match zero
    rows must report that (→ not_found), or every caller reads a no-op as success.
25. **A consumer that destructures only `data` from a `{data,error}` hook re-hides
    the error.** The hook exposing `error` isn't enough — the dashboard must read
    and render it (with a retry), or a fetch rejection is an infinite skeleton.
26. **A `void` server action has no error channel.** For an action whose failure
    matters (legal filing), return a result and surface it via `useActionState`;
    distinguish applied / benign-no-op / thrown-fault rather than one silent bail.

## Remaining backlog

W10 (backend reliability), W11 (money/rate-limit tail), W13 (a11y polish), W14
(content/component drift). Wave 12 was descoped. No criticals; all Highs now
closed.
