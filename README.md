# xprize-immigration-paperwork · Meridian

> AI-drafted, attorney-signed O-1 visa petitions at one-third the cost.

XPrize hackathon entry · 90-day MVP scaffold · built with Gemini on Google Cloud.

---

## Overview

A US O-1 visa is gated by paperwork that costs $8,000–$15,000 in attorney fees. The work is highly templated. **Meridian** lets Gemini do every templated step — qualification, evidence gathering, petition drafting, exhibit indexing — while a licensed immigration attorney provides the legal judgment, signature, and USCIS filing. One flat fee: $2,500.

- **Customer:** O-1A applicants in tech — founders, engineers, researchers
- **Wedge:** dominate O-1A first, then O-1B, EB-1A, H-1B
- **Pricing:** $2,500 O-1A flat (vs. $8–12K market) · USCIS fees passed through at cost
- **Trial:** free qualification check; first revision free

> **Legal:** the product is operated by a licensed attorney's firm; the app is licensed software to that firm. Unauthorized practice of law (UPL) is the central risk — see [`docs/CHECKLIST.md`](docs/CHECKLIST.md).

## What's in this repo

A Next.js 14 application scaffold with a finalized design direction:

- **Design system** — semantic CSS-variable tokens, a shared UI primitive kit, feature-module architecture
- **Three routes** — a marketing landing, a brand landing, and the working product dashboard
- **`/docs`** — the 12-week build backlog and pre-launch + compliance checklist

The dashboard, data and integrations are mocked — this is the design-and-architecture foundation a 12-week build starts from.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing page |
| `/landing-claude` | Brand landing — "The petition" (official-document concept) |
| `/dashboard` | The product — **Case file**: O-1A criteria audit, tasks, petition draft, with a light/dark theme toggle |

## Tech stack

- **Framework:** Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS
- **AI:** Google Gemini 1.5 Pro (long-context petition drafting) · Document AI (evidence parsing)
- **Integrations:** Vapi / Retell (voice intake) · DocuSign (attorney sign-off) · Stripe (milestone billing)
- **Cloud:** Google Cloud Run · Firestore · Cloud Storage (CMEK-encrypted evidence vault)
- **Tooling:** ESLint 9 flat config · `tsc` strict typecheck

## Getting started

**Prerequisites:** Node.js ≥ 20, npm.

```bash
npm install
cp .env.example .env.local   # fill in API keys (none required to run the UI)
npm run dev                  # http://localhost:3000
```

## Scripts

| Script | Action |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Project structure

```
src/
├── app/                  # Next.js routes (/, /landing-claude, /dashboard)
├── components/           # App shell + shared UI kit (components/ui)
├── features/
│   ├── case-file/        # The dashboard feature module
│   └── dashboard/        # ThemeScope + light/dark themes + DashboardView
└── lib/                  # cn(), formatters
docs/                     # BACKLOG.md, CHECKLIST.md
```

## Design system

Semantic design tokens (`bg-surface`, `text-accent`, …) as CSS variables in `src/app/globals.css`. The dashboard ships a light and a dark theme — `ThemeScope` swaps the token set at runtime, so the whole surface re-themes from one object.

## Documentation

- [`docs/BACKLOG.md`](docs/BACKLOG.md) — 12-week hackathon build plan
- [`docs/CHECKLIST.md`](docs/CHECKLIST.md) — pre-launch checklist with UPL / compliance gates

## Deployment

Designed for **Google Cloud Run** with Firestore and CMEK-encrypted Cloud Storage for the evidence vault.

## License

Private — XPrize hackathon entry. All rights reserved.
