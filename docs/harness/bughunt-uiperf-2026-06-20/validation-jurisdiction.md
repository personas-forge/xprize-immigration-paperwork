> Total: 5 | Critical: 1 | High: 2 | Medium: 1 | Low: 1
> Context: Validation & Jurisdiction Framework
> Lens mix: bug-hunter 4, ui-perfectionist 1

## 1. Unparseable `lastVerified` date silently classifies a stale rule as "fresh"
- **Severity**: Critical
- **Lens**: bug-hunter
- **Category**: date-math / silent failure
- **File**: src/features/qualification/validation.ts:218-257 (`daysBetween` → `freshnessOf`)
- **Scenario**: A `ValidationRecord.lastVerified` is malformed (typo on a `lastVerified` bump, an empty string, `"2026-13-40"`, or a date that fails `new Date(...).getTime()`). `freshnessOf` is called for it on the `/validation` page and in `scripts/check-validation-freshness.ts`.
- **Root cause**: `daysBetween` does `Math.floor((b - a) / 86_400_000)` with no `Number.isNaN` guard. An unparseable ISO string makes `new Date(...).getTime()` return `NaN`, so `daysBetween` returns `NaN`. In `freshnessOf`, `daysLeft = 180 - NaN = NaN`; the classifier is `daysLeft < 0 ? "stale" : daysLeft <= 30 ? "due-soon" : "fresh"`. Both comparisons against `NaN` are `false`, so the `else` branch wins and `level = "fresh"`. The CI gate only enforces a `yyyy-mm-dd` *shape* (`DATE_RE` in `validation.test.ts`) — `"2026-13-40"` matches the regex but is an invalid calendar date, and no test feeds a bad date through `freshnessOf`.
- **Impact**: The single safety mechanism of this app — "a stale legal rule is flagged, never shown as current" — fails open. A program whose verification date is corrupt is rendered with a green freshness bar and `0`/`NaN`-day countdown, and `check-validation-freshness.ts` exits `0` (everything "fresh"), so the weekly tracking issue never opens. A regulatory rule overdue for re-verification is presented to users as current. This is the exact stale-rule-shown-as-current class the framework exists to prevent.
- **Fix sketch**: In `daysBetween`, throw or return a sentinel on `Number.isNaN(a) || Number.isNaN(b)`. Better: have `freshnessOf` validate the parse and return `level: "stale"` (fail-safe, not fail-open) with `daysLeft: -Infinity`/a flag when `lastVerified` is unparseable. Add a `validation.test.ts` case asserting an invalid `lastVerified` is treated as stale, and tighten the CI guard to parse the date (round-trip `addDays(iso,0) === iso`) rather than only regex-match it.

## 2. A "stale" record still shows the green `verified` badge — mixed correctness signal
- **Severity**: High
- **Lens**: ui-perfectionist
- **Category**: missing state / visual communication of staleness
- **File**: src/app/validation/page.tsx:201-206, 31-35, 157-165 (`ValidationCard` header + `STATUS_TONE` + `FreshnessBar`)
- **Scenario**: A record is `status: "verified"` but its freshness is past the 180-day window (`level: "stale"`). On the card, the status `Badge` is driven only by `STATUS_TONE[record.status]` → `success` (green "verified"), while the small `FreshnessBar` below shows a red "Nd overdue" line.
- **Root cause**: Status tone and freshness level are computed independently and never reconciled. The most prominent element (the header badge) ignores freshness entirely; staleness is communicated only by a 6px progress bar and a `microprint` line lower in the card body.
- **Impact**: A legal-rule card that is overdue for re-verification reads, at a glance, as authoritatively "verified / current." The strongest visual affordance contradicts the actual freshness state — undermining the page's entire purpose (transparently signalling correctness) and burying a legally meaningful warning in low-contrast microprint. On narrow viewports the freshness column wraps far below the green badge, widening the gap.
- **Fix sketch**: When `freshness.level === "stale"`, escalate the header: render a distinct "Verified · re-verification overdue" badge in `warning`/`danger` tone (or add a second prominent badge), and/or add a card-level banner. Drive the visual emphasis from a combined `(status, freshness)` state, not from `status` alone.

## 3. Docs claim CI enforces an `isStale` freshness function that does not exist
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: validation-freshness logic / drift between guarantee and code
- **File**: docs/validation-framework.md:38, 41 (and the CHANGELOG) vs src/features/qualification/validation.ts (no `isStale`); src/features/qualification/validation.test.ts:87-101
- **Scenario**: `docs/validation-framework.md` states the CI gate enforces "freshness math (`isStale`) is correct." There is no `isStale` export anywhere in `validation.ts`; freshness lives in `freshnessOf`. The CI test (`validation.test.ts`) only checks `freshnessOf` for one record at three hand-picked offsets — it never asserts the **stale** classification gates anything, and crucially **no test fails when a record is actually overdue**.
- **Root cause**: The freshness *report* (`check-validation-freshness.ts`) runs only in a weekly scheduled workflow (`validation-freshness.yml`), not in the per-commit `verify` job. So despite the doc's wording, nothing in PR/commit CI fails on a stale record — the only enforcement is a once-a-week issue that itself fails open per finding #1. The doc oversells the guarantee.
- **Impact**: Maintainers trust a CI gate ("a market can't go live stale") that is not wired into commit CI and references a non-existent function. A record can drift past 180 days and ship; detection waits up to 7 days and is defeated by any unparseable date. Misleading docs around a legal-correctness control is itself a risk.
- **Fix sketch**: Either add `isStale(record, today)` (thin wrapper over `freshnessOf`) and a `verify`-job test that fails on any stale LIVE program, or correct the doc to state that freshness is enforced *only* by the weekly workflow (not commit CI) and name `freshnessOf`. Add a test that constructs a synthetically-overdue record and asserts `level === "stale"`.

## 4. `freshnessOf` parameter shadows the imported `todayIso` helper
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: maintainability / latent date-source bug
- **File**: src/features/qualification/validation.ts:251 (`freshnessOf(record, todayIso: string)`)
- **Scenario**: `freshnessOf`'s second parameter is named `todayIso`, identical to the exported `todayIso()` function defined 24 lines above. Inside the function body the name now refers to the string param, not the helper.
- **Root cause**: Name collision between a module-level function and a parameter. It happens to work because the function never *calls* `todayIso()` internally — but any future edit that adds a "default to today" fallback (e.g. `const now = todayIso ?? todayIso()`) would silently reference the shadowed string and break, or a reader assumes the param is already-normalized UTC when callers could pass any string (e.g. a local-timezone date), reintroducing the timezone skew the helper exists to prevent.
- **Impact**: No live bug today, but it's a foot-gun on the single most clock-sensitive function in the app, and it obscures that callers are responsible for passing a UTC `yyyy-mm-dd`. One unguarded caller passing a local-date string would shift the stale/fresh boundary by a day near midnight UTC.
- **Fix sketch**: Rename the parameter to `today` (or `asOfIso`). Optionally make it `today: string = todayIso()` so the default is the canonical UTC source, and assert/normalize the input shape.

## 5. `FreshnessBar` `role="meter"` is under-labelled and the countdown text isn't programmatically tied to it
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: a11y / polish
- **File**: src/app/validation/page.tsx:159-183 (`FreshnessBar`)
- **Scenario**: The bar uses `role="meter"` with `aria-valuenow/min/max` reporting *elapsed-percentage* and `aria-label="Freshness — elapsed since last verification"`. The human-meaningful values — "Nd overdue" / "N days until re-verify" and "re-verify by <date>" — sit in sibling `<span>`s with no `aria-describedby` link, and the meter has no `aria-valuetext`.
- **Root cause**: The accessible name conveys a raw percentage; the semantic countdown is visual-only text not associated with the meter. Screen-reader users hear "55%" with no indication it means a legal re-verification deadline, and the overdue state isn't announced as a warning.
- **Impact**: Assistive-tech users get a meaningless percentage instead of the staleness status; the overdue/danger condition (a `danger`-colored bar) carries no non-visual or text-alternative signal, so color is the only cue for an important state.
- **Fix sketch**: Add `aria-valuetext` to the meter conveying days-left / overdue, link the countdown spans via `aria-describedby`, and ensure the overdue state has a text/icon cue (e.g. "Overdue") not just `bg-danger`, so it isn't color-only.
