# Code Refactor — O-1A Eligibility Screening & Questionnaire
> Total: 5
> Critical: 0 | High: 1 | Medium: 2 | Low: 2

## 1. Screening form + client state machine triplicated across three components
- **Severity**: High
- **Category**: consolidation
- **File**: src/features/qualification/components/QualifyPanel.tsx:36 (+ InstantVerdict.tsx:29, BestPathFinder.tsx:21)
- **Scenario**: `QualifyPanel`, `InstantVerdict` and `BestPathFinder` each re-implement the same screening form and the same client lifecycle: `useState` for `name`/`profile`/`status`/`error`/`result`, a `useRef` in-flight guard (`submitting`/`busy`), the identical name `<input>`, the achievements `<textarea>` (same Tailwind classes + placeholder), the "Ready ✓ / N more characters" counter, the "Use a sample" button (`onClick={() => setProfile(SAMPLE_PROFILE)}`), and the same `e.preventDefault → length<40 guard → setStatus("loading") → fetch → 429/error/done` handler. QualifyPanel and InstantVerdict additionally both compute `const PROGRAMS = livePrograms()` at module top and render the same visa `<select>`, and both render `<CriteriaReport>` + `<LettersPatentShare>` on the done state.
- **Root cause**: The funnel grew one surface at a time (instant-verdict hero, then best-path finder, then the authenticated panel — "moonshot #7/#16"), each copying the previous form rather than extracting a shared primitive.
- **Impact**: ~120 lines of near-identical JSX/logic in three files. A change to the form (a new field, a copy tweak, an accessibility fix, the busy-guard) must be made in three places and will silently drift — the counter copy already differs ("Ready to screen ✓" vs "Ready ✓") and the textarea `rows` differs (7 vs 6) for no reason.
- **Fix sketch**: Extract a `useScreeningForm()` hook (name/profile/status/error/busy-ref + the submit/fetch scaffold parameterized by endpoint + response handler) and a presentational `<ScreeningFields>` (name input, optional visa select, textarea + counter, sample button). Have all three components compose them; keep only the per-surface bits (preview vs authenticated endpoint, paywall vs soft-gate, certificate frame).

## 2. The 40-character minimum is hardcoded ~6× in clients while `MIN_PROFILE` owns it un-exported
- **Severity**: Medium
- **Category**: consolidation
- **File**: src/features/qualification/qualification.ts:74 (vs QualifyPanel.tsx:72,179,184,186; InstantVerdict.tsx:47,140,143,145; BestPathFinder.tsx:39,123,125)
- **Scenario**: `qualification.ts` defines the server-side contract `const MIN_PROFILE = 40` (used in `parseQualifyRequest` and the user-facing error), but it is **not** exported. All three client components re-hardcode the literal `40` for their pre-submit gate and live character counter (`profile.trim().length < 40`, `${40 - profile.trim().length} more characters`).
- **Root cause**: The constant was kept private to the pure module; the client validators were written independently to mirror it by eye.
- **Impact**: The client gate and the server's `MIN_PROFILE` are the same contract maintained in two unlinked places. If the minimum changes on the server, the clients keep enforcing 40 — a user could pass the client gate yet get a 400 ("Describe your background in at least N characters"), or vice-versa. Six literal occurrences to find-and-update by hand.
- **Fix sketch**: `export const MIN_PROFILE = 40` from `qualification.ts` (and via `index.ts`), import it in the three components, and reference it in both the guard and the counter math. Single source for the min-length contract.

## 3. Stale "O-1A only" comments on what are now multi-product surfaces
- **Severity**: Medium
- **Category**: cleanup
- **File**: src/features/qualification/components/QualifyPanel.tsx:24 (and src/app/api/qualify/route.ts:15)
- **Scenario**: QualifyPanel's header comment says the screening is "mapped onto the **eight O-1A criteria**", yet the very same component renders a visa `<select>` over `livePrograms()` and scores O-1B (6 criteria) or EB-1A (10 criteria) just as readily — `CriteriaReport` renders the pack-specific set, not always eight. Likewise `route.ts:15` opens with "**O-1A qualification screening endpoint**" though it screens every live classification (the prompt, packs and persistence are all `classification`-driven).
- **Root cause**: The feature began O-1A-only; the multi-product packs (`packs.ts`, ADR-0001 2026-06-14 note) were layered in later and these orienting comments were never updated.
- **Impact**: Misleads the next reader into thinking the surface is O-1A-specific (it isn't), inviting wrong assumptions about the threshold/criteria count on a legal-correctness surface.
- **Fix sketch**: Reword to "the selected classification's criteria pack" / "multi-product qualification screening endpoint (O-1A · O-1B · EB-1A)". Pure comment edits.

## 4. Redundant `as ScoreStatus` casts on string literals in `mockQualification`
- **Severity**: Low
- **Category**: cleanup
- **File**: src/features/qualification/qualification.ts:260
- **Scenario**: `status: hit ? ("Met" as ScoreStatus) : ("None" as ScoreStatus)` casts two string literals that are already members of `ScoreStatus`. The surrounding `criteria` is typed `ScoredCriterion[]`, so `hit ? "Met" : "None"` already narrows correctly without the assertions.
- **Root cause**: Defensive casting carried over from an earlier shape; never trimmed.
- **Impact**: Cosmetic noise that makes the literal look like it needs coercion (it doesn't), and a needless `as` weakens the value of real casts elsewhere in the file (e.g. `coerceStatus`).
- **Fix sketch**: Drop both assertions: `status: hit ? "Met" : "None"`.

## 5. Historical "BEHAVIOUR CHANGE vs the pre-orchestrator route" changelog left inline
- **Severity**: Low
- **Category**: cleanup
- **File**: src/app/api/qualify/route.ts:25
- **Scenario**: A multi-line comment block narrates a past migration ("BEHAVIOUR CHANGE vs the pre-orchestrator route: qualify now enforces a per-window rate limit … Previously this was the only token-charged AI route with NO frequency cap …"). The change has long shipped; the route now simply *has* a rate limit (declared two lines down as `rateLimit: { bucket: "qualify", … }`).
- **Root cause**: PR-description prose pasted into the source at migration time and never pruned once the diff was history.
- **Impact**: Reads as a diff against code that no longer exists; a new reader spends effort reconstructing a "previous" route that isn't there. The rationale that's worth keeping (why qualify is rate-limited) survives in one short line.
- **Fix sketch**: Collapse to a single present-tense sentence — "Rate-limited per user (bucket `qualify`) so an authenticated caller can't loop the medium-cost screening to drain their balance." Drop the before/after narration (git carries the history).
