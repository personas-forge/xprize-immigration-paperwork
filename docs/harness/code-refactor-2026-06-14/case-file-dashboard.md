# Code Refactor Scan — Case File Dashboard

> Total: 5 (C0 / H2 / M2 / L1)

## 1. `BalancePill` + local `ThemeToggle` triplicated byte-for-byte across three view shells
- **Severity**: high
- **Category**: duplication
- **File**: src/features/dashboard/DashboardView.tsx:59 / src/features/case-file/components/CaseDetailView.tsx:248 / src/features/review/components/ReviewQueueView.tsx:112
- **Scenario**: Each of the three dashboard-chrome shells (the mock dashboard, the real per-case detail, and the attorney review queue) declares its own private `BalancePill({ balance })` and `ThemeToggle({ dark, onToggle })`. All three copies are character-identical: the `BalancePill` markup (Link to /billing, `◈` glyph, `∞`/`toLocaleString()` label, exact Tailwind class string) and the dark/parchment `ThemeToggle` (`☾`/`☼` glyph, "Ink"/"Parchment" label, identical classes) match across files.
- **Root cause**: Each shell was built (or copied) independently inside its own feature folder; the shared `@/components/ThemeToggle` is the *global* persisted toggle (no props), so the local dark-state-driven variant was re-pasted rather than extracted to a shared component.
- **Impact**: Three copies to keep in sync — a token, aria-label, or a11y/contrast fix to the pill or toggle (this codebase actively tunes contrast — see themes.contrast.test.ts) must be applied three times or silently drifts. ~70 lines of duplicate JSX.
- **Verification**: Read all three files. The two functions are identical in DashboardView.tsx (59-96), CaseDetailView.tsx (248-279), and ReviewQueueView.tsx (112-143). Grep for `BalancePill|ThemeToggle` confirms only these three local definitions of the prop-driven variant plus the unrelated global `@/components/ThemeToggle` (no-arg, persisted) used by static pages.
- **Fix sketch**: Extract a `DashboardChrome`/`TopBarActions` pair (or a shared `BalancePill` + `LocalThemeToggle`) into `@/features/dashboard/` and import in all three shells. Keep the prop contract (`balance`, `dark`, `onToggle`) so no behavior changes.

## 2. Criteria-table markup duplicated between `CriteriaTable` and `CaseDetailView`'s inline table
- **Severity**: high
- **Category**: duplication
- **File**: src/features/case-file/components/CaseDetailView.tsx:140 (inline table) vs src/features/case-file/components/CriteriaTable.tsx:53
- **Scenario**: The real per-case detail view (`CaseDetailView`) hand-rolls a full `§ … criteria` `<Card>` + `<table>` (header card, zero-padded index column, `<Badge tone={statusTone(c.status)}>`, hover row styling, evidence cell) at lines 140-189 — the same table structure `CriteriaTable.tsx` already renders for the mock dashboard. Both call the shared `statusTone` from `../criteria`, but everything around it (thead, row layout, padding, hover classes, index `padStart(2,"0")`) is copy-pasted with minor field differences (`evidence || rationale` fallback; no `CriterionPrimerButton`; no `summarizeCriteria` header badge).
- **Root cause**: `CriteriaTable` takes a `Criterion[]` (the mock shape) while the detail view has a richer `DetailCriterion[]` (adds `rationale`, drops `exhibit`). Rather than widen `CriteriaTable` to accept both, the table was re-implemented inline.
- **Impact**: Two table renderers for the same concept; styling/a11y/tone changes land in one and not the other (the detail table already lacks the primer button and the derived qualifying/partial summary the mock table shows). Future per-case features (primers, summary badge) must be re-built.
- **Verification**: Read both components. CaseDetailView.tsx:154-188 reproduces the thead/tbody/Badge/index pattern of CriteriaTable.tsx:53-92; both import `statusTone` from `../criteria`. The only structural divergence is the data shape and the omitted primer/summary.
- **Fix sketch**: Generalize `CriteriaTable` to accept a row type with optional `exhibit`/`rationale` and an optional `showPrimer`/`summary` flag, then render it from `CaseDetailView`. Drives both tables from one component; the summary badge and primer become opt-in.

## 3. `usePersistentQuery` and `bannerDismiss` re-implement the same useSyncExternalStore + localStorage store
- **Severity**: medium
- **Category**: duplication
- **File**: src/features/case-file/usePersistentQuery.ts:65 vs src/features/dashboard/bannerDismiss.ts:10
- **Scenario**: Both modules implement the identical FOUC-free localStorage pattern: a module-level `cache = { raw, value }`, a try/catch `readRaw`/`getItem`, a `getSnapshot` that re-parses only when `raw !== cache.raw`, a `getServerSnapshot` returning the default, and a `subscribe` that adds/removes both a custom `EVENT` and the `"storage"` event. `bannerDismiss.ts`'s own header comment says it "Follows the same useSyncExternalStore + localStorage pattern as usePersistentQuery.ts" — the duplication is acknowledged in-code.
- **Root cause**: No shared `useLocalStorageStore(key, parse, default)` primitive exists, so the second consumer copied the first's mechanics and only varied the value type (CaseQuery vs boolean) and key.
- **Impact**: Two hand-written external stores with subtle invariants (snapshot reference stability, dual-event subscribe, write-without-notify on failure). A bug fix in one (e.g. the "don't notify on failed write" subtlety in usePersistentQuery.write) won't propagate. Moderate, contained duplication.
- **Verification**: Read both files in full. The cache/parse/readRaw/getSnapshot/getServerSnapshot/subscribe shapes match; only `sanitize`/`parse` (query-specific) and the `"1"`-vs-JSON encoding differ.
- **Fix sketch**: Extract a generic `createPersistentValue<T>({ key, parse, serialize, fallback })` returning `{ getSnapshot, getServerSnapshot, subscribe, write }` (or a `usePersistentValue` hook) and have both modules supply only their codec. Keep behavior (best-effort writes, no-notify-on-failure) identical.

## 4. Dead data-layer exports: `getCaseById` and `getFormById`
- **Severity**: medium
- **Category**: dead-code
- **File**: src/lib/data/cases.ts:34 (`getCaseById`) and src/lib/data/forms.ts:52 (`getFormById`)
- **Scenario**: Both functions are defined and re-exported from `@/lib/data` (index.ts:11, index.ts:17) but never called anywhere in the app or tests. The real per-case page (app/dashboard/cases/[id]/page.tsx) fetches via `getCaseForUser`/`getCaseAnyOwner` from `@/lib/data/petitions`, not `getCaseById`; the guidance panel uses `getForms()` (the catalog) but never resolves a single form by id.
- **Root cause**: Both were added as part of the "typed async accessor" boundary scaffolding (the by-id companions to the list accessors) in anticipation of detail screens that ended up sourcing data from the Store-backed `petitions` layer instead.
- **Impact**: Dead public surface on the data boundary — invites a future caller to use the in-memory `getCaseById` (which only searches the *mock* `getCases()` list) instead of the auth-scoped Store path, a latent correctness/IDOR-adjacent footgun. Low LOC but on a security-relevant boundary.
- **Verification**: Grep across the whole repo (incl. tests, app, e2e) for `getCaseById` and `getFormById`: each matches only its definition and the `index.ts` re-export — zero call sites. (`getForms` and `getCases` are genuinely used and were left in place.)
- **Fix sketch**: Remove both functions and their `index.ts` re-export lines. If a single-case fetch is wanted later, route it through the Store-backed, user-scoped `petitions` accessors that already enforce ownership.

## 5. Dead theme aliases `teal` / `midnight` with a now-false justification comment
- **Severity**: low
- **Category**: dead-code
- **File**: src/features/dashboard/themes.ts:71
- **Scenario**: `themes.ts` ends with `export const teal = parchment;` / `export const midnight = ink;` under a comment claiming they "preserve the original `teal`/`midnight` exports so existing imports in DashboardView keep working." DashboardView (and every other consumer) imports `ink`/`parchment`, not `teal`/`midnight`.
- **Root cause**: A rename (`teal`→`parchment`, `midnight`→`ink`) left back-compat aliases that all call sites were then migrated off of, but the aliases (and their justification) were never removed.
- **Impact**: Two misleading exports plus a comment that asserts a dependency that no longer exists — future readers may preserve them believing DashboardView needs them. Cosmetic.
- **Verification**: Grep `\bteal\b|\bmidnight\b` across src: only the two definitions (themes.ts:73-74), the stale comment (themes.ts:71), and an unrelated CSS comment in globals.css ("/* midnight ink */"). No import of either symbol anywhere.
- **Fix sketch**: Delete lines 71-74 of themes.ts (the comment + both aliases).

---

Notes on verified non-findings (certainty / FP-avoidance):
- The "overlapping data-fetch modules" hypothesis (caseFileData.ts / useCaseFileData.ts / usePersistentQuery.ts / data.ts) is NOT dead or duplicated. They are cleanly layered: `caseFileData.ts` is a pure, dependency-injected `Promise.all` fetch with a module cache (unit-tested via the node runner); `useCaseFileData.ts` is the thin React wrapper that injects the real `@/lib/data` fns; `usePersistentQuery.ts` is an unrelated localStorage-backed query store; `data.ts` holds the live-demo fixtures and is consumed by `@/lib/data/cases.ts` and the criteria tests. All actively used — left alone.
- The two `statusTone` functions (criteria.ts vs the local one in CaseList.tsx:44) are NOT duplicates: one classifies `CriterionStatus` (Met/Strong/Partial) per ADR-0002, the other maps `CaseStatus` (Intake/Filed/Approved…) to badge tones. Different domains; correctly separate.
