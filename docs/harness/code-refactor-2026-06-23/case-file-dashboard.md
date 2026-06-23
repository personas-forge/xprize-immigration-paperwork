# Code Refactor — Case File Dashboard
> Total: 5 (C0/H2/M2/L1)

## 1. Empty-state CTA hand-copies the entire `Button` class string (already drifted)
- **Severity**: High
- **Category**: duplication
- **File**: src/features/case-file/components/CaseFileDashboard.tsx:146-151 (vs src/components/ui/Button.tsx:11-12, 44-55)
- **Scenario**: `EmptyCasesCallout` renders a `next/link` styled with a long inline `className` that is a byte-for-byte copy of the canonical `Button` primary variant. Grep `inline-flex items-center justify-center gap-2 rounded-control font-mono uppercase tracking-document` returns Button.tsx:44 and CaseFileDashboard.tsx:148 (plus billing/qualify which each hand-roll their own distinct chrome). The base string and the `bg-foreground text-background border border-foreground hover:bg-foreground-soft` variant string are both literal duplicates of Button.
- **Root cause**: There is no link-as-button affordance, so an `<a>`/`<Link>` that must look like a primary Button was built by pasting Button's classes instead of reusing them.
- **Impact**: The copy has ALREADY drifted: Button.tsx was hardened with `focus-visible:ring-2 focus-visible:ring-accent-dark focus-visible:ring-offset-2` and `disabled:` affordances (WCAG 2.4.7 work), but this copy still has the OLD `focus-visible:outline-none` with no ring — so the "Qualify your profile" CTA has a weaker/absent keyboard focus indicator than every real Button. Any future Button restyle silently skips this CTA.
- **Fix sketch**: Add a tiny `buttonClasses(variant, size)` export in Button.tsx (extract the `cn(...)` body), or an `asChild`/`as="a"` prop, and have the CTA consume it. One source of truth; the focus-ring regression disappears for free. (The `YourCasesCard` row link and the `CaseList` "← All cases" link hand-roll lighter chrome too, but this one is the exact 1:1 Button clone.)

## 2. `checklistToCsv` (+ `CaseDocument`/`DocumentStatus` types) is dead production code
- **Severity**: High
- **Category**: dead-code
- **File**: src/features/case-file/export.ts:51-60; src/features/case-file/types.ts:83-92
- **Scenario**: `casesToCsv` is wired into `CaseList.exportCsv` (CaseList.tsx:14,81). Its sibling `checklistToCsv` is not. Grep `checklistToCsv` across `src/` returns only export.ts (definition) and export.test.ts (its own unit test) — zero production callers. Its parameter type `CaseDocument` and `DocumentStatus` (`"Received" | "Pending" | "Needs review"`) are likewise referenced only by export.ts + export.test.ts; the live evidence vault uses `StoredDocument`/`DocumentView`, never these. (Distinct from the `addCaseDocument`/`getCaseDocuments` store methods, which are unrelated names.)
- **Root cause**: An evidence-vault CSV export that was planned but never surfaced in the UI (no "Export checklist" button exists), leaving the serializer, its two types, and its test as an orphan trio that only references itself.
- **Impact**: ~10 lines of serializer + 10 lines of types + a test that pins behaviour nothing ships — extra surface that reads as "live" and will be maintained/extended on the assumption it's used.
- **Fix sketch**: Either delete `checklistToCsv` + `CaseDocument` + `DocumentStatus` + the `checklistToCsv` test case, or (if checklist export is intended) wire an "Export checklist" action in the evidence vault. Confirm intent first; if kept, it should be reachable, not just tested.

## 3. `CaseDetailView` inlines a ~40-line criteria-summary IIFE that belongs in a child component
- **Severity**: Medium
- **Category**: structure
- **File**: src/features/case-file/components/CaseDetailView.tsx:146-184
- **Scenario**: The criteria section is an inline `{(() => { const threshold = packFor(...).threshold; const summary = summarizeCriteria(...); return (<Card>…</Card>); })()}` immediately-invoked block — ~40 lines of header/summary/empty-state/badge JSX plus the `criteria as unknown as readonly Criterion[]` double-cast — embedded mid-render in an already 245-line component that orchestrates eight panels.
- **Root cause**: The block needs two local consts (`threshold`, `summary`) so it was wrapped in an IIFE rather than hoisted into its own component or computed above `return`. The double-cast exists only because `DetailCriterion` lacks the `exhibit` field `Criterion` has, even though `summarizeCriteria` reads only `status`.
- **Impact**: The IIFE is the hardest part of the file to scan, mixes derivation with markup, and the `as unknown as` cast defeats type-checking on a legal-eligibility read-out. The component does too much to test or re-skin in isolation.
- **Fix sketch**: Extract a `CaseCriteriaCard({ classification, criteria })` (or at minimum hoist `threshold`/`summary` to plain consts before `return`). Narrow `summarizeCriteria`'s input to `readonly { status: unknown }[]` so `DetailCriterion[]` passes without the `as unknown as` double-cast.

## 4. `caseId` is threaded through the entire fetch path but the live data layer drops it
- **Severity**: Medium
- **Category**: cleanup
- **File**: src/features/case-file/caseFileData.ts:34-39,65-91; useCaseFileData.ts:36; src/lib/data/cases.ts:33-50
- **Scenario**: `CaseFileDataDeps` declares every reader as `(caseId?: string) => …`, `fetchCaseFileData(deps, caseId)` keys its cache by `caseId ?? LIVE_KEY` and forwards it to all four deps, and `useCaseFileData(caseId?)` plumbs it from the top. But the live implementations in cases.ts (`getCriteria()`, `getCaseFacts()`, `getOutstandingTasks()`, `getPetitionExcerpt()`) take ZERO params and always return the one mock fixture. The sole caller, `CaseFileDashboard`, calls `useCaseFileData()` with no argument — so `caseId` is always `undefined` in production.
- **Root cause**: Per-case plumbing was built ahead of a per-case data source that never landed; the parameter is wired end-to-end but inert (the file's own comment at caseFileData.ts:30-33 admits "the current in-memory fixtures ignore it").
- **Impact**: Reader scanning the cache/dep machinery reasonably assumes multi-case fetching works; the `caseId` cache key, the per-case `clearCaseFileDataCache(caseId)` seam, and the TTL all guard a scenario that can't occur with one fixed fixture. Speculative generality that has to be re-understood on every visit.
- **Fix sketch**: Leave the `deps` signatures (the DI seam is the documented test boundary and grounding says the TTL cache is intentional), but drop a short "NOTE: caseId is reserved — no live per-case source yet; always undefined from the dashboard" at the `useCaseFileData` call site, OR remove the `caseId` param from the hook + fetch surface until a real per-case source exists. Don't expand it further until then.

## 5. `CaseList` and `usePersistentQuery` each maintain their own copy of the CLASSIFICATIONS/STATUSES literal lists
- **Severity**: Low
- **Category**: duplication
- **File**: src/features/case-file/components/CaseList.tsx:25-38 vs src/features/case-file/usePersistentQuery.ts:29-42
- **Scenario**: Both modules declare `const CLASSIFICATIONS: readonly (VisaClassification | "all")[] = ["all","O-1A","O-1B","EB-1A"]` and `const STATUSES: … = ["all","Intake","Drafting","Attorney Review","Filed","Approved"]`. CaseList renders them as `<option>`s; usePersistentQuery uses them as the allow-list for `sanitize()`. They are character-identical today.
- **Root cause**: The render list (CaseList) and the storage-validation list (usePersistentQuery) were authored independently; both enumerate the same `VisaClassification`/`CaseStatus` unions by hand.
- **Impact**: Adding a visa class or lifecycle status (e.g. "Withdrawn") requires editing two arrays in two files; miss one and the filter UI and the persisted-query sanitizer disagree — a stale localStorage value could survive sanitize but have no matching `<option>`, or vice-versa.
- **Fix sketch**: Export `CLASSIFICATION_OPTIONS` and `STATUS_OPTIONS` (the `"all"`-prefixed arrays) once from `case-list.ts` next to `CaseStatus`/`VisaClassification`, and import them in both consumers. Single enumeration, render and validation can't drift.
