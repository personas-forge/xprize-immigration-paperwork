# Code Refactor — Marketing Site
> Total: 5
> Critical: 0 | High: 0 | Medium: 3 | Low: 2

_Context note (prompt drift — verified, not findings):_
- `src/app/landing-claude/page.tsx` **no longer exists** (grep of `src/` for `landing-claude` returns only a `pricing/page.tsx` doc comment + a `middleware.ts` comment, zero route/link). The "alternate editorial landing / delete-vs-keep brand decision" flagged by prior scans is **already resolved** — the route is gone. Not a finding.
- `src/components/PetitionStepper.tsx` **no longer exists** and is referenced nowhere (`grep PetitionStepper src/` = 0). Already removed. Not a finding.
- The live marketing surface today is: `src/app/page.tsx` → `src/components/landing/PassportLanding.tsx` (the "Passport / Arrival" homepage, its own `PassportNav` + footer), `src/components/SiteChrome.tsx` (shared header/footer for the *other* marketing pages), `faq/page.tsx` + `FaqEntry.tsx`, `pricing/page.tsx` (redirect), `layout.tsx`, `public/manifest.webmanifest`. The 2026-06-23 refactor + landing-claude deletion already cleared the obvious dead routes/dup, so there is **no High-value dead route / god-module / large dup** left here — the remaining cruft is the items below.

## 1. Dead in-page anchors: FAQ's primary CTA `/#start` and the site-wide footer `/#how` point to section IDs that don't exist
- **Severity**: Medium
- **Category**: cleanup
- **File**: src/app/faq/page.tsx:125 (`href="/#start"`), src/components/SiteChrome.tsx:78 (`href="/#how"`)
- **Scenario**: The homepage's only section IDs are `arrival`, `criteria`, `checkpoints`, `evidence`, `allowance`, `depart` (`SECTIONS` in PassportLanding.tsx:27-34; `grep id="start"|id="how"` on PassportLanding = 0 element matches — only the unrelated `align="start"` prop). So the FAQ's main conversion button "Take the qualification" (`/#start`) and the **footer "How it works" link that renders on every SiteChrome page** (faq, billing, validation, qualify, visa) both land at the top of `/` and scroll nowhere.
- **Root cause**: Section IDs were renamed (older scheme used `start`/`how`); the two outbound anchors were never updated. Leftover stale anchors.
- **Impact**: Broken/misleading links on a customer-facing funnel — the FAQ's headline CTA doesn't reach the qualifier it promises, and a site-wide footer link is dead. Pure trust/UX cruft, near-zero correctness payoff if left.
- **Fix sketch**: Point `/#start` → `/qualify` (the real screener, matching the homepage hero CTA at PassportLanding.tsx:274). Point `/#how` → `/#checkpoints` (the "How the petition is built" section) or `/qualify`.

## 2. FAQ re-states the token-economy numbers as hardcoded prose, duplicating the source of truth (drift risk in pricing copy)
- **Severity**: Medium
- **Category**: duplication
- **File**: src/app/faq/page.tsx:35,39 (and the cost sentence in :27)
- **Scenario**: The FAQ prose hardcodes "150 free tokens", "screening costs 3 tokens, a full petition-letter draft 12, a single-section regenerate or an RFE response 5, and evidence categorization 1", "an RFE response costs 5", and "a bundle from $5". Every value is currently correct — but it is a copy of `FREE_SIGNUP_GRANT = 150` (economy.ts:11), `TIER_COST` (registry.ts:16-21: light 1 / medium 3 / heavy 5 / xl 12) mapped through `OPERATION_REGISTRY` (registry.ts:37-44), and the starter bundle `priceCents: 500` → "$5" (economy.ts:38). Meanwhile the landing page derives all of these (`FREE_SIGNUP_GRANT`, `BUNDLES`, `bundlePriceLabel` — PassportLanding.tsx:16, 289, 529) so it "can't quote a stale price."
- **Root cause**: Prose written with literals instead of interpolating the canonical constants; the FAQ is the lone marketing surface that doesn't import them.
- **Impact**: If a tier cost or the signup grant changes in registry.ts/economy.ts, the FAQ silently lies about price — the one page users open *specifically* to learn cost. Trust/correctness drift waiting to happen.
- **Fix sketch**: Interpolate the canonical values into the answer strings — at minimum `${FREE_SIGNUP_GRANT}` and the starter `bundlePriceLabel(bundleByKey("starter"))`, and ideally `costOf("qualify"|"draft"|"draft_section"|"rfe"|"categorize")` for the cost breakdown — so the FAQ tracks the registry like the landing page already does.

## 3. `/pricing` redirect route is internally unreferenced and its rationale comment is stale/false
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/app/pricing/page.tsx:6
- **Scenario**: The comment justifies the redirect as keeping "the old /pricing links (homepage, FAQ)" working — but `grep -n "/pricing" src/` finds **zero** `href="/pricing"`; only this comment and a `middleware.ts:7` comment mention it. The homepage links to `/billing` directly (PassportLanding.tsx Allowance :541 and Depart :656) and the FAQ links to `/billing` (:132). The sitemap lists `/billing`, not `/pricing` (sitemap.ts:17). So the route's stated reason for existing is false.
- **Root cause**: Homepage/FAQ were migrated to link `/billing` directly; the redirect's justifying comment wasn't updated, leaving a lying comment over an internally-dead route.
- **Impact**: Misleading rationale invites a future reader to "preserve" links that no longer exist; the route survives only as external-bookmark/SEO compat, which the comment obscures.
- **Fix sketch**: Either delete the route (no internal linker; sitemap doesn't list it) or — if kept purely for external-bookmark compat — rewrite the comment to say exactly that ("no internal links remain; retained as a permanent redirect for old external/bookmark traffic").

## 4. `SiteChrome` doc comment claims it is the chrome for "home", but the homepage uses its own nav/footer
- **Severity**: Low
- **Category**: cleanup
- **File**: src/components/SiteChrome.tsx:8
- **Scenario**: The header comment says "ONE header + footer for every marketing page (home, qualify, billing, faq, validation, visa)." But `src/app/page.tsx` renders `PassportLanding`, which imports neither `SiteHeader` nor `SiteFooter` (PassportLanding.tsx:1-18) — it ships its own `PassportNav` (:88) and a bespoke footer inside `Depart` (:649-658). The homepage is precisely the page SiteChrome does **not** cover.
- **Root cause**: Comment written before/independent of the passport homepage redesign; "home" was never true (or stopped being true) and wasn't corrected.
- **Impact**: A maintainer trusting the comment could try to standardize the homepage onto SiteChrome (breaking its design) or assume a footer-link fix here also fixes the homepage. Documentation cruft.
- **Fix sketch**: Drop "home" from the list (it's qualify/billing/faq/validation/visa) and note the homepage intentionally ships its own passport chrome.

## 5. `PRO_PRICE_CAPTION` carries a hardcoded, unreachable fallback that re-duplicates the Pro price it's meant to derive
- **Severity**: Low
- **Category**: dead-code
- **File**: src/components/landing/PassportLanding.tsx:39-42
- **Scenario**: `const PRO_BUNDLE = BUNDLES.find((b) => b.key === "pro")` then `PRO_BUNDLE ? <derived> : "$48 for 8,000 tokens"`. `"pro"` is a permanent catalog entry (economy.ts:40, `featured: true`), so `.find` never returns `undefined` and the `: "$48 for 8,000 tokens"` branch is unreachable. Worse, that fallback hardcodes the exact `$48` / `8,000 tokens` the derived branch computes — defeating the comment's own promise (:38-39) that the caption is "derived … so the headline comparison can't quote a stale price."
- **Root cause**: Defensive ternary added "just in case", but it pins a literal price that becomes stale the moment the Pro bundle changes — the opposite of the intent.
- **Impact**: Dead branch + a second copy of the Pro price that silently goes stale if `priceCents`/`tokens` move; trivial but it undercuts the single-source-of-truth design.
- **Fix sketch**: Drop the fallback (rely on the always-present "pro" entry), or make the fallback price-free copy (e.g. "Pro bundle") so no stale dollar figure can leak.
