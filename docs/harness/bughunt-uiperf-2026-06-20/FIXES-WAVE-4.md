# Bug Hunter + UI Perfectionist — Fix Wave 4: False-success / data-integrity (Drafting)

> 1 commit, 3 findings closed (1 Critical [verified FALSE POSITIVE + hardened], 2 High).
> Baseline preserved: tsc 0 → 0, tests 393 → 395 pass (+2 new), lint clean.
> Mental model: *a failure must look like a failure — no "Saved ✓" without a
> write, no silent section clobber, no charge for work that can't persist.*

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `75585b7` | petition-drafting #1 (C, FP+hardened), #2, #3 | draftOperation.ts (+test), draft/save route, saveRecovery.ts (+test), DraftStudio.tsx |

## What was fixed

1. **"Saved ✓" while persisting nothing (#1, Critical → VERIFIED FALSE POSITIVE +
   hardened).** The subagent traced `@/lib/data/petitions` (returns `null` on
   no-store), but the save route imports the ADAPTER, whose `saveDraft` already
   converts a no-store `null` to `err("unconfigured")` → **503** (not `200
   {version:null}`), so `retrySaveDraft` sees `!res.ok` and correctly keeps the
   unsaved state. The live false-success path is **not reachable today**.
   Hardened against regression anyway: the route emits an explicit `persisted:
   true`, and `retrySaveDraft` now treats a 2xx WITHOUT a numeric version as
   still-unsaved (the `RetrySaveResult` ok variant is now `version: number`).
   *(Verify-before-fix catch — the ~9% FP rate the playbook warns about.)*
2. **Merge clobbers duplicate/reserved headings (#2, H).** `mergeRegeneratedSection`
   (and the client `setSections` map) matched by heading string and overwrote
   EVERY match. Headings are free-form and can collide, so regenerating one
   section replaced a distinct argument section's body — silent corruption of a
   paid draft. Both now replace only the FIRST match. Added a dup-heading test.
3. **Charge without a persistable output (#3, H).** A section regenerate billed
   `draft_section` but could persist nothing when no merge base existed (client
   sections lack the focus AND no stored draft). `parse` now rejects with a 409
   (no charge) "generate the full letter first" before charging.

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 393 pass | 395 pass (+2) |
| eslint (changed) | — | clean |

## Patterns established (catalogue items 13-14)

13. **Verify the import the consumer ACTUALLY uses before fixing.** A finding that
    traces a lower-level module (`lib/data/petitions`) can be a false positive if
    the caller routes through a hardening seam (the adapter that converts null →
    `unconfigured`). Confirm the real call graph; then harden defensively so the
    guarded behaviour can't silently regress.
14. **A string heading is not an identity.** Merging/replacing by a free-form
    label clobbers collisions. Match by index/first-occurrence, or assign stable
    ids — never assume user/model text is unique.

## What remains

petition-drafting #4 (first-generate seeding, M — the 409 gate defers this
cleanly), #5 (stale "Saved ✓" pill after regenerate, L). Waves 5-8 per INDEX.
