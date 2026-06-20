> Total: 5 | Critical: 0 | High: 2 | Medium: 2 | Low: 1
> Context: Case File Dashboard
> Lens mix: bug-hunter 2, ui-perfectionist 3

## 1. `useCaseFileData` error state is dropped — a fetch failure shows infinite skeletons, never an error

- **Severity**: High
- **Lens**: bug-hunter
- **Category**: error boundary / UX state coverage
- **File**: src/features/case-file/components/CaseFileDashboard.tsx:21 (consumer); src/features/case-file/useCaseFileData.ts:33-67 (source)
- **Scenario**: The composited fetch (`fetchCaseFileData`) rejects — e.g. the data layer throws, a server action 500s, or one of the four `Promise.all` legs fails. `useCaseFileData` correctly captures this into `state.error` and sets `data: null, isLoading: false`.
- **Root cause**: `CaseFileDashboard` destructures **only** `const { data } = useCaseFileData()` and derives every child's prop from `data?.x ?? null`. It never reads `error` or `isLoading`. Because all child cards treat `null` as "still loading" (CriteriaTable.tsx:46 `criteria === null` → skeleton; SidePanels.tsx:16/65; the masthead facts at CaseFileDashboard.tsx:58), a *failed* fetch is visually indistinguishable from a *pending* one. The `PanelErrorBoundary` wrappers (lines 84-95) cannot help: the boundary catches render-time throws, but here render succeeds with `null` data — the rejection happened in a `.then()`/`.catch()` and was swallowed into state the parent ignores.
- **Impact**: On any transient backend failure the entire dashboard (criteria, tasks, petition excerpt, facts) sits on shimmering skeletons forever, with no error, no retry, no alert. The user assumes it is "still loading" and waits indefinitely. The hook even has no retry path (effect deps are `[caseId]`, which never changes), so it cannot self-recover.
- **Fix sketch**: Surface `error`/`isLoading` from the hook in `CaseFileDashboard` and render an error region (mirror CaseList.tsx:213-219's `role="alert"` block) with a retry that calls `clearCaseFileDataCache()` + re-mounts. At minimum, pass an explicit `error` prop into the cards so a skeleton can become an inline "Couldn't load — retry" state rather than an infinite shimmer.

## 2. Permanent module-level promise cache serves stale case data across client navigations with no invalidation

- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: client-state persistence / stale data after navigation
- **File**: src/features/case-file/caseFileData.ts:45-78
- **Scenario**: `fetchCaseFileData` memoizes the resolved snapshot in a module-level `Map` keyed by `caseId ?? "__live__"`. The promise is only ever evicted on **rejection** (line 75); a *successful* result is cached for the lifetime of the JS bundle. `clearCaseFileDataCache()` exists but is called nowhere outside tests (grep: only `caseFileData.test`).
- **Root cause**: There is no time-based or event-based invalidation. The comment at useCaseFileData.ts:43-46 reassures that "the data layer is an instant in-memory read, so there is no perceptible stale window" — true *today* because `getCriteria`/`getCaseFacts`/etc. (src/lib/data/cases.ts:33-50) ignore `caseId` and return static fixtures. But the file's own docstring (caseFileData.ts:31-33) plumbs `caseId` "for the eventual per-case data source." The moment those reads become real (per-case, or mutated by an action like "Regenerate §III.A" / "Upload letter"), this cache will hand back a snapshot captured at first mount and never refresh within the SPA session — a classic stale-after-navigation trap.
- **Impact**: Today: latent (fixtures mask it). After the fixtures→DB swap the file is explicitly built for: a user who updates evidence/criteria and returns to the dashboard sees pre-mutation data until a full page reload. Combined with finding #1, a *failed* leg evicts and the next mount retries, but a *successful-but-stale* leg is pinned forever.
- **Fix sketch**: Add an invalidation seam now while it is cheap: export a `clearCaseFileDataCache(caseId?)` that mutation actions call, and/or attach a short TTL / a `revalidate` token to cache entries. Document that any write path touching case facts/tasks/criteria must bust the relevant key.

## 3. Case-portfolio table: `<th>` missing `scope`, and rows are mouse-only clickable (keyboard/SR inaccessible)

- **Severity**: High
- **Lens**: ui-perfectionist
- **Category**: a11y (table semantics + keyboard navigation)
- **File**: src/features/case-file/components/CaseList.tsx:234-280
- **Scenario**: The case-portfolio table headers (lines 236-245) are bare `<th class="...">` with **no `scope="col"`** — inconsistent with the sibling CriteriaTable.tsx:56-59 which correctly sets `scope="col"` on every header. Worse, each row navigates via `onClick={() => router.push(...)}` on the `<tr>` (line 252) with `cursor-pointer`, but a `<tr>` is not focusable and has no `role`/`tabIndex`/key handler.
- **Root cause**: Row navigation was wired to the mouse only. The inner file-number `<Link>` (lines 256-262) is the *only* keyboard-reachable target per row, yet the visual affordance (whole-row hover highlight + pointer cursor) promises the entire row is clickable. Screen-reader users get column headers that aren't programmatically associated with cells (no `scope`), and keyboard users can't trigger the row's primary action (open case) except by tabbing to the small file-number link.
- **Impact**: A core navigation flow — open a case from the portfolio — is unreachable by keyboard at the row level, and the table's header/cell relationships aren't announced. This is an a11y blocker for the platform's primary list view, and the missing-`scope` drift from CriteriaTable shows the table treatment isn't standardized.
- **Fix sketch**: Add `scope="col"` to all `<th>` in CaseList (match CriteriaTable). Drop the `<tr onClick>` pattern; make the file-number `<Link>` the single accessible row action (it already exists) and remove `cursor-pointer`/whole-row click, OR keep a row-level affordance but implement it accessibly (an overlaying `<Link>` spanning the row, or `tabIndex={0}` + `onKeyDown` Enter/Space + `role="link"`). The CriteriaTable rows are correctly non-interactive, so only CaseList needs the keyboard fix.

## 4. Two near-duplicate AI-scored criteria tables that have already drifted

- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: component duplication / visual drift
- **File**: src/features/case-file/components/CriteriaTable.tsx:53-91 vs src/features/case-file/components/CaseDetailView.tsx:153-188
- **Scenario**: The criteria table is hand-rolled twice: once in `CriteriaTable` (dashboard) and again inline in `CaseDetailView` (case detail page). Both render the same shape — `§ … criteria` header, `Badge tone={statusTone(c.status)}`, numbered rows, dotted borders, `hover:bg-accent-soft/35` — but they have **already diverged**: CriteriaTable uses `scope="col"` headers + `flex items-center` name cell + a CriterionPrimerButton + an "Ex." exhibit column; CaseDetailView omits `scope`, uses `flex items-baseline`, has no primer button, and a "What we found" column with an `evidence || rationale || "—"` fallback.
- **Root cause**: The detail view re-implemented the table instead of reusing `CriteriaTable`, so every styling/a11y decision must be made twice and they predictably fall out of sync (the `scope` attribute is present in one and missing in the other — see finding #3's pattern).
- **Impact**: Maintenance hazard and visible inconsistency: a fix to row spacing, focus, or header semantics in one table silently misses the other; the two tables read subtly differently for the same data type across two screens of the same product.
- **Fix sketch**: Extract a shared `<CriteriaTable>` that takes `criteria`, an optional `showPrimer`/`showExhibit`, and a configurable last-column accessor; have both the dashboard and `CaseDetailView` render it. This also auto-propagates the `scope="col"` fix everywhere.

## 5. Dashboard masthead + trust badges are hardcoded fiction shown above the user's real cases

- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: content correctness / misleading UI
- **File**: src/features/case-file/components/CaseFileDashboard.tsx:38-48, 102-105
- **Scenario**: The masthead always renders the fixed demo persona — `File № O1-241 · Petitioner`, `Dr. Anya Krishnan`, `Senior Research Engineer · India → United States · O-1A` (lines 39-49) — and the footer always shows `92% approval likelihood`, `USCIS premium $2,805 (paid to USCIS)` (lines 102-104), regardless of who is signed in. Directly above, `YourCasesCard` (line 31) lists the user's *actual* persisted cases.
- **Root cause**: The hero card and trust badges were built for the single-case marketing demo and never parameterized. When a real user has cases, the page shows their case list **and** an unrelated stranger's hardcoded petition as the visual hero, plus a fabricated "92% approval likelihood" / specific dollar figure that aren't tied to anything.
- **Impact**: Confusing and, on an immigration product, potentially misleading: a signed-in user sees "Dr. Anya Krishnan" and a 92% approval claim presented as if it were theirs. Lower severity because it's cosmetic/demo content, but on a legal-services dashboard the hardcoded likelihood/fee read as a quasi-promise.
- **Fix sketch**: When `cases.length > 0`, drive the masthead from the user's primary/most-recent case (petitioner, file number, classification, real likelihood) instead of the Krishnan fixture, and either remove the static `92% approval likelihood`/USCIS-fee badges or scope them to a clearly-labeled "Sample case" demo block (the codebase already has a "Sample case" banner pattern elsewhere).
