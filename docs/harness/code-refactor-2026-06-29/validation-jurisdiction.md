# Code Refactor — Validation & Jurisdiction Framework
> Total: 5
> Critical: 0 | High: 0 | Medium: 2 | Low: 3

> Note: the 2026-06-23 pass already cleared this context's big-ticket cruft (the
> `subject` field, the dead `verifiedBy` column, the unused `provisional` status,
> the `COMPLIANCE_TITLE` side-table, and the US-legal-fact prose duplication —
> all verified GONE from the current code). What remains is the tail the last
> pass left behind: docs/labels that were not updated when those fields were
> deleted, plus two small dead surfaces. Every finding below was grepped against
> the current source.

## 1. `docs/validation-framework.md` documents two fields the 2026-06-23 cleanup deleted (`provisional` status + `verifiedBy`)
- **Severity**: Medium
- **Category**: cleanup
- **File**: `docs/validation-framework.md:16` (`status` row) and `docs/validation-framework.md:21` (`verifiedBy` row)
- **Scenario**: The canonical `ValidationRecord` reference table still lists `status` as `verified · provisional · needs-review` and carries a whole `verifiedBy | who/what verified it` row. Neither exists in code: `src/features/qualification/validation.ts:32` declares `ValidationStatus = "verified" | "needs-review"` (no `provisional`), and `grep -rn "verifiedBy" src` returns nothing — the field was removed in the 2026-06-23 pass (see `docs/harness/code-refactor-2026-06-23/validation-jurisdiction-framework.md` findings #2 and #4). The doc was never updated to match.
- **Root cause**: The prior cleanup deleted the `provisional` union member and the `verifiedBy` field from the type/literals but left the framework doc — which is the document the freshness script and the per-state checklist point maintainers to — describing the old shape.
- **Impact**: The one doc that exists to define "what a ValidationRecord is" now lies about its own schema. A maintainer adding a market per the checklist would try to set `verifiedBy` (a TS error) or mark a record `provisional` (also a TS error), then have to reverse-engineer the real type. On a legal-correctness layer, a stale spec is the worst kind of stale.
- **Fix sketch**: In the table, change the `status` row to `verified · needs-review` and delete the `verifiedBy` row. (Optionally note `title?` and `counselApproved` are the only metadata fields, matching the current interface.)

## 2. `/validation` Legend label "counsel signed — cleared to file" contradicts the framework's own counsel contract
- **Severity**: Medium
- **Category**: cleanup
- **File**: `src/app/validation/page.tsx:317`
- **Scenario**: The Legend renders `LegendItem tone="success" label="counsel signed — cleared to file"`. But the module and the page's own body copy state the opposite: `validation.ts:14-20` and the `counselApproved` doc at `:52-55` say `counselApproved` is a per-program *operational-readiness* status and explicitly "NOT the per-case filing gate" (filing is gated case-by-case by the attorney-of-record e-sign workflow), and the page intro at `page.tsx:82-86` says "Every individual petition is separately reviewed and signed by *your* attorney of record before filing." The compact Legend shorthand "cleared to file" asserts exactly the meaning the rest of the framework spends three paragraphs disclaiming.
- **Root cause**: The Legend was written as a quick gloss of the green "Counsel signed" badge without reconciling it against the carefully-worded contract elsewhere; the badge label (`page.tsx:244`, "Counsel signed") is accurate, but the Legend added "— cleared to file" editorializing.
- **Impact**: Internal inconsistency on a legal-transparency page: a reader scanning the Legend learns the wrong thing about what counsel sign-off means, directly undercutting the per-case-review disclaimer the page is built around. One source of truth for this claim should win.
- **Fix sketch**: Change the Legend label to match the badge and the contract, e.g. `"counsel signed — program rule-set reviewed"` (drop "cleared to file"); the per-case filing gate is already explained in the intro paragraph.

## 3. `liveJurisdictions` is `export`ed but has zero consumers outside its own module
- **Severity**: Low
- **Category**: dead-code
- **File**: `src/features/qualification/jurisdictions.ts:119`
- **Scenario**: `export function liveJurisdictions()` is called only once, internally, by `livePrograms()` at `jurisdictions.ts:125`. It is NOT re-exported by the barrel (`src/features/qualification/index.ts:24-31` exports `JURISDICTIONS`, `jurisdictionFor`, `livePrograms`, `isLiveProgram` and types — not `liveJurisdictions`), and `grep -rn liveJurisdictions` (excluding docs) finds no test and no other importer. The 2026-06-14 pass (`FIXES-WAVE-8.md`) deliberately removed it from the barrel but kept the `export` keyword "as a module function" — yet, unlike `daysBetween` (which `validation.test.ts` imports directly), nothing imports `liveJurisdictions`.
- **Root cause**: Leftover public marker from when it was barrel-exported; the barrel removal didn't follow through to the now-pointless `export`.
- **Impact**: A misleading micro-API: the `export` signals `liveJurisdictions` is a supported entry point when it is a private one-line helper, muddying the module boundary the rest of the app imports through.
- **Fix sketch**: Drop the `export` keyword — `function liveJurisdictions()` — making it a plain module-private helper (no test or external caller breaks).

## 4. `"secondary"` SourceRef kind is an unexercised union branch with a dead label-map entry
- **Severity**: Low
- **Category**: dead-code
- **File**: `src/features/qualification/validation.ts:37` (union) and `src/app/validation/page.tsx:40` (`SOURCE_KIND_LABEL.secondary`)
- **Scenario**: `SourceRef.kind` is `"primary-law" | "agency-guidance" | "court-order" | "secondary"` and `SOURCE_KIND_LABEL` maps all four, but no `ValidationRecord` source uses `"secondary"`: `grep -n 'kind: "secondary"' src` finds zero hits — the 6 records use only `primary-law`, `agency-guidance`, and (once) `court-order`. This is the same shape of unexercised-enum-branch the 2026-06-23 pass removed for the `provisional` status; `secondary`'s label render path and tone are untestable against real data. (Mild caveat: `docs/validation-framework.md:67` documents `secondary` as the lowest tier of the source hierarchy, so it is a deliberate taxonomy slot — keeping it is defensible if a secondary source is expected soon.)
- **Root cause**: The source taxonomy was modelled to mirror the documented hierarchy (primary > agency > court > secondary) even though the validated US records never needed the lowest tier.
- **Impact**: Low — a slightly wider type/render matrix than any data exercises; a reader can't tell whether `secondary` is meaningful or vestigial without grepping the records.
- **Fix sketch**: Either drop `"secondary"` from the union and `SOURCE_KIND_LABEL` (matching how `provisional` was handled), or leave a one-line `// reserved: lowest source tier, see docs/validation-framework.md` so it reads as deliberate.

## 5. Orphaned request-time comment stranded above an unrelated const in `page.tsx`
- **Severity**: Low
- **Category**: cleanup
- **File**: `src/app/validation/page.tsx:29`
- **Scenario**: The line `// Request-time so the freshness read-out reflects today, not the build date.` floats alone (blank line above and below) immediately before `const STATUS_TONE` (`:31`), which has nothing to do with request-time rendering. The actual request-time mechanism — `await connection()` (`:48`) and `export const instant = false` (`:45`) — lives ~15 lines lower and carries its OWN explanatory comments at `:43-44`. So this comment is a leftover that was stranded when the dynamic-rendering directive was refactored to `connection()`/`instant`, and its rationale is now duplicated by the live comments below it.
- **Root cause**: A `dynamic`/`revalidate` export (or similar) that this comment once annotated was replaced by `connection()` + `instant`, but the comment wasn't moved or deleted.
- **Impact**: Trivial, but it's a dangling comment that points at the wrong code and double-states the request-time rationale, adding noise for the next reader.
- **Fix sketch**: Delete line 29 (the `connection()`/`instant` comments at `:43-48` already explain the request-time choice).
