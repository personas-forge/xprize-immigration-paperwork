# Code Refactor Scan — Brand & Design System

> Total: 5 (C0 / H2 / M2 / L1)

## 1. src/lib/format.ts is dead code (no production consumer)
- **Severity**: high
- **Category**: dead-code
- **File**: src/lib/format.ts:1-45
- **Scenario**: The module exports `formatCurrency`, `formatSignedCurrency`, `formatNumber`, `formatPercent` (with the ADR-0003 non-finite guard). A whole-repo grep for each symbol and for the import path `@/lib/format` returns matches ONLY in the module itself and its sibling `format.test.ts`. No component, feature, route, or page imports it. The dashboard's token balance is formatted inline with `balance.toLocaleString()` in `BalancePill`, not via `formatNumber`; billing prices are formatted elsewhere.
- **Root cause**: Display formatters scaffolded (with a dedicated ADR + test suite) for a money/score-heavy UI that ended up formatting values inline at each call site instead. The test keeps the module "alive" in coverage but nothing ships it.
- **Impact**: ~45 LOC of production source plus ~56 LOC of test that exists only to test dead code. Carries a misleading ADR-0003 trail implying it guards a live display boundary. The sibling-project audit referenced in memory flagged the same file; here it is verifiably unused.
- **Verification**: `grep -rn "formatCurrency|formatSignedCurrency|formatNumber|formatPercent"` over `src` → only `format.ts` + `format.test.ts`. `grep "@/lib/format"` over the repo → only CHANGELOG/ADR docs, no `.ts`/`.tsx` source import. No string/dynamic import of "format" found. CONCLUSION: dead in production.
- **Fix sketch**: Delete `src/lib/format.ts` and `src/lib/format.test.ts`; note the removal against ADR-0003 (mark superseded/withdrawn). If any future feature needs USD/percent formatting, re-introduce on demand. Breaking-change risk: none (zero importers).

## 2. Prop-driven ThemeToggle + BalancePill triplicated across three dashboard views
- **Severity**: high
- **Category**: duplication
- **File**: src/features/dashboard/DashboardView.tsx:59-96 (and src/features/review/components/ReviewQueueView.tsx:112-143, src/features/case-file/components/CaseDetailView.tsx:248-end)
- **Scenario**: Each of the three dashboard views defines its own local `BalancePill({ balance })` and `ThemeToggle({ dark, onToggle })` helper. The `BalancePill` bodies are byte-identical (same Link, same classes, same `◈`/`tokens` markup); the local `ThemeToggle` bodies are identical (☾/☼ glyph, "Ink"/"Parchment" label, same className). Each view drives them from a private `const [dark, setDark] = useState(false)` feeding `ThemeScope` token overrides.
- **Root cause**: Two distinct theme mechanisms coexist. The CANONICAL toggle is `src/components/ThemeToggle.tsx` (in scope): localStorage-persisted, pre-paint, hydration-safe via `useSyncExternalStore`, used by 6 app-router pages (`/`, `/login`, `/billing`, `/faq`, `/qualify`, `/validation`). The dashboard trio instead reimplements a transient, in-memory `dark` flag + inline toggle button, and copied the BalancePill alongside it.
- **Impact**: Three copies to keep in sync (an a11y/markup fix must land 3×). Worse, a behavioral inconsistency: the dashboard theme choice does NOT persist and does NOT sync with the canonical localStorage theme, so a user who picks "ink" on the landing page lands on a "parchment" dashboard. The canonical toggle is the single source of truth and should win.
- **Verification**: `grep "ThemeToggle|BalancePill"` over `src` shows the canonical export in `components/ThemeToggle.tsx` plus three identical local re-definitions in the three view files; bodies read identically at the cited lines. The local toggles take `{dark,onToggle}` props (no persistence); the canonical one takes none (self-persisting).
- **Fix sketch**: Extract one shared `BalancePill` (e.g. `src/components/BalancePill.tsx` or into the brand/ui kit) and import it in all three views. For theme: either adopt the canonical `ThemeToggle` in the dashboards (preferred — gains persistence/sync) by having `ThemeScope` read the same `data-theme`/localStorage signal, or at minimum extract the prop-driven toggle to one shared component. Breaking-change risk: low; behavior-improving for the persistence path — verify `ThemeScope` token overrides still apply when keyed off the canonical theme.

## 3. StatCard (and StatTone) exported from the UI kit but never consumed
- **Severity**: medium
- **Category**: dead-code
- **File**: src/components/ui/StatCard.tsx:22; re-export src/components/ui/index.ts:3
- **Scenario**: `StatCard` and its `StatTone` type are exported from the `@/components/ui` barrel, but a repo-wide grep finds references only in the component file and the barrel — no view, page, or test renders `<StatCard>`. Dashboard metrics are rendered with bespoke `Card` + `doc-number` markup, not `StatCard`.
- **Root cause**: UI-kit primitive built ahead of a metrics/stat surface that was implemented differently (or never built). Distinct from "kit API used in one place" — this one has zero call sites.
- **Impact**: ~48 LOC of unused exported surface that nonetheless looks load-bearing (it's in the public barrel), inviting drift. Small.
- **Verification**: `grep -rn "StatCard"` over `src` → only `ui/StatCard.tsx` + `ui/index.ts`. No `<StatCard` JSX anywhere. CONCLUSION: dead exported surface (not merely single-use).
- **Fix sketch**: Either remove `StatCard.tsx` and its barrel line, or, if intended as kit API, leave with a `// kit primitive — not yet consumed` note. Given the parallel dead `SectionHeader`, removing is the cleaner signal. Breaking-change risk: none (zero importers).

## 4. SectionHeader exported from the UI kit but never consumed
- **Severity**: medium
- **Category**: dead-code
- **File**: src/components/ui/SectionHeader.tsx:12; re-export src/components/ui/index.ts:4
- **Scenario**: `SectionHeader` is exported from the `@/components/ui` barrel but, like `StatCard`, is referenced only in its own file and the barrel. Pages and feature panels render headings inline with raw `<h2 className="display …">` markup (e.g. the landing page) rather than via `SectionHeader`.
- **Root cause**: Heading primitive scaffolded for the kit; consumers hand-rolled equivalent markup instead of adopting it.
- **Impact**: ~44 LOC unused exported surface; same drift risk as #3. Small.
- **Verification**: `grep "SectionHeader"` across the whole repo (excluding markdown) → only `ui/SectionHeader.tsx` + `ui/index.ts`. No JSX usage. CONCLUSION: dead exported surface.
- **Fix sketch**: Remove `SectionHeader.tsx` + its barrel line, OR adopt it in the pages that hand-roll `display`-class headings to justify keeping it. Breaking-change risk: none (zero importers).

## 5. DashboardTopBar `glyph` prop is accepted but unused (vestigial API)
- **Severity**: low
- **Category**: cleanup
- **File**: src/components/DashboardTopBar.tsx:6
- **Scenario**: `DashboardTopBar` declares a `glyph: string` prop with the inline comment `// accepted for API compat; unused (Wordmark draws the seal)`. Callers (e.g. `DashboardView.tsx:30`) still pass `glyph="✦"`, but the value is never rendered — the `Wordmark`/`Seal` brand primitive supplies the mark.
- **Root cause**: The top bar migrated from a literal glyph to the `Wordmark` brand component; the prop was retained for "API compat" but no external/versioned contract requires it.
- **Impact**: Dead prop threaded through call sites; mildly misleading (suggests the glyph is configurable). Cosmetic.
- **Verification**: Read of `DashboardTopBar.tsx` shows the prop is destructured/typed but not used in render; `glyph="✦"` passed at `DashboardView.tsx:30`. Self-documented as unused by the author's own comment.
- **Fix sketch**: Drop the `glyph` prop from the type and remove the `glyph=` props at the (few) call sites. Breaking-change risk: trivial — internal component, all callers in-repo.
