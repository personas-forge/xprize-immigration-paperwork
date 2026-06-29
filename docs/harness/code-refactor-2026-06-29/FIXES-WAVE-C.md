# Code Refactor — Wave C (Theme C + D)

Two consolidations on `vibeman/code-refactor-2026-06-29`, built on Waves A+B.
Gates after each logical change: `tsc --noEmit` exit 0, `tsx --test` 443/443 pass.

## Part 1 — `createLocalStorageStore<T>` (pure, behavior-preserving)

**Closes:** `brand-design-system.md` #1 (HIGH) + `case-file-dashboard.md` #1 (HIGH) — the same
finding: three hand-rolled SSR-safe `useSyncExternalStore` + localStorage stores with the snapshot
-stability shim and no shared factory.

New module: **`src/lib/createLocalStorageStore.ts`** — exported symbol
**`createLocalStorageStore<T>(options)`** returning
`{ subscribe, getSnapshot, getServerSnapshot, read, write }`. It carries once: the SSR-safe
`getSnapshot`, the cached `{ raw, value }` snapshot-stability shim (stable reference between writes so
`useSyncExternalStore` doesn't loop), the custom-event + cross-tab `storage` subscription, and the
best-effort write-through setter. Options: `key`, `eventName`, `defaultValue`, `parse`, `serialize`,
`crossTab` (default true), `notifyOnFailedWrite` (default false). Framework-agnostic (no React import,
no `"use client"`) so the node-tested `bannerDismiss` can import it; `window` is touched only inside
function bodies, never at import time.

Rewired all three onto it, each behavior-identical (same keys, defaults, event names, theme pre-paint
timing):

| Module | Key | Event | crossTab | Notes |
|---|---|---|---|---|
| `usePersistentQuery.ts` | `atelier-case-query` | `atelier-case-query-change` | yes | full factory: subscribe/snapshot/server/write; dropped ~50 LOC. `sanitize`/`parse` kept. |
| `bannerDismiss.ts` | `atelier-token-banner-dismissed` | `atelier-token-banner-change` | yes | factory provides subscribe/getSnapshot/getServerSnapshot; **injectable `readDismissed`/`writeDismissed` kept local** (unit-tested with an in-memory stub). |
| `ThemeToggle.tsx` | `atelier-theme` | `atelier-theme` | **no** | shares subscribe + getServerSnapshot + persist/notify `write`; keeps its **DOM-attribute `readMode` snapshot** (pre-paint script is the source of truth), its DOM set/delete writer, and `themeInitScript`. Uses `notifyOnFailedWrite: true` — the toggle has already mutated `data-theme`, so the event must fire to re-render even if localStorage throws (private mode). |

Behavior parity details preserved:
- `usePersistentQuery` keeps the "failed write must NOT notify" guard (localStorage is the source of
  truth → a failed write changed nothing).
- `bannerDismiss` previously *always* notified on write; the factory's safe-write does not notify on a
  failed write. This is observationally identical — a failed `setItem` leaves storage unchanged, so the
  old extra event only re-rendered subscribers back to the same `false`; the banner stays visible either
  way (the documented "re-appears on next load" behavior). The success path (the normal case) is
  unchanged. No test asserted the failed-write notify.
- `ThemeToggle` pre-paint / hydration path is untouched: SSR snapshot `"parchment"`, single-tab event,
  DOM-read client snapshot, `themeInitScript` verbatim.

**Skipped (with reason):** `src/components/landing/useThemePalette.ts` — a looser DOM-read cousin
(returns palette objects, no localStorage at all). Not in the task's three; the case-file report itself
marks folding it in as "optional / later." Left untouched to keep Part 1 strictly no-op.

## Part 2 — canonical `caseStatusTone` (resolves the visual drift)

**Closes:** `brand-design-system.md` #2 + `case-file-dashboard.md` #2 + `attorney-review-filing.md` #2
— no single owner of case-status → Badge tone; CaseList, ReviewPanel, and the dashboard "Your cases"
list colored the same status (esp. "Filed") differently.

New module: **`src/features/case-file/caseStatusTone.ts`** — exported symbol
**`caseStatusTone(status: string): BadgeTone`** (data-driven `Partial<Record<CaseStatus, BadgeTone>>`
+ `neutral` fallback), mirroring how `criteria.ts` owns criterion-status → tone. Deleted the two
private `statusTone` copies (CaseList, ReviewPanel) and the hardcoded `tone="neutral"` in
CaseFileDashboard's list; all three now import the one map.

Canonical mapping chosen = ReviewPanel's (the most semantically-correct of the three): "Filed" is a
positive USCIS milestone → green; "Attorney Review" is the active working stage → gold; early stages →
grey.

### Status → tone change table (the visual change to eyeball — no visual tests exist)

| Status | CaseList (old) | ReviewPanel (old) | CaseFileDashboard list (old) | **New canonical** |
|---|---|---|---|---|
| Intake | warning (amber) | neutral (grey) | neutral (grey) | **neutral (grey)** |
| Drafting | neutral (grey) | neutral (grey) | neutral (grey) | **neutral (grey)** |
| Attorney Review | neutral (grey) | accent (gold) | neutral (grey) | **accent (gold)** |
| Filed | accent (gold) | success (green) | neutral (grey) | **success (green)** |
| Approved | success (green) | success (green) | neutral (grey) | **success (green)** |

Per-site visual delta:
- **CaseList** (3 changes): Intake amber→grey; Attorney Review grey→gold; Filed gold→green. (Drafting,
  Approved unchanged.)
- **ReviewPanel** (0 changes): its mapping already equaled the canonical one — adopted as the SSoT.
- **CaseFileDashboard "Your cases"** (3 changes): Attorney Review grey→gold; Filed grey→green; Approved
  grey→green. (Intake, Drafting stay grey.) This is the "dashboard list was simply wrong" fix —
  terminal Approved/Filed cases no longer look identical to Intake.

Out of scope (left as-is): the criterion-status `statusTone` in `criteria.ts` (a different domain,
correctly centralized and tested); the static non-status badges in CaseFileDashboard (e.g. "Sample ·
92%…", "{n} on file"); the queue-age buckets in `queue-age.ts`.

## Tests
No test was modified. The case-status tone copies were private and untested; the only `statusTone`
tests are for the criterion mapper (`criteria.test.ts`), untouched. `bannerDismiss.test.ts` still green
(its injectable `readDismissed`/`writeDismissed`/`DISMISS_KEY` API is unchanged).

Final: **tsc --noEmit exit 0**, **443/443 tests pass**.

## Commits
- `8f5ded6` refactor(ui): extract shared createLocalStorageStore factory
- `ea7c78d` refactor(ui): canonical caseStatusTone — one status→Badge map
