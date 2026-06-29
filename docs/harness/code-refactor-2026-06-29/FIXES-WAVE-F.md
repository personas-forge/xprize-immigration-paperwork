# Wave F — Stale/Lying Docs, Comments & Dead Anchors (Theme G)

Branch `vibeman/code-refactor-2026-06-29`, on top of Waves A–E. Almost entirely
comment/markdown/string truth — make the doc match the CURRENT code, never the
reverse. The only functional change is two dead in-page-anchor `href`s. Gates
green throughout: `tsc --noEmit` clean, `npm test` = **455 pass / 0 fail** (no
test added, deleted, or weakened).

## Closed

| # | Finding | Commit | What & verification |
|---|---------|--------|---------------------|
| 1 | marketing-site #1 (MED, **functional**) | `3236e47` | Repointed the two dead anchors. FAQ primary CTA `/#start` → `/qualify` (the real screener, matching the homepage hero CTA at `PassportLanding.tsx:274`); SiteChrome site-wide footer "How it works" `/#how` → `/#checkpoints` (the Process / "how the petition is built" section). Homepage section IDs are `arrival/criteria/checkpoints/evidence/allowance/depart` (`SECTIONS`, PassportLanding.tsx:27-34) — `start`/`how` never existed. Both links now navigate/scroll somewhere real. |
| 2 | marketing-site #3, #4, #2 (MED/LOW) | `ecec01b` | SiteChrome header comment dropped the false "home" (the homepage ships its own PassportLanding nav/footer, not this chrome). `/pricing` redirect comment rewritten — no internal links remain (homepage + FAQ link `/billing`); retained only as external/bookmark/SEO compat. FAQ hardcoded token figures (150/3/12/5/1/$5): added a "keep in sync with economy.ts + registry.ts" maintainer note and left the prose literal (per scope: don't over-engineer a marketing page / it needs real wiring). |
| 3 | llm-engine-observability #1, #3 (MED) | `35013f6` | `cost-telemetry.ts:6` header falsely called `lib/lighttrack.ts` an "unrelated" first-party funnel module — corrected to: it is the VENDORED LightTrack client (same service), and cost-telemetry is a deliberate fork only to add the ALS billing metadata. `docs/llm-engines.md` "Adding an engine" step 1 now points the raw call + `selectEngine` case at `engines.ts` (the single, harness-shared home), then a thin `client.ts` factory. |
| 4 | llm-evaluation-harness #2 (MED) | `4dcb311` | `EVALUATION.md` F2b note called the finished `client.ts` migration "in-flight" and claimed temperature is "kept out of the eval commit." `run.ts:103-107` now sends `temperature: 0` on the qualify branch to mirror production — updated the note + the summary-table row to say so; only the Claude CLI path (no temperature knob) can't exercise it. |
| 5 | validation-jurisdiction #1, #4, #5, #3 (MED/LOW) | `e857bba` | `docs/validation-framework.md` `ValidationRecord` table dropped the deleted `provisional` status (now `verified · needs-review`) and the deleted `verifiedBy` row (added the real optional `title`). Marked the unexercised `"secondary"` SourceRef kind a reserved taxonomy slot (comment, kept — doc documents it as the lowest tier; the `SOURCE_KIND_LABEL` entry is required by the `Record` so it stays). Deleted the orphaned request-time comment stranded above `STATUS_TONE` (the live `connection()`/`instant` comments already explain it). Dropped the now-pointless `export` on `liveJurisdictions` (grep-confirmed: only internal caller `livePrograms`, not in the barrel). |
| 6 | authentication-session #5 · token-economy-ledger #5 · ai-operation-orchestrator #5 (LOW/MED) | `cecb624` | `middleware.ts` comment named the dev-only `__session` cookie though prod uses `__Host-session` — now references `SESSION_COOKIE` + both names. `registry.ts` `costOf` comment pointed at a moved `economy.ts costOf` — reworded to drop the dangling file ref. `operation.ts` header said "the five AI endpoints ... all hand-implement" the pipeline — re-tensed to past and corrected to the **8** specs it now backs (qualify/draft/rfe/guidance/evidence-categorize/rfe-forecast/draft-critique/qualify-best-path). |
| 7 | brand-design-system #3 follow-through (Wave D drift, LOW) | `f9891cc` | `README.md` + `README_work.md` still listed the deleted `stampIn` (Wave D) and `staggerParent` (2026-06-23) motion variants in the feature blurb, the stack list, and the `motion.ts` file-tree comment. `motion.ts` now exports only `easeArrival` + `fadeUp`; updated all three mentions in both files. |

## Anchor-target choices (finding #1)

- **`/#start` (FAQ primary CTA "Take the qualification") → `/qualify`.** The real
  screener route; identical to the homepage hero CTA (`PassportLanding.tsx:274`
  `href="/qualify"` "Take the free qualification") and the SiteChrome header CTA.
  A hash to a non-existent `#start` section scrolled nowhere; `/qualify` actually
  delivers the qualifier the button promises.
- **`/#how` (SiteChrome footer "How it works", renders on every chrome page) →
  `/#checkpoints`.** `checkpoints` is the homepage's Process section
  (`SECTIONS[2]`, label "Process" — "how the petition is built"), the closest
  real anchor to "How it works". A same-page hash that DOES resolve, so the
  footer link scrolls to the process explainer.

## Left with reason (out of this wave's scope)

- **validation-jurisdiction #2 (Legend label "counsel signed — cleared to file").**
  A customer-facing label-semantics change, not in the prompt's enumerated set for
  this wave (orphaned comment / export / secondary). It contradicts the framework's
  per-case-filing-gate contract and is worth fixing, but as a copy decision it's
  left for a UI/content pass.
- **All flagged CODE items deferred to the next wave** per scope: the trackLlm
  success-path duplication, `isLongTierOnFastFallback`, and `ModelSource`-redefines-
  `LlmEngine` (llm-engine-observability #2/#4/#5); the `server-only` guard façade
  and pglite `iso()` consolidation (authentication-session #2/#3); the `costOf`-vs-
  `labelOf` totality and `ChargeOutcome`/`ChargeResult` items already addressed in
  Wave E. These are real refactors, not comment truth — out of Theme G.
- **FAQ token figures (#2): note-not-wire.** Deriving 6+ mid-sentence figures from
  `costOf`/`FREE_SIGNUP_GRANT`/`bundlePriceLabel` would rewrite customer copy as
  template literals on a server-rendered marketing page; the prompt's guidance was
  to add a sync note if it needs real wiring rather than over-engineer it. Note
  added; values verified currently correct vs the source of truth.

## Notes / things worth your attention

- **Two CRLF warnings** on commit (`pricing/page.tsx`, `cost-telemetry.ts`,
  `validation/page.tsx`) are Git's normal LF→CRLF autocrlf notices on Windows —
  no content impact.
- The anchor fix was committed FIRST and in isolation (only the two `href`
  changes) so the one functional change in this wave is reviewable on its own,
  separate from the adjacent comment-truth edits in the same files.
