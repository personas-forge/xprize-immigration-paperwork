> Total: 5 | Critical: 0 | High: 2 | Medium: 2 | Low: 1
> Context: Marketing Site
> Lens mix: bug-hunter 1, ui-perfectionist 4

## 1. `landing-claude` CTAs have no focus-visible ring — keyboard users get no focus indicator
- **Severity**: High
- **Lens**: ui-perfectionist
- **Category**: Accessibility — keyboard focus state
- **File**: src/app/landing-claude/page.tsx:69-80, 187-192
- **Scenario**: A keyboard or switch-control user Tabs through the alt landing page. The hero CTAs ("Take the free qualification", "See the case file") and the closing CTA ("Begin qualification") receive focus but show **no visible focus indicator** — they style only `hover:` (`hover:bg-foreground-soft`, `hover:border-foreground`, `hover:bg-[color:var(--accent-dark)]`). The browser default outline is also suppressed elsewhere via the global token styles, so focus is effectively invisible.
- **Root cause**: Every other marketing surface attaches `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40` to its CTAs (see page.tsx:66/168/403, faq/page.tsx:106/112, PetitionStepper.tsx:56). `landing-claude` is the one page that was authored without that pattern — it predates the focus-ring convention and was never retrofitted.
- **Impact**: WCAG 2.4.7 (Focus Visible) failure on a live, footer-linked, publicly-routable page. Keyboard users cannot tell which CTA is focused, so they cannot confidently activate the primary conversion action.
- **Fix sketch**: Append the shared focus-ring utility string to all three `<Link>` CTAs (and the masthead "View a live case" link). Better: extract the CTA into a shared `<CtaLink variant="solid|outline|seal">` so the focus ring can't be omitted per-page again.

## 2. Manifest description contradicts the live pricing model ("$2,500 flat")
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: Content correctness / install-metadata drift
- **File**: public/manifest.webmanifest:4
- **Scenario**: A user installs the PWA / adds to home screen, or a crawler reads the manifest. The `description` reads *"AI-drafted, attorney-signed O-1 petitions. **$2,500 flat for a filing-ready packet.**"* — but every page in the app now states the model is **prepaid tokens, no flat fee, no retainers** (page.tsx:24/247/342, faq/page.tsx:39, layout.tsx:38). The manifest also claims "attorney-signed" while the positioning invariant is explicitly "your OWN attorney of record" (we don't supply one).
- **Root cause**: The manifest was written against a retired pricing model (the same one `/pricing` now `redirect()`s away from) and was never updated when the token economy replaced flat-fee pricing. It's the one metadata surface not single-sourced from `economy.ts` / `@/lib/site`.
- **Impact**: A concrete, false price ($2,500) and a misleading "attorney-signed" claim shipped in install metadata and OG-adjacent surfaces — a compliance/trust problem on a legal-services product, and it contradicts the carefully-worded disclaimers everywhere else.
- **Fix sketch**: Rewrite `description` to match `siteDescription` in layout.tsx (token-metered, start free, "work product for your attorney of record … never legal advice"). Remove the dollar figure. Consider asserting this string in a test so it can't drift again.

## 3. Two divergent copies of `SiteHeader`/`SiteFooter` — drifted nav, logo, and focus states
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: Component duplication / visual inconsistency
- **File**: src/app/page.tsx:46-76, 421-438 vs src/app/faq/page.tsx:127-165
- **Scenario**: Navigating `/` → `/faq` → `/landing-claude`, the chrome silently changes. The home header renders a **logo `<Image>` + Wordmark + "Free qualification" pill + ThemeToggle**; the FAQ header renders **Wordmark only (no logo), different nav links, no pill**; `landing-claude` has a third, minimal masthead with no ThemeToggle at all. Footers diverge too (home links "Alt. masthead", FAQ does not; copyright strings differ).
- **Root cause**: `SiteHeader`/`SiteFooter` are re-declared as local functions in each page file rather than imported from one shared module. The FAQ file even comments "local copy; matches /pricing" — but it has already drifted from `/`.
- **Impact**: Inconsistent global navigation and branding across the marketing funnel; the logo and theme toggle appear/disappear between pages; every fix (e.g. the focus rings in finding #1, or a nav link change) must be made in 3 places and inevitably drifts.
- **Fix sketch**: Extract `<SiteHeader>` and `<SiteFooter>` into `src/components/marketing/` and import them on all marketing pages. Make `ThemeToggle` and the logo part of the shared header so chrome is identical everywhere.

## 4. `landing-claude` is a live, footer-linked near-duplicate of the homepage (SEO/duplicate-content)
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: Information architecture / SEO
- **File**: src/app/landing-claude/page.tsx:23-215 (linked from src/app/page.tsx:433; public in src/middleware.ts:7)
- **Scenario**: `/landing-claude` is **not** an orphan — it's allow-listed as public in middleware and linked from the homepage footer as "Alt. masthead" and from its own footer. It reproduces the entire homepage value prop (same hero headline pattern, same 4-step process copy almost verbatim, same "$8,000–$15,000" framing, same closing CTA) on a second indexable URL with the same `<h1>` intent.
- **Root cause**: An internal A/B / alternate-masthead experiment was shipped as a real route and then wired into the production footer, so an internal variant is exposed to users and crawlers as a parallel landing page with no `rel=canonical` back to `/`.
- **Impact**: Two near-identical pages compete for the same keywords (duplicate-content dilution), and end users can stumble onto an inconsistent second front door (e.g. it lacks the InstantVerdict island, the PetitionStepper, and — per finding #1 — focus rings). The "Alt. masthead" footer link leaks experiment plumbing into the public UI.
- **Fix sketch**: Decide the page's status. If it's a kept variant, add `export const metadata` with `alternates: { canonical: "/" }` (or `robots: { index: false }`) and remove the "Alt. masthead" link from the public footer. If it's dead, delete the route. Either way, stop linking an internal variant from production chrome.

## 5. Process steps use ARIA list roles on `<div>`s while the rest of the site uses semantic `<ol>`
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: Semantics / a11y consistency
- **File**: src/app/page.tsx:299-321
- **Scenario**: The homepage "How the petition is built" grid is a `<Stagger>` (a `<div>`) given `role="list"`, with each `<Rise>` (also a `<div>`) given `role="listitem"`. Meanwhile the equivalent process list on `landing-claude` (page.tsx:124) and the FAQ list use real `<ol>`/`<li>`, and the PetitionStepper uses a real `<ol>`. So the same "ordered procession of steps" pattern is expressed three different ways.
- **Root cause**: `Stagger`/`Rise` are motion wrappers that render `<div>`, so the author bolted on ARIA roles instead of rendering semantic list elements — a workaround that only re-creates what `<ol><li>` gives for free, and that AT exposes less reliably (a CSS `display` on the flex/grid container can strip the implicit list role in some engines).
- **Impact**: Minor inconsistency in how steps are announced to screen readers across otherwise-identical content; fragile relative to the genuinely semantic siblings.
- **Fix sketch**: Give `Stagger`/`Rise` an `as` prop (or a `<Stagger as="ol">` variant) so the process grid renders `<ol><li>` like the other step lists, and drop the manual `role="list"`/`role="listitem"`.
