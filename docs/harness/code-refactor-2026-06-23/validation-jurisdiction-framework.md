# Code Refactor — Validation & Jurisdiction Framework
> Total: 5 (C1/H1/M2/L1)

## 1. `subject` field redundantly restates each record's own map key
- **Severity**: Critical
- **Category**: duplication
- **File**: `src/features/qualification/validation.ts:38` (the field) — restated at `:66`, `:90`, `:114`, `:138` (`PROGRAM_VALIDATIONS`) and `:164`, `:189` (`COMPLIANCE_VALIDATIONS`)
- **Scenario**: Both `PROGRAM_VALIDATIONS` and `COMPLIANCE_VALIDATIONS` are keyed maps (`Record<Classification, …>` / `Record<string, …>`), yet every record ALSO carries `subject: "<same string as its key>"` — e.g. the entry keyed `"us-arizona-abs"` has `subject: "us-arizona-abs"`. The key is the canonical identity; `subject` is a hand-copied duplicate of it on all 6 records. `subject` is the value actually printed by the CI freshness report: `grep -rn "\.subject|subject:" src scripts` shows the only READS are `scripts/check-validation-freshness.ts:40` and `:50` (`**${record.subject}**`). Nothing derives `subject` from the key, so the two can silently diverge.
- **Root cause**: The record interface was modelled as if it could live outside its map (a self-describing struct), but in practice records are only ever reached through their map key. The `subject` field was added for the report label before realising the key already is that label.
- **Impact**: A rename/typo of either the key or `subject` makes the weekly freshness issue (and the `stalePrograms`/`validationFor` lookups, which key off the map) point at a record whose printed name no longer matches its identity — a mislabeled overdue legal rule in the very report that exists to keep legal rules honest. This is the precise class of divergence bug a cleanup scan should kill: two sources of truth for one identity.
- **Fix sketch**: Drop `subject` from `ValidationRecord` and from all 6 literals. In the freshness script derive the label from the map key instead — iterate with `Object.entries(...)` (or have `allValidations()` return `{ key, record }` pairs) and print the `key`. Single source of truth; the report can never drift from the identity again.

## 2. Dead `verifiedBy` field — a typed column + 6 identical literals nothing reads
- **Severity**: High
- **Category**: dead-code
- **File**: `src/features/qualification/validation.ts:47` (field) — assigned identically at `:71`, `:95`, `:119`, `:142`, `:168`, `:193`
- **Scenario**: `verifiedBy: string` is declared on `ValidationRecord` and set to the byte-identical literal `"web-research (primary sources)"` on every one of the 6 records, but it is never consumed: `grep -rn "verifiedBy" src scripts e2e` returns only the interface declaration and the 6 assignments — no read in `page.tsx` (the page renders status/legalBasis/threshold/lastVerified/freshness/sources/notes but never `verifiedBy`), none in the freshness script, none in tests, none in the barrel consumers. It is write-only data.
- **Root cause**: Field added speculatively to display "who verified this" on `/validation`, but the page settled on the status/counsel two-badge model and the field was never wired in — then copy-pasted onto each new record.
- **Impact**: Carries a maintenance tax with zero payoff: every new record must remember to set a meaningless string, and the doc comment at `:46` (`"web-research (primary sources)" until counsel signs off`) implies a behaviour (a value that flips on sign-off) that no code implements, which is actively misleading to the next maintainer.
- **Fix sketch**: Either delete `verifiedBy` from the interface and all 6 records, OR — if "who verified" is wanted on the page — render `record.verifiedBy` in a `Field` in `ValidationCard`. Given it's a constant on every record, deletion is the cleaner call; counsel sign-off is already tracked truthfully by `counselApproved`.

## 3. US federal-practice / Arizona-ABS legal facts duplicated across two modules
- **Severity**: Medium
- **Category**: duplication
- **File**: `src/features/qualification/jurisdictions.ts:57-61` (US `representationNote`) vs `src/features/qualification/validation.ts:182-187` (`us-federal-practice.notes`) and `:207-211` (`us-arizona-abs.notes`)
- **Scenario**: The same load-bearing legal claims are written out as prose in two places. `jurisdictions.ts` US `representationNote` states "an attorney licensed and in good standing in any one U.S. state may act as attorney of record nationwide (8 CFR §1.2 …)" and "software licensed to an attorney-owned firm under an Arizona ABS". `validation.ts` `us-federal-practice.notes` re-states the any-state-bar-covers-the-nation rule, and `us-arizona-abs.notes` re-states the ABS/ER-5.4 structure. Same facts, two hand-written copies (the citations even differ in form: `8 CFR §1.2` vs `8 CFR 1.2 / 1001.1(f)`).
- **Root cause**: The jurisdiction registry and the validation ledger were authored separately for separate surfaces (case header vs `/validation` page), each needing the explanatory text, so each grew its own copy.
- **Impact**: When the legal position is re-verified (the 180-day cadence this whole framework enforces) a maintainer must remember to update BOTH the `representationNote` and the matching compliance `notes`, or the case-header copy and the `/validation` copy will assert subtly different things about the same rule — a credibility/compliance risk on a legal product.
- **Fix sketch**: Make the compliance `ValidationRecord` the single source for the legal claim and have the jurisdiction `representationNote` reference it (e.g. derive the US note from `COMPLIANCE_VALIDATIONS["us-federal-practice"].legalBasis` + a shared blurb constant), or at minimum extract the shared sentences into named constants in one module imported by the other. Don't keep two prose copies of the same regulation.

## 4. `"provisional"` validation status is defined but never used (dead enum branch)
- **Severity**: Medium
- **Category**: dead-code
- **File**: `src/features/qualification/validation.ts:28` (union member) — its tone mapping at `src/app/validation/page.tsx:33`, its Legend label at `page.tsx:317`
- **Scenario**: `ValidationStatus = "verified" | "provisional" | "needs-review"` includes `"provisional"`, and `STATUS_TONE` maps it to `"warning"`, but no record is ever `provisional`: `grep -rn "provisional" src` over the records shows the 6 records use only `"verified"` (5) and `"needs-review"` (1) — every other `provisional` hit is unrelated prose in `jurisdictions.ts`/`packs.ts`. The union member, its `STATUS_TONE` entry, and the Legend's combined `"provisional / needs-review"` label are all carrying an unexercised state.
- **Root cause**: The status taxonomy was designed for a richer lifecycle (`verified` → `provisional` → `needs-review`) than the data ever used; `provisional` was reserved but never assigned to a record.
- **Impact**: Low blast radius but it widens the type's surface and the page's render matrix beyond what any data exercises — `STATUS_TONE`'s `provisional` branch and the e2e/`STATUS_TONE` coverage are untestable against real records, and a reader can't tell whether `provisional` is meaningful or vestigial.
- **Fix sketch**: If no near-term record will be `provisional`, drop it from the union, from `STATUS_TONE`, and simplify the Legend item to just "needs-review". If it's intended future state, leave a one-line `// reserved: …` note so it reads as deliberate rather than forgotten — but deletion is the cleaner default for a cleanup pass.

## 5. `COMPLIANCE_TITLE` is a parallel hardcoded label table divorced from the records
- **Severity**: Low
- **Category**: structure
- **File**: `src/app/validation/page.tsx:44-47` (used at `:112`)
- **Scenario**: The page keeps a separate `COMPLIANCE_TITLE: Record<string,string>` mapping compliance keys to display names, looked up as `COMPLIANCE_TITLE[key] ?? key`. The `?? key` fallback means a new compliance record added to `COMPLIANCE_VALIDATIONS` without a matching `COMPLIANCE_TITLE` entry silently renders its raw key (`"us-federal-practice"`) as a heading. Program cards, by contrast, get their human label from `VISA_PACKS[...].label` (`:151`) — the display name lives WITH the data — so compliance is the odd one out, holding its labels in a second table in the view layer.
- **Root cause**: `COMPLIANCE_VALIDATIONS` records have no display-name field (unlike packs), so the page bolted on a local lookup rather than adding the label to the record.
- **Impact**: Adding a compliance claim requires editing two files in sync; forget the page table and the new claim shows an un-prettified key to users on a legal-transparency page. Minor today (2 records), but it's a quiet drift trap and an inconsistency with how programs are titled.
- **Fix sketch**: Add an optional `title?: string` (or `label`) to `ValidationRecord` (compliance records set it; program records can keep deriving from `VISA_PACKS`), and have the page read `record.title ?? key`. Removes the standalone `COMPLIANCE_TITLE` table and co-locates the label with the data it names.
