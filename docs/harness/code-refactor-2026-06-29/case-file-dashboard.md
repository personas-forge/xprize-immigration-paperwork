# Code Refactor — Case File Dashboard
> Total: 5
> Critical: 0 | High: 1 | Medium: 3 | Low: 1

## 1. Two byte-pattern-twin localStorage external stores (usePersistentQuery + bannerDismiss)
- **Severity**: High
- **Category**: consolidation
- **File**: src/features/case-file/usePersistentQuery.ts:50-106 ; src/features/dashboard/bannerDismiss.ts:10-59
- **Scenario**: Both files hand-roll the SAME `useSyncExternalStore` + `localStorage` idiom: a module-level `cache: { raw, value }` snapshot-stability shim, a `getSnapshot()` that re-reads `localStorage` and only re-parses when the raw string changes (usePersistentQuery.ts:74-80 ≈ bannerDismiss.ts:31-43), a `getServerSnapshot()` returning a hardcoded default (usePersistentQuery.ts:82-84 ≈ bannerDismiss.ts:47-49), a `subscribe()` that wires BOTH a custom `EVENT` and the native `"storage"` event (usePersistentQuery.ts:86-94 ≈ bannerDismiss.ts:51-59), and a writer that swallows quota/private-mode throws then `dispatchEvent(new Event(EVENT))` (usePersistentQuery.ts:96-106 ≈ bannerDismiss.ts:20-29). bannerDismiss.ts:1-5 explicitly states "Follows the same useSyncExternalStore + localStorage pattern as usePersistentQuery.ts" — the copy is acknowledged in-comment. `src/components/ThemeToggle.tsx:19-44` and `src/components/landing/useThemePalette.ts` are looser cousins of the same idiom (6 `useSyncExternalStore` call sites repo-wide).
- **Root cause**: No shared primitive for "a typed value persisted to localStorage, exposed as a stable external store." Each new persisted flag re-implements the subtle snapshot-identity cache by hand.
- **Impact**: The non-obvious `cache.raw` identity trick (required so `useSyncExternalStore` doesn't infinite-loop) is duplicated; a fix in one copy (e.g. cross-tab `storage`-event de-dup, or a JSON-parse hardening) silently won't reach the other. Two places to get the SSR/CSR snapshot contract wrong.
- **Fix sketch**: Extract `createLocalStorageStore<T>(key, { eventName, parse, serialize, serverValue })` returning `{ subscribe, getSnapshot, getServerSnapshot, write }`. Re-express `usePersistentQuery` (parse → `sanitize(JSON.parse(...))`) and `bannerDismiss` (parse → `raw === "1"`) as two thin configs over it; optionally fold ThemeToggle/useThemePalette in later.

## 2. Three functions named `statusTone`; the two case-lifecycle copies disagree on "Filed"
- **Severity**: Medium
- **Category**: naming
- **File**: src/features/case-file/criteria.ts:39 ; src/features/case-file/components/CaseList.tsx:34 ; src/features/review/components/ReviewPanel.tsx:53
- **Scenario**: Three unrelated functions share the name `statusTone`. `criteria.ts:39` maps a *criterion* status (`Met`/`Strong`/`Partial`) to a `BadgeTone` and is the canonical, widely-imported one (CriteriaRows, CriteriaReport, `app/c/[token]/page.tsx`). `CaseList.tsx:34` and `ReviewPanel.tsx:53` are *local* copies that instead map a *case lifecycle* status — and they have **drifted**: for `status === "Filed"`, CaseList returns `"accent"` (CaseList.tsx:36) while ReviewPanel returns `"success"` (ReviewPanel.tsx:54). So the same petition status renders a different-colored badge in the portfolio list vs the review panel.
- **Root cause**: The lifecycle-status→tone mapping was never hoisted to a shared helper, so each screen wrote its own and they diverged; reusing the name `statusTone` (which already means "criterion tone") hides that these are a different concept.
- **Impact**: Visual inconsistency for an identical datum across screens, plus an import hazard — a maintainer can pull the wrong `statusTone` (criterion vs lifecycle) since the names and `BadgeTone` return type match.
- **Fix sketch**: Add one `caseStatusTone(status: CaseStatus): BadgeTone` next to the other pure case-list logic in `case-list.ts`, decide the single correct tone for each lifecycle stage, and have CaseList + ReviewPanel import it. Removes the duplication and the name collision in one move.

## 3. "Fact cell" markup inlined in CaseFileDashboard duplicates CaseDetailView's `Fact` component
- **Severity**: Medium
- **Category**: duplication
- **File**: src/features/case-file/components/CaseFileDashboard.tsx:79-95 ; src/features/case-file/components/CaseDetailView.tsx:127-131,234-241
- **Scenario**: CaseDetailView already factored the petitioner-facts cell into a `Fact({label,value})` component (CaseDetailView.tsx:234-241) rendering `<div className="bg-surface px-4 py-4"><div className="microprint">…</div><div className="mt-2 doc-number text-[16px] text-foreground">…</div></div>`. CaseFileDashboard re-inlines byte-identical markup for both its skeleton (line 82) and its real cells (lines 88-94), and both views wrap them in the identical grid `col-span-12 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-border bg-border lg:col-span-6` (CaseFileDashboard.tsx:79, CaseDetailView.tsx:127). `bg-surface px-4 py-4` is grepped at exactly these 3 sites.
- **Root cause**: The `Fact` component is private to CaseDetailView; the dashboard predates/ignores it and copied the markup.
- **Impact**: A masthead restyle (padding, type scale, the fact grid border treatment) must be edited in two files to stay consistent; the skeleton cell can drift from the real cell within the same file.
- **Fix sketch**: Lift `Fact` (and optionally a `FactGrid` wrapper) into a small shared module under `case-file/components/`; have both mastheads render it. The dashboard skeleton can stay as a `Fact`-shaped placeholder.

## 4. caseFileData cache layer guards conditions that can't occur (single consumer, no per-case source)
- **Severity**: Medium
- **Category**: structure
- **File**: src/features/case-file/caseFileData.ts:41-102 ; src/features/case-file/useCaseFileData.ts:42-55
- **Scenario**: `fetchCaseFileData` carries a module-level promise cache keyed by `caseId`, a 30s TTL (caseFileData.ts:59), reject-eviction, and a `clearCaseFileDataCache(caseId?)` invalidator (caseFileData.ts:99-102). Its stated rationale — "Two consumers mounting in the same tick … share ONE in-flight Promise.all" (caseFileData.ts:41-44) — no longer holds: after ADR-0009 there is exactly ONE consumer, `useCaseFileData`, called once by CaseFileDashboard.tsx:21. The per-`caseId` TTL/invalidation guards a per-case data source that does not exist — `useCaseFileData` documents that `caseId` is "always `undefined` in production" (useCaseFileData.ts:36-41) and the data layer is "an instant in-memory read" (synchronous fixtures, src/lib/data/cases.ts:27-50).
- **Root cause**: Caching/TTL/invalidation built speculatively for a future per-case backend and a multi-consumer fan-out that was then collapsed to a single owner.
- **Impact**: ~50 lines of cache/TTL/eviction/invalidation code (plus `clearCaseFileDataCache` wired through `reload()` at useCaseFileData.ts:52) that a reader must reason about, solving no current problem; the comments documenting the obsolete multi-consumer rationale mislead.
- **Fix sketch**: Until a real async per-case source lands, collapse `fetchCaseFileData` to a plain `Promise.all` over the deps and let `reload()` simply bump the effect nonce (no cache to bust). Re-introduce the cache with the backend that needs it. (Lower-risk alternative: keep the code but correct the stale "two consumers" comments.)

## 5. Repeated inline `style={{ color: "var(--accent-dark)" }}` where a `text-accent-dark` utility already exists
- **Severity**: Low
- **Category**: cleanup
- **File**: src/features/case-file/components/CaseFileDashboard.tsx:55 ; CaseDetailView.tsx:115,152 ; CaseList.tsx:96 ; CriteriaTable.tsx:30 ; SidePanels.tsx:10,53 ; RoadmapStepper.tsx:36
- **Scenario**: The accent-dark microprint label is written as an inline style `style={{ color: "var(--accent-dark)" }}` in ~12 in-context spots (37 occurrences across 20 files repo-wide), almost always paired with `className="microprint"`. Yet the Tailwind token utility `text-accent-dark` exists and is used for the identical effect just lines away (CaseDetailView.tsx:113 `className="… text-accent-dark"`).
- **Root cause**: Two interchangeable ways to apply the same token color coexist; the inline-style form was copy-pasted onto every microprint heading.
- **Impact**: Inconsistent idiom (class vs inline style) for one color, verbose JSX, and an inline-style escape hatch that bypasses the utility layer — easy to miss in a token rename.
- **Fix sketch**: Replace `className="microprint" style={{ color: "var(--accent-dark)" }}` with `className="microprint text-accent-dark"` (or add a `.microprint-accent` composite if the pairing is canonical). Mechanical, no behavior change.
