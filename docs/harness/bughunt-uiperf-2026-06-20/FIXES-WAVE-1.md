# Bug Hunter + UI Perfectionist — Fix Wave 1: Legal correctness & integrity

> 4 commits, 7 findings closed (3 Critical, 4 High) + 1 folded Medium.
> Baseline preserved: tsc 0 → 0, tests 378 → 383 pass (+5 new), lint clean.
> Mental model: *the legal/correctness output must not lie — a wrong verdict,
> stale rule, or stale consent shown as current is the worst class of bug here.*

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `87162a7` | validation #1, #2, #3 (+#4 folded) | C, H, H (+M) | validation.ts (+test), index.ts, validation/page.tsx, validation-framework.md |
| 2 | `0dad53c` | o1a #1, #2 | C, H | qualification.ts (+test), CriteriaReport, QualifyPanel, InstantVerdict, best-path.ts (+test) |
| 3 | `6e5cafd` | consent #1, #2, #3 | C, H, H | store.ts, pglite-store, firestore-store, auth/db, session.ts, welcome/page, welcome/actions |
| 4 | `ba2a42c` | guidance #1 | H | api/guidance/route, FieldGuidancePanel |

## What was fixed

1. **Freshness fails OPEN on a bad date (C).** An unparseable `lastVerified`
   made `daysBetween` → NaN, and every NaN comparison is false, so `freshnessOf`'s
   classifier fell through to **"fresh"** — a corrupt-dated legal rule shown as
   current, CI exiting 0. Now it fails SAFE to **"stale"** with an `unverifiable`
   flag. The /validation card header escalates to a danger badge so the prominent
   status chip can't read green while stale. Re-introduced `isStale` as a DRY
   wrapper (the symbol the docs already named — it had been deleted as dead code,
   now it has a real caller) + a commit-CI test that fails if any LIVE program is
   overdue. Folded in the `todayIso`-shadow rename (#4).

2. **Eligibility verdict scored against the wrong program (C).** `CriteriaReport`
   read its qualifying threshold from the live "Visa type" `<select>`, not the
   classification the result was scored against — so changing the dropdown
   post-submit rendered the verdict against another program's rule. The scored
   `classification` is now pinned into the result and the threshold derives from
   it; the form-driven prop is removed so the drift can't return.

3. **Mock likelihood contradicted the verdict (H).** A 2-of-3 (below-threshold)
   profile showed "54%"; an empty one a 38% floor. Replaced the affine heuristic
   with `mockLikelihood`, DERIVED from the verdict (0→0%, below-threshold <50%,
   meets-threshold 55-95%), so the headline % can't disagree with the badge.

4. **Consent never re-prompted after a terms bump (C).** `consent_version` was
   write-only. Added `Store.getLatestConsentVersion`; the gate + `/welcome` now
   re-collect consent when it ≠ `CONSENT_VERSION`.

5. **Consent onboarding ordering + opacity (H, H).** The token grant ran before
   the consent write in one try, so a grant hiccup aborted consent and was
   misreported as a consent failure; the bare `catch {}` logged nothing.
   Consent now persists first (essential), grant is best-effort + logged, and
   both catches `console.error` with the userId (no PII).

6. **Guidance bypassed live UPL screening (H).** The guidance route never passed
   an `adjudicate` callback even though `runAdjudication` has a `case "guidance"`.
   Wired it (mirroring qualify) + surfaced the verdict via `AdjudicationBadge`.

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 378 pass | 383 pass (+5) |
| eslint (changed files) | — | clean |

## Patterns established (catalogue items 1-4)

1. **Fail-OPEN on NaN comparison.** A classifier written as
   `x < 0 ? A : x <= k ? B : C` silently returns `C` when `x` is `NaN` (all
   comparisons false). For any safety/freshness gate, guard `Number.isNaN` FIRST
   and fail to the SAFE branch — never let an unparseable input read as healthy.
2. **Pin the derivation key into the result, never read it from live form
   state.** A read-out (threshold, denominator, label) computed from mutable UI
   state can drift from the data it describes after the user edits the form
   without re-submitting. Echo the key the result was computed against into the
   result payload and derive from that.
3. **Derive a headline metric from the verdict it sits beside.** Two independent
   numbers (a % and a pass/fail badge) computed separately can tell opposite
   stories. Bind the secondary metric to the primary verdict's bands.
4. **Write-only audit columns are silent bugs.** A version/timestamp dutifully
   WRITTEN but never READ back (consent_version) looks correct in the DB while
   the guarantee it implies (re-prompt on change) silently does nothing. Every
   versioned write needs a read-back comparison somewhere.

## What remains

Waves 2-8 per INDEX: money & metering (W2), security boundary (W3), false-success
/ silent-failure (W4), eval-harness false-green (W5), accessibility (W6),
reliability/resource (W7), UI consistency/drift (W8). All 3 remaining criticals
(rate-limit XFF bypass, 2× eval-harness false-green) land in W3 + W5.
