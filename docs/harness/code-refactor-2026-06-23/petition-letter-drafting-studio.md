# Code Refactor — Petition Letter Drafting Studio
> Total: 5 (C0/H1/M3/L1)

## 1. DraftStudio re-implements `mergeRegeneratedSection` inline instead of reusing the pure helper
- **Severity**: High
- **Category**: duplication
- **File**: src/features/drafting/components/DraftStudio.tsx:247-256 (vs src/features/drafting/draftOperation.ts:93-106)
- **Scenario**: On a section regenerate the client must merge the new body into its current sections by replacing **only the first** heading match (headings can collide). `draftOperation.ts` already exports a pure, unit-tested `mergeRegeneratedSection(base, focus, body)` that does exactly this, and the server calls it on persist. The client `regenerate` handler hand-rolls the identical `let replaced = false; prev.map(...)` first-match loop. The code's own comment (DraftStudio.tsx:245-246, "mirrors the server-side mergeRegeneratedSection fix") admits it is a manual mirror. Grep: `mergeRegeneratedSection` resolves to draftOperation.ts (def + test) and is NOT imported by DraftStudio — line 246 is only a comment.
- **Root cause**: The merge rule lives in two places — a pure helper for the server, an inline copy for the client — with nothing tying them together.
- **Impact**: The client- and server-side merges can silently diverge. Since the server persists `merged = mergeRegeneratedSection(...)` while the client renders its inline copy, any future fix to the collision rule applied to only one side corrupts a paid draft (the screen shows one section order, the saved version another). This is the "misleading/duplicated logic causing divergence bugs" class, on a paid work-product path.
- **Fix sketch**: Import `mergeRegeneratedSection` from `@/features/drafting/draftOperation` and call `setSections((prev) => mergeRegeneratedSection(prev, heading, data.section.body))`. One definition, already covered by draftOperation.test.ts.

## 2. `DraftSectionRow` is a structural triplicate of `DraftSection`
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/data/petitions.ts:140-143 (vs src/features/drafting/drafting.ts:59-62 and src/lib/db/store.ts:125-128)
- **Scenario**: `interface DraftSectionRow { heading: string; body: string }` in petitions.ts is byte-for-byte the same shape as `DraftSection` (drafting.ts) and the store's `DraftSection` (store.ts:125). All three flow through the same draft-persistence path: drafting builds `DraftSection[]`, the adapter/route pass them as `DraftSectionRow[]`, the store takes `DraftSection[]`. Grep `DraftSectionRow|DraftSection` shows the three independent declarations.
- **Root cause**: Each layer redeclared the row shape "to stay decoupled" rather than importing one canonical `{heading, body}` type.
- **Impact**: A field change (e.g. adding a `cited` flag) must be made in three files or the types silently fall out of sync at the `as` casts in the store readers (pglite-store.ts:922, firestore-store.ts:786). Low blast radius today, but it is real duplicated structure with no shared anchor.
- **Fix sketch**: Define one `DraftSectionRow` (or reuse `DraftSection`) in a leaf type module (e.g. alongside the store contract) and have petitions.ts + the store import it. The decoupling argument is already satisfied by `criteria-text.ts` for the criterion shape; do the same for the row.

## 3. petitions.ts repeats the `getStore() → no-op-if-null → delegate` boilerplate 11 times
- **Severity**: Medium
- **Category**: structure
- **File**: src/lib/data/petitions.ts:81-91, 94-100, 103-110, 118-122, 125-129, 132-138, 156-164, 167-171, 182-191, 194-200 (and createCaseWithCriteria)
- **Scenario**: Every exported data function is the same five lines: `const store = await getStore(); if (!store) return <empty>; return store.<sameMethod>(...args)`. Eleven near-identical wrappers, differing only in method name, args, and the no-store sentinel (`null` / `[]`). The adapter (petition.ts) then wraps each of these a second time. The module JSDoc itself calls this out: "when no store is configured every function no-ops."
- **Root cause**: Hand-written pass-through per store method; the graceful-degradation contract isn't expressed once.
- **Impact**: Adding a store method means adding yet another copy-pasted wrapper, and a wrong sentinel (returning `null` where `[]` is expected, or vice-versa) is an easy copy-paste slip the types won't always catch. It also pads the file and obscures the few functions that do real work (`newFileNumber`, `filePrefix`).
- **Fix sketch**: Most of these are pure delegations to identically-named `store.*` methods — a thin `withStore(fn, fallback)` helper, or generating the read pass-throughs, would collapse the boilerplate and centralize the no-store sentinel. Keep `createCaseWithCriteria`/`newFileNumber` (they add logic) explicit. This is structure cleanup, not behavior change.

## 4. Copy-button state→label ternary duplicated across DraftStudio and SaveFailedAlert
- **Severity**: Low
- **Category**: duplication
- **File**: src/features/drafting/components/DraftStudio.tsx:513 (vs src/features/drafting/components/SaveFailedAlert.tsx:47-51)
- **Scenario**: Two places map the same `CopyState` (`"idle" | "copied" | "failed"`) to button text. DraftStudio.tsx:513: `copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Copy failed — retry" : "Copy letter"`. SaveFailedAlert.tsx:47: the same three-way branch with `"Copy draft"` / `"Copy failed — select & copy manually"`. Same state machine, two hand-written renderings; the "Copied ✓" arm is verbatim duplicated.
- **Root cause**: The `CopyState`→label mapping was inlined at each call site.
- **Impact**: Minor. A change to the copied/failed wording (or adding a state) must be made in two spots; they already differ in the idle/failed copy, which is the kind of drift duplication invites. Cosmetic, but a clean single-source target.
- **Fix sketch**: A small `copyButtonLabel(state, { idle })` helper in saveRecovery.ts (where `CopyState` semantics already live) returning the shared "Copied ✓" / failure text, parameterized by the idle label, used by both components.

## 5. DraftStudio holds pure transform logic that belongs in the drafting module
- **Severity**: Medium
- **Category**: structure
- **File**: src/features/drafting/components/DraftStudio.tsx:723-728 (`scoreTone`), 301-303 (critiques→map), 209/266 (`typeof data.version === "number" ? ... : null`)
- **Scenario**: The 770-line component is large by design (it hosts the redline + RFE-radar moonshots), so a blind "split the file" is the wrong move — but several pieces are pure, untested logic that could move to the pure module rather than just relocate within the file. `scoreTone(score)` (0-100 → badge tone, sharing the `WEAK_SECTION_SCORE`/60 thresholds) is pure and is the UI twin of the redline gate; the `for (const c of data.critiques) map[c.heading] = c` keying (line 301-303) reduces a `SectionCritique[]` to a `Record<heading, SectionCritique>`; the `typeof data.version === "number" ? data.version : null` version coercion is repeated at lines 209 and 266.
- **Root cause**: Presentation-adjacent pure helpers accreted in the client component, where they can't be unit-tested (the module is `"use client"`, the test glob renders only via react-dom/server).
- **Impact**: These transforms encode product rules (score banding, critique keying) with zero test coverage, while the analogous rules in drafting.ts (`overallCritiqueScore`, `clampScore`) are tested. Logic that decides how a paid critique maps onto sections lives outside the unit-tested seam.
- **Fix sketch**: Move `scoreTone` and a `critiquesByHeading(critiques)` helper into drafting.ts beside `overallCritiqueScore`, export the repeated `numericVersion(value)` coercion (or a tiny `lib/` util), and import them. The component keeps JSX; the rules become testable. Do NOT split the JSX itself — the size is legitimate moonshot hosting per the grounding note.
