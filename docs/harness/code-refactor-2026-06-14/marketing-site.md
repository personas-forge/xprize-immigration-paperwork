# Code Refactor Scan — Marketing Site

> Total: 4 (C0 / H2 / M1 / L1)

## 1. Homepage + landing-claude advertise the RETIRED flat-fee pricing model
- **Severity**: high
- **Category**: dead-code
- **File**: src/app/page.tsx:292-358 (and src/app/landing-claude/page.tsx:147-165)
- **Scenario**: A visitor reads the homepage "Schedule of fees" section — O-1A $2,500 / O-1B $3,500 / EB-1A $4,500 flat — clicks "full schedule of fees →" (page.tsx:304) which points at `/pricing`. But `/pricing` is now `redirect("/billing")` (src/app/pricing/page.tsx:8), and `/billing` shows a completely different model: the token economy (Starter/Builder/Pro/Scale/Monthly bundles, $5–$150) from `src/lib/tokens/economy.ts`. The advertised pricing and the actual purchasable pricing disagree.
- **Root cause**: Subscription/fee-schedule pricing was retired in favour of the prepaid token ledger (see pricing/page.tsx comment + billing/page.tsx header "Replaces the old subscription pricing"), but the marketing copy that sells the old flat-fee model was never updated. The hardcoded `Plan` cards in `page.tsx` `Pricing()` and the "$2,500 flat fee" assurance band in `landing-claude` are now stale/dead marketing of a model the product no longer sells.
- **Impact**: Conversion-path contradiction and a truthfulness risk on a regulated SaaS — the homepage promises "$2,500 flat … no hours billed," the checkout sells per-token credits. Two source-of-truth pricing surfaces drift independently.
- **Verification**: Read all three files. `economy.ts:59-66` is the canonical `BUNDLES`; `billing/page.tsx:10,95` consumes it. `page.tsx` `Plan`/`Pricing` and `landing-claude` use string literals ($2,500 etc.) with no import of `economy.ts`. Grep for `2500|3500|4500` across `src` returns only the marketing files + the unrelated `monthly` 2500-token bundle — confirming the flat-fee numbers exist nowhere in the canonical config.
- **Fix sketch**: Decide the canonical model (token ledger appears to be it), then rewrite the homepage `Pricing()` section and the landing-claude assurance band to reflect token bundles (ideally driven from `BUNDLES`/`FREE_SIGNUP_GRANT`), or remove the flat-fee plan cards. Product/copy decision required — flag before deleting.

## 2. Marketing SiteHeader/SiteFooter duplicated across 5 routes
- **Severity**: high
- **Category**: duplication
- **File**: src/app/page.tsx:38-67,399-414 (+ faq:118-156, billing:166-204, qualify:53-..., validation:296-...)
- **Scenario**: Every public route defines its own local `SiteHeader()` and `SiteFooter()` with hand-maintained nav links and focus-ring class strings. landing-claude has a fourth inline masthead/footer variant. A nav change (e.g. the `/pricing`→`/billing` migration) must be applied in 5+ places by hand, and they have already drifted: `page.tsx` footer links to `/pricing` and `/landing-claude`; `faq` footer links to `/pricing` + `/dashboard`; `billing` footer links to `/faq` + `/dashboard`.
- **Root cause**: No shared `<SiteHeader>/<SiteFooter>` component; each page copies the chrome. The repeated `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40` literal on every link is the same string duplicated ~20 times.
- **Impact**: High drift risk and maintenance cost across the whole marketing surface; inconsistent nav between pages is a visible UX defect.
- **Verification**: `grep "function SiteHeader|function SiteFooter"` over src returns 5 files each with both (page, billing, faq, qualify, validation); landing-claude inlines its own header/footer. Confirmed the nav link sets differ between page.tsx, faq, and billing by reading each.
- **Fix sketch**: Extract `src/components/SiteHeader.tsx` and `SiteFooter.tsx` (props for active route / footer caption), and a `focusRing` class constant or `cn()` helper. Replace the 5 local copies + landing-claude's inline chrome.

## 3. landing-claude duplicates homepage hero/process/value-prop content
- **Severity**: medium
- **Category**: duplication
- **File**: src/app/landing-claude/page.tsx:40-165
- **Scenario**: landing-claude IS reachable (linked from page.tsx:410 "Alt. masthead", listed in README.md:182, kept public in middleware.ts:7) — it is NOT dead. But it restates the homepage's hero pitch ("a firm bills $8,000–$15,000…drafted by AI…signed by a licensed immigration attorney"), the identical 4-step process (Qualify/Assemble/Sign/File, page.tsx:247-252), and the same value props (flat fee / 21 days / attorney of record, page.tsx:206-223). The copy is paraphrased, not shared.
- **Root cause**: An intentional alternate-masthead A/B variant that was built by copy-paste rather than composing shared section components. Both files independently hardcode the same marketing facts, so they drift (and #1 shows they already have — both carry the stale flat-fee claim).
- **Impact**: Two places to update every marketing fact; correctness risk (pricing already diverged). Moderate because the page is intentional and live, so this is dup-to-consolidate, not delete.
- **Verification**: `grep landing-claude` over the repo shows the only in-app link is page.tsx:410, plus README/CHANGELOG/middleware mentions — reachable, intentional. The 404 in `.vibeman-restart.log` is from the *vibeman* project (cwd), not this repo. Section-by-section read confirms the overlap.
- **Fix sketch**: Extract the shared marketing data (process steps, value props, hero copy) into a small module or shared section components consumed by both `page.tsx` and `landing-claude`, so the two layouts diverge only in chrome, not in facts.

## 4. Homepage links route through the retired /pricing redirect hop
- **Severity**: low
- **Category**: cleanup
- **File**: src/app/page.tsx:304,408
- **Scenario**: The homepage "full schedule of fees →" link (304) and footer "Pricing" link (408) point at `/pricing`, which is now only `redirect("/billing")`. faq/page.tsx (127,150) does the same. Each click is an unnecessary server redirect hop to reach the real ledger at `/billing`.
- **Root cause**: `/pricing` was deliberately kept as a permanent redirect so old links don't break (pricing/page.tsx comment), but the in-repo links were never repointed at the canonical `/billing` — the faq CTA at faq/page.tsx:102 already links straight to `/billing`, showing the intended target.
- **Impact**: Cosmetic — extra redirect latency and a confusing internal link target; not user-visible breakage.
- **Verification**: Read pricing/page.tsx (pure `redirect("/billing")`), and confirmed faq/page.tsx:102 links directly to `/billing` while its header/footer still use `/pricing` — internal inconsistency.
- **Fix sketch**: Repoint in-repo `/pricing` links to `/billing` (page.tsx:304,408; faq header/footer). Keep the `/pricing` redirect route itself for external inbound links.
