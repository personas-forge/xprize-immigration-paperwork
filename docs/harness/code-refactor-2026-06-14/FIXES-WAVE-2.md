# Code Refactor — Fix Wave 2 — Disclaimer / UPL single source of truth

> 5 commits, 6 findings closed (incl. the consent#1 ≡ guidance#4 cross-report pair).
> Baseline preserved: tsc 0→0 errors; tests 282→283 pass / 0 fail (+1 = the new
> CONSENT_DISCLAIMER regression assertion). Lint clean on all 16 touched files.

## Commits

| # | Commit | Finding closed | Severity | Theme |
|---|---|---|---|---|
| 1 | `2f61ffd` | consent #1 ≡ form-field-guidance #4 — divergent `ATTORNEY_DISCLAIMER` | H | D (disclaimer SoT) |
| 2 | `1c820b2` | form-field-guidance #2 — misplaced shared UPL primitives | H | D / structure |
| 3 | `ed8cadb` | form-field-guidance #1 — dead guidance-barrel re-exports | H | E (dead code) |
| 4 | `ed7e98c` | form-field-guidance #5 — duplicated disclaimer docstring | L | D / cleanup |
| 5 | `79252e3` | eligibility-screening #3 — redundant qualification `DISCLAIMER` re-export | M | D / structure |

## What was fixed

1. **`CONSENT_DISCLAIMER` to the canonical audited home.** `ConsentForm` hardcoded its own `ATTORNEY_DISCLAIMER` — a second source of truth for a UPL legal string that diverged in wording from the canonical `DISCLAIMER` and would silently miss any legal-review edit. The exact sign-up wording (verbatim, no copy change) now lives as `CONSENT_DISCLAIMER` in `@/lib/result`, beside `DISCLAIMER`, with a content regression assertion mirroring the existing `DISCLAIMER` test.
2. **Relocated `DisclaimerStamp` + `CitationNote` to `@/components/legal`.** These cross-cutting UPL primitives were housed under `@/features/guidance` but used by drafting, RFE, qualification (×2), guidance, and the app-level `ConsentForm` — coupling 5 features to one. Moved both to a shared `@/components/legal` barrel and updated all 7 importers; the safeguard now belongs to the app, not to `guidance`.
3. **Reduced the guidance barrel to its real surface.** `@/features/guidance` (bare) is imported in exactly one place (`CaseFileDashboard`, for `FieldGuidancePanel`); the `DISCLAIMER`/`buildGuidance*`/`mockGuidance`/`parseGuidanceRequest` re-exports were never resolved through it — dead surface that invited drift. Barrel now exports only `FieldGuidancePanel`.
4. **De-duplicated the disclaimer docstring.** The "MUST accompany every AI output / UPL safeguard" prose was byte-duplicated on both the canonical constant and the guidance re-export. Replaced the copied block with a one-line pointer; authoritative docstring stays in `@/lib/result`.
5. **Collapsed the `DISCLAIMER` re-export chain.** `qualification.ts` imported `DISCLAIMER` from guidance and re-exported it onward (result → guidance → qualification). Retargeted qualification's import + its two real consumers directly to `@/lib/result`, then removed the redundant re-export.

## Verify-before-fix catch (important)

Finding eligibility #3 was reported as a *dead* re-export, but my own typecheck after deleting it surfaced **two real consumers** — `QualifyPanel.tsx` and `qualification.test.ts` — that imported `DISCLAIMER` via **relative** paths (`../qualification`, `./qualification`), which the scan agent's `@/`-aliased grep had missed. Rather than blindly delete, I retargeted both consumers to the canonical `@/lib/result` (which actually serves the SoT goal better), then removed the re-export. This is the ~9%-false-positive guard paying off: the deletion was safe *only after* fixing the consumers.

## Verification

| Gate | After Wave 1 | After Wave 2 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 282 / 0 | 283 / 0 |
| lint (touched files) | clean | clean |

## Cumulative status (waves 1–2)

| Wave | Theme | Findings closed | Commits |
|---|---|---:|---:|
| 1 | Dead-code deletion | 7 | 7 |
| 2 | Disclaimer / UPL single source of truth | 6 | 5 |

**13 of 88 findings closed.** Pattern catalogue: 6 items.

## Patterns established (catalogue items 5–6)

5. **One audited home per legal string.** For a UPL-sensitive product, every disclaimer variant must live in the single audited module (`@/lib/result`) — not forked into a component, even when a context needs a nuance (sign-up's "no attorney–client relationship"). Capture the nuance as a *named sibling constant* with its own content regression test; never hand-roll the prose at the call site.
6. **Relative-path imports defeat `@/`-aliased greps — typecheck is the real verifier.** A "dead export" claim verified only by grepping the `@/alias` path misses `../` and `./` relative importers. After removing any export, `tsc --noEmit` (TS2459 "declares X locally, but it is not exported") is the authoritative deadness check. Retarget the surfaced consumers to canonical rather than reverting.

## What remains

13 → ~67 distinct issues open. Deferred from this wave: form-field-guidance #3 (`GuidanceResponse`/`buildGuidanceResponse` duplicate `Result<T>`/`wrapResult`) — a response-envelope refactor that changes the guidance route + panel consumers; better as its own pass (candidate for Wave 7).

Next: **Wave 3 — LLM parse/coercion consolidation** (extract the byte-identical `toSection` from drafting/rfe/saveRecovery into `@/lib/llm/json`; delete the test-only `parse*` dead surface; dedupe `str`/`criteriaLines`).
