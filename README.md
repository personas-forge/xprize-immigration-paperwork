# Immigration Concierge — Atelier of Arrival

> AI-drafted, attorney-signed O-1 visa petitions at one-third the cost.

A Next.js 16 app and design scaffold for an immigration concierge: Gemini drafts
the templated parts of an O-1 petition (qualification, evidence indexing,
petition letter, I-129), a licensed U.S. immigration attorney reviews and signs
it, and the petition goes to USCIS — for $2,500 flat instead of the $8K–$15K a
firm normally charges. Hackathon-stage scaffold: the UI, brand system, and case
file are real; AI, billing, and filing integrations are mocked.

> **Legal:** This application is licensed software operated by a licensed
> attorney's firm. It is **not legal advice** and **not a DIY filing tool**.
> Every petition is reviewed and signed by a U.S. immigration attorney who is
> on record with USCIS. Unauthorized practice of law (UPL) is the central
> compliance risk — see [`docs/CHECKLIST.md`](docs/CHECKLIST.md). No USCIS
> endorsement is claimed or implied.

---

## Features

- **Petition stepper demo** on the landing page — five stages (Intake →
  Drafting → Attorney Review → Filed → Approved), each a circular guilloché
  rosette. The active stage receives a gold-leaf rubber stamp that animates in
  via Motion's `stampIn` variant; reduced-motion is respected.
- **Engraved-document marketing site** — hero with a watermarked I-129
  certificate vignette, three-promise strip, four-step process band, schedule
  of fees, closing seal.
- **O-1A qualification screener (`/qualify`)** — paste your background once and
  the engine scores it against every live programme (O-1A, O-1B, EB-1A); the
  page leads with a "Find my best path" visa comparison UI, then a single-visa
  screener; after a positive result a "§ What happens next" panel lists the
  three ordered steps (Create account → Upload evidence → Attorney reviews) and
  a "Get started →" CTA that links to `/login`.
- **Working case file dashboard** — O-1A criteria audit table, evidence list,
  task panel, petition draft preview, all themable. Empty-state shows a
  **'Start your case'** callout that routes new users straight to the
  qualification flow.
- **O-1A criteria primer tooltips** — each of the eight criterion labels in
  `CriteriaTable` shows a `?` icon button that opens an accessible inline
  popover (`role="dialog"`, `aria-modal`, focus-managed) with a plain-English
  definition and a concrete evidence example. Static data lives in
  `criteria-primers.ts`; `CriterionPrimerButton` manages open/close (Escape /
  outside-click). Helpful for first-time users who don't yet know what
  "Critical role" or "Judging" means.
- **First-visit token economy explainer** — on first dashboard load, an inline
  banner above the top bar shows the user's current token balance and the cost
  of a full petition draft (~12 tokens). Dismissed state persists in
  `localStorage` (key `atelier-token-banner-dismissed`) via
  `useSyncExternalStore`; the banner does not mount in demo/bypass mode
  (`balance === null`).
- **Buy tokens through Polar — one-off bundles or a monthly subscription** —
  the `/billing` page (`BundleGrid`) sells four one-off token bundles (Starter
  $5 / 500 · Builder $15 / 2,000 · Pro $48 / 8,000 · Scale $150 / 30,000) and,
  new in 0.10.0, a recurring **Monthly** plan ($19/mo for a 2,500-token
  allowance that renews each billing cycle). Checkout runs through Polar's
  hosted flow (`/api/checkout`) and `/api/polar/webhook` credits the buyer's
  balance on `order.paid` — including each subscription renewal (every cycle is
  a fresh, de-duped order id). All purchase paths are gated on
  `isPolarConfigured()`, so the UI degrades gracefully when Polar credentials
  are absent (or when `TOKENS_BYPASS=1` runs the AI unmetered in dev).
- **Qualification flow + Next Steps panel** — paste a CV/bio to get an
  informational O-1A eligibility screening; after a passing result, a
  structured **Next Steps** card (Create account → Upload evidence → Attorney
  reviews) with a 'Get started' CTA guides users toward filing.
- **Two-step onboarding with a progress indicator** — the post-screening
  account/consent step at `/welcome` shows a "Step 2 of 2 · Confirm your
  details" indicator and clarified submit-button copy, so users can see where
  they sit in the onboarding sequence before their case file opens.
- **Drafting studio with actionable save-recovery** — when a draft save fails,
  a `role="alert"` banner offers 'Copy draft' (clipboard) and a no-charge
  retry-save, so paid work is never silently lost. Single-section regeneration
  failures are no longer silent either: an inline `role="alert"` notice appears
  on the affected section ("Regeneration failed — your previous text was
  kept"), the existing text is preserved, and the alert clears on the next
  regeneration attempt or an inline edit.
- **Field-guidance panel survives a failed form-list fetch** — if loading the
  USCIS form catalog fails (API or network error), the panel shows a
  `role="alert"` notice with a **Retry** button instead of an endless loading
  skeleton; retrying re-runs the fetch in place.
- **Per-panel error boundaries on the case dashboard** — a throw inside any
  single dashboard panel (CriteriaTable, TasksCard, PetitionDraftCard,
  EvidenceVault) renders an inline "Could not load — retry" card rather than
  crashing the whole dashboard. Each panel is independently recoverable.
- **Parchment ↔ ink theme toggle** — a sun/moon button in the header swaps the
  whole site between a daylight parchment desk and an after-hours notary's
  office. Choice persists in `localStorage`; a pre-paint inline script prevents
  FOUC; hydration-safe via `useSyncExternalStore` + `suppressHydrationWarning`.
- **Pricing and FAQ pages** — three tiers as document bands; eight FAQ entries
  styled as petition records (USCIS form compatibility, RFE handling, refund
  policy, data security, etc.).
- **PWA-ready** — full icon set, web app manifest, OG card, themed status bar.
- **Accessibility** — skip-to-content link, focus-visible rings, `aria-current`
  on the stepper, reduced-motion across every animation.
- **Instant Verdict screener on the landing hero** — an anonymous
  screening widget (`InstantVerdict`) sits above the petition stepper on the
  marketing landing page; results pre-fill the full qualification form via a
  keyless handoff route (`/api/qualify/preview`), providing a zero-friction
  top-of-funnel entry point.
- **Shareable Letters Patent certificate (`/c/[token]`)** — a passing screening
  result can be minted into a public "Letters Patent of Extraordinary Ability"
  page; the snapshot is encoded in an unguessable URL token (no database
  required) and a per-result 1200×630 Open Graph card (`/c/[token]/opengraph-image`)
  unfurls on LinkedIn/X.
- **Exhibit-cited petitions — evidence vault wired into drafting** — draft
  prompts are exhibit-aware; the evidence vault is wired into the draft API
  route; an Exhibit Index with a citation-integrity meter appears in
  DraftStudio; and the full Exhibit Index is appended to the packet export.
- **Live adjudication-risk engine + per-document compliance-risk badges** — a
  live adjudication-risk LLM gate runs in the AI orchestrator (single-sourced
  with the eval harness); each evidence document in the vault now shows a
  per-document compliance-risk badge.
- **Adjudicator critique/redline in DraftStudio** — `/api/draft/critique`
  scores and redlines each petition section from an adjudicator's perspective;
  DraftStudio surfaces score chips, redline cards, and an Apply button to fold
  the suggested edits back in.
- **RFE Risk Radar forecast + one-click Reinforce** — a Risk Radar panel in
  DraftStudio forecasts RFE likelihood per section (`/api/rfe/forecast`) and
  offers one-click Reinforce to tighten the weakest points.
- **Exhibit-bound RFE responses** — RFE section responses are now exhibit-bound
  via the same vault integration as draft; the Exhibit Index is shared across
  the draft and RFE flows.
- **Queue-age badges and staleness warnings on the attorney review queue
  (`/dashboard/review`)** — each petition card shows elapsed time since draft
  submission as a colored badge: green (fresh, < 12 h), amber (warning, 12–24 h),
  red (overdue, > 24 h). The queue is sorted oldest-first so overdue cases rise
  to the top; badges refresh every 60 seconds. Gated by `isConfiguredAttorney`
  (`ATTORNEY_EMAILS` env var) — non-attorneys see an empty queue.

## Tech stack

- **Framework:** Next.js 16 (App Router) · React 19 · TypeScript 6 (strict)
- **Styling:** Tailwind CSS 4 (`@tailwindcss/postcss` pipeline) · semantic CSS
  variables in `src/app/globals.css`
- **Motion:** Framer Motion 12 with a single shared easing curve (`easeArrival`)
  and reusable `fadeUp`, `staggerParent`, `stampIn` variants
- **AI (planned wiring):** `@google/generative-ai` 0.24 — Gemini 1.5 Pro for
  long-context petition drafting and Document AI for evidence parsing
- **Tooling:** ESLint 10 flat config · `tsc --noEmit` strict typecheck · `tsx`
  + Node's built-in test runner

## Visual identity — Atelier of Arrival

A well-made paper petition on a clean desk. Engraved, calm, slightly old-world
— the visual answer to a category usually drawn in startup gradients.

- **Palette:** parchment `#f3ead6`, midnight ink `#0d1f2d`, gold-leaf `#b8893a`,
  bordeaux `#7d2a2e` (the wax-seal accent).
- **Type:** **Fraunces** (display, opsz/SOFT/WONK axes for an engraved feel),
  **Newsreader** (body — a literary text serif for long-form calm), **IBM Plex
  Mono** (case numbers, microprint, exhibit IDs).
- **Signature motifs:**
  - Inline-SVG **guilloché rosettes** — the parametric Lissajous security
    pattern used on banknotes and passports, drawn at runtime by
    `components/brand/Guilloche.tsx`, watermarked into page corners, hero
    vignettes, and each stage of the petition stepper.
  - **Perforated tear-here rules** between sections (`.perforation` utility).
  - **Tilted rubber-stamp ornaments** ("Approved", "Bar-licensed", "Most
    chosen") via `<Stamp>`, with slight rotations to feel hand-pressed.
  - **Monogram seal with rim tick-marks** via `<Seal>` for mastheads and
    closing flourishes.
  - **Chapter marks** — Roman numerals + a hairline rule, used to open each
    page section like a printed broadsheet.

## Theme

Two skins of the same identity:

- **Parchment** (default) — daylight desk.
- **Ink** — after-hours notary's office.

How it works: a sun/moon button in the header toggles
`document.documentElement.dataset.theme` between `""` and `"ink"`. CSS in
`globals.css` re-skins the entire token set under `[data-theme="ink"]`. The
choice is persisted to `localStorage.atelier-theme`. A pre-paint inline script
in `app/layout.tsx` applies the saved choice **before first paint** to prevent
FOUC. The toggle component subscribes to a custom `atelier-theme` event via
`useSyncExternalStore` so multiple toggles stay in sync; `<html>` carries
`suppressHydrationWarning` to keep SSR clean.

The dashboard additionally ships its own `ThemeScope` (parchment + an ink-style
variant in `features/dashboard/themes.ts`) that swaps the token set at the
component scope.

## Getting started

**Prerequisites:** Node.js ≥ 20, npm.

```bash
npm install
cp .env.example .env.local   # nothing required to run the UI
npm run dev                  # http://localhost:3000
```

After upgrading from 0.1.x: `rm -rf node_modules && npm install` — see
[`CHANGELOG.md`](CHANGELOG.md) for the 0.2.0 platform migration notes
(Next 14 → 16, React 18 → 19, Tailwind 3 → 4, TS 5 → 6, ESLint 9 → 10).

## Scripts

| Script | Action |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint flat config |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run test` | `tsx --test "src/**/*.test.ts"` (Node test runner) |

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing — hero, petition stepper demo, promises, process, pricing, closing seal |
| `/pricing` | Schedule of fees — three petition tiers as perforated document bands |
| `/faq` | Eight petition-styled FAQ entries (form compatibility, RFE, refunds, security) |
| `/landing-claude` | Alternate masthead — narrow editorial column, printed-pamphlet treatment |
| `/qualify` | Multi-visa qualification funnel — "Find my best path" comparison UI (O-1A / O-1B / EB-1A) followed by the single-visa screener; "What happens next" panel with a "Get started →" CTA once a positive result is returned. |
| `/c/[token]` | Shareable "Letters Patent of Extraordinary Ability" — engraved certificate minted from a screening result encoded in the URL token (no DB); per-result Open Graph card at `/c/[token]/opengraph-image`. |
| `/dashboard` | The case file — O-1A criteria audit with compliance-risk badges, DraftStudio with adjudicator redline + RFE Risk Radar, tasks, petition draft preview. Empty-state CTA links to `/qualify` when no cases exist. |
| `/billing` | Token store — four one-off Polar bundles plus the recurring monthly subscription (`BundleGrid` → `/api/checkout`). |
| `/welcome` | Post-screening account/consent step — "Step 2 of 2" onboarding progress indicator before the case file opens. |
| `/dashboard/review` | Attorney review queue — all cases awaiting sign-off, sorted oldest-first with queue-age badges (fresh / warning / overdue); gated by `ATTORNEY_EMAILS`. |

## Data access — the Adapter layer

API routes and server actions never call the persistence `Store` (or the
`src/lib/data/*` function wrappers) directly. They go through a thin **adapter
layer** at `src/lib/data/adapters/` (ADR-0010) that owns three contracts the raw
function layer does not:

- **One fail-closed access gate.** The owner-or-attorney check
  (`resolveCase`) is implemented once, so the security-sensitive
  `isConfiguredAttorney` fallback can't be forgotten or copy-pasted out of sync
  at a call site.
- **Uniform results, never throws.** Every method returns a discriminated
  `AdapterResult<T>` — `{ ok: true, value }` or `{ ok: false, error }` — with a
  typed `AdapterError` kind (`unconfigured` / `forbidden` / `not_found` /
  `store_error`). A `Store` throw is caught and surfaced as `store_error`; an
  unconfigured backend surfaces as `unconfigured` instead of collapsing into a
  bare `null`.
- **Pure HTTP shaping.** `adapters/http.ts` maps an `AdapterError` to a
  `NextResponse` (`unconfigured→503`, `forbidden→403`, `not_found→404`,
  `store_error→500`) without ever leaking the underlying `cause`. Server actions
  skip this and consume the `AdapterResult` union directly (they redirect, not
  respond).

Two adapters expose the domain as singletons — `petitions` (`PetitionAdapter`:
case resolution, criteria, draft/RFE persistence) and `evidence`
(`EvidenceAdapter`: evidence-vault documents). Adapters stay
framework-agnostic (no `next/server` import) so they're unit-testable under
`node:test`. Routes and actions are migrated onto the layer incrementally; see
ADR-0010 and the [`CHANGELOG.md`](CHANGELOG.md) `0.5.x` entries for adoption
status.

## Project structure

```
src/
├── app/
│   ├── layout.tsx           # Fraunces/Newsreader/Plex Mono, metadata, pre-paint theme script
│   ├── globals.css          # design tokens, [data-theme="ink"], utilities
│   ├── page.tsx             # marketing landing
│   ├── pricing/page.tsx
│   ├── faq/page.tsx
│   ├── landing-claude/page.tsx
│   └── dashboard/page.tsx
├── components/
│   ├── brand/               # Guilloche, Seal, Stamp, ChapterMark, Wordmark, PageFrame
│   ├── ui/                  # Badge, Button, Card, SectionHeader, StatCard, PanelErrorBoundary
│   ├── Motion.tsx           # Rise / Stagger / HoverCard wrappers
│   ├── PetitionStepper.tsx  # 5-stage rosette stepper with stamp-in animation
│   ├── FaqEntry.tsx         # client-only <details> animator
│   ├── DashboardTopBar.tsx
│   └── ThemeToggle.tsx      # parchment ↔ ink toggle + themeInitScript
├── features/
│   ├── case-file/           # criteria.ts, summarizeCriteria + tests, types, data, components/
│   └── dashboard/           # DashboardView, ThemeScope, themes.ts
└── lib/
    ├── cn.ts                # classname joiner
    ├── format.ts            # number/date formatters
    ├── motion.ts            # easeArrival, fadeUp, staggerParent, stampIn
    └── data/adapters/       # PetitionAdapter / EvidenceAdapter — route↔Store seam (ADR-0010)
docs/
├── BACKLOG.md               # 12-week hackathon build plan
├── CHECKLIST.md             # pre-launch + UPL/compliance gates
├── backlog-brainstorm.{md,json}
└── adr/                     # architectural decision records
public/
├── brand/                   # logo.png, hero-bg.png
├── icons/                   # 16/32/48/96/192/512 + apple-touch-icon
├── manifest.webmanifest
└── og.png
```

## Brand assets

| Path | Purpose |
| --- | --- |
| `public/brand/logo.png` | Header monogram (28×28 in the masthead) |
| `public/brand/hero-bg.png` | Watermark image behind the hero, low-opacity, mix-blend-multiply |
| `public/og.png` | 1200×630 OpenGraph / Twitter share card |
| `public/icons/icon-{16,32,48,96,192,512}.png` | Favicons + maskable PWA icons |
| `public/icons/apple-touch-icon.png` | 180×180 iOS home-screen icon |
| `public/manifest.webmanifest` | PWA manifest — parchment background, ink theme color |

## Accessibility

- Skip-to-content link visible on focus (`<a href="#main">` in `layout.tsx`).
- Focus-visible rings on every interactive element, tinted with `--accent`.
- The petition stepper marks the active stage with `aria-current="step"` and
  exposes per-stage jump buttons labelled `"Jump to stage N: {name}"`.
- All decorative SVG (guilloché, perforations, stamps) is `aria-hidden`.
- Animations gate on `useReducedMotion()` and respect `prefers-reduced-motion`;
  the dashboard top bar's backdrop-blur is likewise gated behind Tailwind's
  `motion-safe:` variant.
- Text/surface token pairs in both dashboard themes meet WCAG AA contrast,
  enforced by an automated audit (`features/dashboard/themes.contrast.test.ts`)
  that runs with `npm test`.
- Data-loss warnings (e.g. draft save failure) use `role="alert"` so screen
  readers announce them immediately without requiring user focus (WCAG 4.1.3).
- `<html lang="en">` with `suppressHydrationWarning` for the theme attribute.

## Environment variables

Copy `.env.example` → `.env.local`. None are required to render the UI; all
integration code is currently stubbed.

| Group | Vars |
| --- | --- |
| Gemini / Vertex AI | `GEMINI_API_KEY`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`, `GEMINI_MODEL` |
| Document AI | `DOCAI_PROCESSOR_ID`, `DOCAI_LOCATION` |
| Voice intake | `VAPI_API_KEY`, `RETELL_API_KEY` |
| Billing (Polar token economy) | `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER`, `POLAR_PRODUCT_{STARTER,BUILDER,PRO,SCALE,MONTHLY}`, `TOKENS_BYPASS` (dev-only paywall bypass) |
| E-sign | `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID` |
| App | `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ATTORNEY_FIRM_NAME`, `NEXT_PUBLIC_ATTORNEY_BAR_STATE` |
| Deploy (optional) | `NEXT_PUBLIC_SITE_URL`, `VERCEL_URL` (used to resolve `metadataBase` for OG cards) |

## Testing

```bash
npm run test         # tsx + Node's built-in test runner
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # ESLint flat config
```

The first unit tests cover `features/case-file/criteria.ts`
(`summarizeCriteria`, which aggregates O-1A status rows against a qualifying
threshold of 3). A CI contrast audit
(`features/dashboard/themes.contrast.test.ts`) checks every text token against
every opaque surface token in both dashboard themes for WCAG AA, so contrast
regressions fail `npm test`. Add new tests as `*.test.ts` alongside the module
they cover.

## Building & deployment

```bash
npm run build && npm run start
```

The app is designed for **Google Cloud Run** with Firestore and CMEK-encrypted
Cloud Storage for the evidence vault. It also runs unmodified on Vercel —
`VERCEL_URL` is honored when resolving `metadataBase` for OG share cards. Set
`NEXT_PUBLIC_SITE_URL` to your canonical origin in production.

## Documentation

- [`CHANGELOG.md`](CHANGELOG.md) — Keep-a-Changelog format, SemVer (pre-1.0)
- [`docs/BACKLOG.md`](docs/BACKLOG.md) — 12-week build plan
- [`docs/CHECKLIST.md`](docs/CHECKLIST.md) — pre-launch + UPL/compliance gates
- [`docs/adr/`](docs/adr) — architectural decision records

## License

Private — XPrize hackathon entry. All rights reserved.
