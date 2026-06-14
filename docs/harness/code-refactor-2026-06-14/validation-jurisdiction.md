# Code Refactor Scan — Validation & Jurisdiction Framework

> Total: 5 (C0 / H1 / M2 / L2)

## 1. `isStale` is a dead exported function, superseded by `freshnessOf`
- **Severity**: high
- **Category**: dead-code
- **File**: src/features/qualification/validation.ts:225
- **Scenario**: `isStale(record, todayIso)` is defined and re-exported through the `@/features/qualification` barrel (index.ts:53), but no production code calls it. Both production consumers — `scripts/check-validation-freshness.ts` and `src/app/validation/page.tsx` (`FreshnessBar`) — use the richer `freshnessOf(...)` and branch on `freshness.level === "stale"`. `isStale` is referenced only in `validation.test.ts` (lines 82–88) and named in `docs/validation-framework.md:38`. Its body (`daysBetween(record.lastVerified, todayIso) > REVALIDATE_AFTER_DAYS`) is exactly the `daysLeft < 0` / `level === "stale"` case `freshnessOf` already computes.
- **Root cause**: `isStale` was the first-pass freshness primitive; `freshnessOf` (which returns `{ daysLeft, level, dueBy }`) later subsumed it but `isStale` was never retired. The CI test was written against the old primitive and kept it alive.
- **Impact**: Two functions answer the same "is this record overdue?" question with overlapping date math. Future tweaks to the staleness rule (e.g. changing the boundary) must be made/verified in two places, and the barrel advertises an API surface no caller needs — confusing for anyone wiring new freshness UI.
- **Verification**: Grepped the whole repo for `isStale` (`Grep` over `C:\Users\mkdol\xprice\immigration-paperwork`, and again with `glob: !*.test.ts`): matches are only the definition (validation.ts:225), the barrel re-export (index.ts:53), the test (validation.test.ts), and the doc. Confirmed `freshnessOf` is the function actually used by page.tsx:198 and check-validation-freshness.ts:22.
- **Fix sketch**: Either (a) delete `isStale`, drop it from index.ts, and change `validation.test.ts`'s `daysBetween / isStale` test to assert on `freshnessOf(rec, x).level === "stale"`; or (b) keep `isStale` but reimplement it as a one-liner over `freshnessOf` (`freshnessOf(record, todayIso).level === "stale"`) so the threshold lives in exactly one place. (a) removes the dead surface; (b) keeps the convenience alias DRY. No runtime behavior change either way; the freshness test must be updated, so flag as a test-touching change.

## 2. Barrel re-exports `daysBetween` and `liveJurisdictions` are unused public surface
- **Severity**: medium
- **Category**: dead-code
- **File**: src/features/qualification/index.ts:55, src/features/qualification/index.ts:29
- **Scenario**: `daysBetween` (validation.ts:218) and `liveJurisdictions` (jurisdictions.ts:91) are both internal helpers — `daysBetween` is called by `isStale`/`freshnessOf`, and `liveJurisdictions` is called by `livePrograms` — but they are also re-exported from the feature barrel as if they were part of the public API. No file outside their own module imports either one (tests reference `daysBetween` directly from `./validation`, not via the barrel; nothing references `liveJurisdictions` except `livePrograms` in the same file).
- **Root cause**: The barrel was written to re-export everything a module exports rather than only the symbols other features consume, so internal-only helpers leaked into the public surface.
- **Impact**: Overstated public API. A reader of `@/features/qualification` sees `daysBetween`/`liveJurisdictions` as supported entry points and may build on them, coupling to helpers that are really implementation detail. Low bug risk, but it muddies the module boundary the rest of the codebase is meant to import through.
- **Verification**: Grepped the repo for each name. `liveJurisdictions` appears only at its definition (jurisdictions.ts:91), its internal caller (livePrograms, jurisdictions.ts:97), and the barrel (index.ts:29) — zero external importers. `daysBetween` appears at its definition, its two internal callers (isStale, freshnessOf), the barrel (index.ts:55), and `validation.test.ts` which imports it from `./validation` directly (not the barrel).
- **Fix sketch**: Remove `daysBetween` and `liveJurisdictions` from index.ts (keep them as non-exported-from-barrel module functions; `daysBetween` should stay a plain `export` so the co-located test can still import it from `./validation`). Breaking-change risk: none — no external importer exists.

## 3. Duplicated "today as yyyy-mm-dd" date logic across page, script, and freshness math
- **Severity**: medium
- **Category**: duplication
- **File**: src/app/validation/page.tsx:30, scripts/check-validation-freshness.ts:19, src/features/qualification/validation.ts:248
- **Scenario**: The same date primitives are re-implemented in three spots. `page.tsx:30` defines `todayIso()` = `new Date().toISOString().slice(0, 10)`; `check-validation-freshness.ts:19` inlines the identical `new Date().toISOString().slice(0, 10)`; and `freshnessOf` (validation.ts:248) hand-rolls a `lastVerified + REVALIDATE_AFTER_DAYS * 86_400_000` epoch computation with `.toISOString().slice(0, 10)` to produce `dueBy`, while the test file separately defines an `addDays` helper (validation.test.ts:111) doing the same `getTime() + days * 86_400_000` arithmetic.
- **Root cause**: Each consumer needed "today" or "shift a date by N days" and solved it locally; the validation module never exposed a `todayIso()` / `addDays()` so the small computations were copy-pasted.
- **Impact**: The slice/epoch idioms are scattered, so a fix (e.g. a timezone correction, or moving off the deprecated raw-ms math) has to be hunted down in four places, and the test's `addDays` can silently drift from `freshnessOf`'s production date math it's meant to validate.
- **Verification**: Read all four locations. Confirmed `page.tsx:30` and `check-validation-freshness.ts:19` are byte-identical expressions; confirmed `freshnessOf`'s `dueBy` math and the test's `addDays` use the same `* 86_400_000` epoch arithmetic that `daysBetween` (validation.ts:218) also uses.
- **Fix sketch**: Add `export function todayIso()` and `export function addDays(iso, days)` to validation.ts; have `freshnessOf` compute `dueBy` via `addDays(record.lastVerified, REVALIDATE_AFTER_DAYS)`, have page.tsx and the script import `todayIso`, and have the test import `addDays` instead of redefining it. Pure refactor, no behavior change.

## 4. `provisional` ValidationStatus is a defined-but-never-assigned union member
- **Severity**: low
- **Category**: dead-code
- **File**: src/features/qualification/validation.ts:21
- **Scenario**: `ValidationStatus = "verified" | "provisional" | "needs-review"` declares a `"provisional"` state, and `page.tsx` carries UI affordances for it (`STATUS_TONE.provisional` at page.tsx:36, the legend label "provisional / needs-review" at page.tsx:278). But no `ValidationRecord` is ever assigned `status: "provisional"` — every record in `PROGRAM_VALIDATIONS`/`COMPLIANCE_VALIDATIONS` is `"verified"` except `UK-Global-Talent`, which is `"needs-review"`.
- **Root cause**: The status taxonomy was designed with three tiers; in practice only two are used (verified vs needs-review), leaving the middle tier reserved-but-unused.
- **Impact**: Cosmetic. The `Record<ValidationStatus, ...>` maps in page.tsx must keep the `provisional` key for exhaustiveness, and the legend shows a status no record uses — slightly misleading on the public transparency page. Removing it is genuinely optional; the tier may be intended as a future "researched but not fully verified" state.
- **Verification**: Grepped `provisional` across `src/`. The only hits are the type declaration, page.tsx's tone map + legend, and unrelated UK *prose* ("criteria are provisional") in jurisdictions.ts/packs.ts that are plain English, not the status value. No record literal sets `status: "provisional"`.
- **Fix sketch**: Leave as-is if a provisional tier is roadmapped (it's harmless and the maps are exhaustive). Otherwise drop `"provisional"` from the union, the `STATUS_TONE` entry, and simplify the legend label to "needs-review". Low priority; document the intent rather than silently removing.

## 5. `COMPLIANCE_TITLE` display-label map lives in the page while record subjects live in the data module
- **Severity**: low
- **Category**: structure
- **File**: src/app/validation/page.tsx:47
- **Scenario**: `COMPLIANCE_TITLE` (page.tsx:47) maps each compliance key (`us-federal-practice`, `us-arizona-abs`) to a human title ("Federal practice of immigration law", "Law-firm structure (Arizona ABS)"). These keys are defined by `COMPLIANCE_VALIDATIONS` in validation.ts, so the human label for each compliance record is split across two files; adding a third compliance record requires editing both the data module and the page, or the page falls back to showing the raw key (`COMPLIANCE_TITLE[key] ?? key`).
- **Root cause**: `ValidationRecord` has no display-name field for compliance topics (programs get their label from `VISA_PACKS`), so the page invented a local lookup to humanize the keys.
- **Impact**: Minor maintenance coupling — the set of compliance keys is authored in validation.ts but their titles in page.tsx can drift or be forgotten, degrading to a raw slug on the public page. Not a bug; the `?? key` fallback is safe.
- **Verification**: Read page.tsx (COMPLIANCE_TITLE defined 47–50, consumed at line 95 `title={COMPLIANCE_TITLE[key] ?? key}`) and validation.ts (COMPLIANCE_VALIDATIONS keys 153/178). Confirmed `COMPLIANCE_TITLE` is page-local with no other references (no barrel export).
- **Fix sketch**: Add an optional `title?: string` (or `label`) to `ValidationRecord` and set it on the two compliance records in validation.ts, then read `record.title ?? key` in the page — co-locating each record's display name with its data. Optional polish; only worth it if more compliance records are expected.
