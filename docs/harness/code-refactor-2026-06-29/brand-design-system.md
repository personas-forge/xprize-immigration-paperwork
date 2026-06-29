# Code Refactor — Brand & Design System
> Total: 5
> Critical: 0 | High: 1 | Medium: 3 | Low: 1

Scope note: the task file list named `src/components/ui/SectionHeader.tsx`, `StatCard.tsx`,
`src/lib/format.ts` and `format.test.ts` — none exist on disk (verified via Glob over the actual
tree). They are stale assignment entries, not deletions to flag. The 2026-06-23 pass already
removed its 5 findings (no `[data-animate]` keyframes, no `Stagger`/`HoverCard`/`staggerParent`,
no `.double-rule`; the `.focus-ring` utility was added at globals.css:238). Every claim below was
re-verified against current file contents with grep across `src/`.

---

## 1. Three hand-rolled localStorage + useSyncExternalStore stores — no shared factory
- **Severity**: High
- **Category**: consolidation
- **File**: src/components/ThemeToggle.tsx:11-44 ; src/features/case-file/usePersistentQuery.ts:19-106 ; src/features/dashboard/bannerDismiss.ts:7-59
- **Scenario**: Three modules independently re-implement the same SSR-safe "persist a value to
  localStorage, read it through `useSyncExternalStore`, notify peers via a custom window event"
  pattern. `usePersistentQuery.ts` and `bannerDismiss.ts` are near-identical twins: each defines a
  module-level `cache: { raw, value }` (so `getSnapshot` returns a stable reference), a `getSnapshot`
  that reads localStorage in a try/catch and re-parses only when `raw` changed, a `getServerSnapshot`
  returning a default, a `subscribe` that listens to both a private `EVENT` and the `"storage"` event,
  and a writer that `setItem`s then `dispatchEvent(new Event(EVENT))`. `ThemeToggle.tsx` is the same
  pattern in looser form (DOM-attribute backed, no module cache, no `"storage"` listener). No shared
  helper exists — `grep -rn 'createLocalStorageStore|makePersistentStore' src` → zero.
- **Root cause**: The theme toggle established the idiom; the case-query and banner-dismiss persistence
  were each authored by copying the shape rather than extracting a generic `createLocalStorageStore<T>`
  (with `key`, `parse`, `serialize`, `defaultValue`). Each file's own header comment points at the
  others ("the same FOUC-free pattern the theme toggle uses", "the same useSyncExternalStore + localStorage
  pattern as usePersistentQuery.ts"), confirming the copy lineage.
- **Impact**: The subtle correctness details (stable-snapshot caching, dual-event subscription, the
  "don't notify on a failed write" rule in usePersistentQuery.ts:99-104) must be kept in sync by hand
  across three files. bannerDismiss.ts already *diverges* — it omits the "failed-write must not notify"
  guard and the snapshot-cache invalidation nuance. A fourth persisted setting will copy whichever
  variant the author happens to find. This is the single highest-leverage consolidation in the context.
- **Fix sketch**: Extract `src/lib/createLocalStorageStore.ts` exposing
  `{ getSnapshot, getServerSnapshot, subscribe, read, write }` parameterised by
  `{ key, defaultValue, parse, serialize }`, carrying the cache + dual-event + safe-write logic once.
  Rebuild all three call-sites on it (`usePersistentQuery` and `bannerDismiss` drop ~40 lines each;
  ThemeToggle keeps its DOM-attribute writer but shares the subscribe/snapshot core).

## 2. No canonical case-status → Badge tone; three views disagree
- **Severity**: Medium
- **Category**: duplication
- **File**: src/components/ui/Badge.tsx:14 (tone palette) ; src/features/case-file/components/CaseList.tsx:34-38 ; src/features/review/components/ReviewPanel.tsx:53-57 ; src/features/case-file/components/CaseFileDashboard.tsx:179
- **Scenario**: `Badge` owns the canonical tone palette (neutral/accent/success/warning/danger), and
  `criteria.ts:39 statusTone` is a properly-centralised mapper for *criterion* status (reused by the
  criteria table and the public share page). But *case* status has no shared mapper — three views map
  the same `CaseStatus` to a Badge tone differently:
  - `CaseList.tsx:34` — Approved→success, **Filed→accent**, **Intake→warning**, else neutral.
  - `ReviewPanel.tsx:53` — Approved→success, **Filed→success**, **Attorney Review→accent**, else neutral.
  - `CaseFileDashboard.tsx:179` — `<Badge tone="neutral">{c.status}</Badge>` — **every status neutral**.
  So "Filed" renders gold (accent) in the case list, green (success) in the review panel, and grey in the
  dashboard list; "Intake" is amber in one view and grey in the others; "Approved" is green in two views
  but grey in the dashboard.
- **Root cause**: Two private functions both literally named `statusTone(status: CaseStatus)` were
  written independently, and a third call-site never bothered with a mapping at all. There is no owner of
  the case-status→tone contract the way `criteria.ts` owns criterion-status→tone.
- **Impact**: Visual inconsistency for the same data across the app, plus a duplicated mapping that drifts
  silently — a status-color tweak in one view does not reach the others, and the dashboard list is simply
  wrong (terminal "Approved"/"Filed" cases look identical to "Intake").
- **Fix sketch**: Add a canonical `caseStatusTone(status: CaseStatus): BadgeTone` next to the case-status
  type (mirroring `criteria.ts`'s pattern), delete both private `statusTone`s, and replace
  `CaseFileDashboard.tsx:179`'s hardcoded `tone="neutral"` with it so all three views share one contract.

## 3. Dead `stampIn` Variants export — orphaned after the Stagger/HoverCard removal
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/lib/motion.ts:26-34
- **Scenario**: `stampIn` (a rubber-stamp press `Variants`: scale/rotate/opacity overshoot) is exported
  but consumed nowhere. `grep -rn 'stampIn' <repo>` → only its own definition in motion.ts plus harness
  docs/README; **zero source importers**. There is no Stamp motion wrapper to use it: `Motion.tsx` now
  exports only `Rise` (which uses `fadeUp`), and the brand `Stamp.tsx` renders a *static* CSS
  `transform: rotate(...)` with no framer-motion at all.
- **Root cause**: The 2026-06-23 pass deleted the `Stagger`/`HoverCard` wrappers and the `staggerParent`
  variant but kept `stampIn` — that report explicitly advised "`stampIn` is live — keep it", which is no
  longer true (whatever once referenced it went with the deleted wrappers). The module header comment
  (motion.ts:6) still advertises animating "a stamp", describing capability the code no longer wires.
- **Impact**: A `Variants` export that looks like supported API but ships no value; invites a maintainer
  to think stamp animation is wired when it is not, and to keep the easing curve `[0.34,1.3,0.64,1]` in
  the file with no consumer to validate it against.
- **Fix sketch**: Delete `stampIn` (motion.ts:26-34) and trim the "and a stamp" clause from the header
  comment — OR wire it into the brand `Stamp` via a small framer-motion variant if a press animation is
  actually wanted. `easeArrival` and `fadeUp` remain live (used by `Rise`) — keep them.

## 4. Dead `indigo` ("official stamp blue") color ramp — wired through 5 layers, zero consumers
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/app/globals.css:34-35,77-78 ; tailwind.config.ts:34-37 ; src/features/dashboard/themes.ts:26-27,61-62 ; src/components/landing/palette.ts:24,52 ; src/components/brand/Stamp.tsx:25,32
- **Scenario**: The `indigo` accent is fully threaded through the design system — `--indigo`/`--indigo-soft`
  CSS vars in both `:root` and `[data-theme="ink"]`, the `indigo.DEFAULT`/`indigo.soft` Tailwind tokens,
  the per-theme override objects in `themes.ts`, the landing `palette.ts`, and a dedicated `tone="indigo"`
  variant in `Stamp` (`text-indigo border-indigo`). Yet nothing renders it: `grep -rn 'indigo' src`
  returns ONLY these definitions — there is no `text-indigo`/`border-indigo`/`bg-indigo`/`var(--indigo)`
  consumer anywhere, and no `<Stamp tone="indigo">` call-site (every Stamp uses `seal` or `accent`).
  (Secondary: `Badge`'s `danger` tone, Badge.tsx:9,19, is likewise never used — `grep 'tone="danger"'` →
  none — though for a Badge primitive that is more defensibly palette-completeness.)
- **Root cause**: An "official stamp blue" treatment was specced end-to-end (token + theme override +
  component variant) for stamps that were never built, and the unused ramp was never trimmed.
- **Impact**: ~10 definition sites for a colour with no rendered consumer; a maintainer re-theming the app
  must maintain `--indigo` in four places (root/ink/themes-light/themes-dark) plus the Tailwind token and
  the Stamp variant for a colour that appears nowhere, and may assume `tone="indigo"` is a working option.
- **Fix sketch**: Either delete the `indigo` ramp (the two CSS vars in both themes, the Tailwind tokens,
  the four `themes.ts` entries, the `palette.ts` keys, and Stamp's `indigo` tone) — OR adopt it where the
  design intends a blue stamp. If kept as intentional palette reserve, add a one-line comment marking it
  as forward-looking so it is not mistaken for live styling.

## 5. `.microprint` colour set via inline `style={{ color: "var(--…)" }}` instead of token classes
- **Severity**: Low
- **Category**: cleanup
- **File**: src/components/ui/Card.tsx:71-72 ; src/components/brand/Stamp.tsx:80 ; +~16 sites (DashboardTopBar.tsx:41, ConsentForm.tsx:77,86, AdjudicationBadge.tsx:37,52, PassportLanding.tsx ×9)
- **Scenario**: The `.microprint` rule (globals.css:176-183) already sets `color: var(--muted)`, yet
  call-sites repeatedly re-set colour with an inline `style` prop. `Card.tsx`'s `CardSubtitle` writes
  `className="microprint"` *and* `style={{ color: "var(--muted)" }}` — fully redundant (the inline style
  re-applies the class's own default). Others (`Stamp.tsx:80`, `DashboardTopBar.tsx:41`, etc.) override to
  `var(--muted-strong)`/`var(--accent-dark)`/`var(--success)` via inline `style`, bypassing the
  `text-muted-strong`/`text-accent-dark`/`text-success` Tailwind tokens the whole design system is built
  on. `grep` finds ~18 `style={{ color: "var(--…)" }}` occurrences under `src/components`.
- **Root cause**: No colour variants on the `microprint` treatment, so each caller hand-sets colour via
  inline CSS var rather than a token class; the redundant `var(--muted)` copies are pure copy-paste cruft.
- **Impact**: Minor, but it is a systemic bypass of the token-class layer (inline styles can't be themed or
  overridden as cleanly as utility classes) and several copies are dead no-ops. It muddies the "components
  reference tokens, not raw values" principle stated in tailwind.config.ts:3-6.
- **Fix sketch**: Drop the redundant `style={{ color: "var(--muted)" }}` on `.microprint` elements
  (CardSubtitle et al.), and replace the overriding inline colours with the existing `text-*` token classes
  (`text-muted-strong`, `text-accent-dark`, `text-success`). Optionally promote `.microprint` to a small
  component with a `tone` prop if the override is common enough to warrant it.
