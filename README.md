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
- **Working case file dashboard** — O-1A criteria audit table, evidence list,
  task panel, petition draft preview, all themable. Empty-state shows a
  **'Start your case'** callout that routes new users straight to the
  qualification flow.
- **First-visit token economy explainer** — on first dashboard load, an inline
  banner above the top bar shows the user's current token balance and the cost
  of a full petition draft (~12 tokens). Dismissed state persists in
  `localStorage` (key `atelier-token-banner-dismissed`) via
  `useSyncExternalStore`; the banner does not mount in demo/bypass mode
  (`balance === null`).
- **Qualification flow + Next Steps panel** — paste a CV/bio to get an
  informational O-1A eligibility screening; after a passing result, a
  structured **Next Steps** card (Create account → Upload evidence → Attorney
  reviews) with a 'Get started' CTA guides users toward filing.
- **Drafting studio with actionable save-recovery** — when a draft save fails,
  a `role="alert"` banner offers 'Copy draft' (clipboard) and a no-charge
  retry-save, so paid work is never silently lost.
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
| `/qualify` | O-1A eligibility screening — paste a CV/bio, get criteria assessment + Next Steps panel |
| `/dashboard` | The case file — O-1A criteria audit, tasks, petition draft preview |

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
    └── motion.ts            # easeArrival, fadeUp, staggerParent, stampIn
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
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` |
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
