# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While pre-1.0 (`0.x`), breaking changes increment the **minor** version.

## [Unreleased]

### Added

- **Token economy & Polar paywall (Library Procedure 2).** Replaces the
  subscription/fee-schedule pricing with a prepaid token economy on the existing
  `app_immigration` ledger (no DDL). New accounts receive a one-time
  `FREE_SIGNUP_GRANT` (granted in `welcome/actions.ts` after consent). The
  `/api/guidance` AI route now debits **one token** per answer up front
  (`OPERATIONS = { guidance: "light" }`, charge-then-reclaim: the token is
  refunded if the model call throws); insufficient balance returns **HTTP 402**
  and unauthenticated **401**. The not-legal-advice / attorney-of-record
  disclaimer is preserved on every path, including the 402 body and the in-panel
  paywall. A re-skinned `/billing` page shows the balance, four token bundles
  (Buy → `/api/checkout` → Polar), and a contact-only Enterprise band; the old
  `/pricing` route now redirects to `/billing` (no dead subscription copy). A
  header balance pill (both parchment and ink themes; `∞` on dev bypass /
  unconfigured) links to `/billing`, and the guidance panel surfaces an
  "Out of tokens — buy more" CTA on a 402. New server-only modules
  `lib/tokens/{economy,ledger,guard}.ts` and `lib/polar/client.ts`, plus
  `/api/checkout`, `/api/polar/webhook`, and a gated dev-only
  `/api/dev/grant-tokens`. Everything degrades gracefully: with no
  `DATABASE_URL`/Polar config (or `TOKENS_BYPASS=1`) the guard free-passes so
  keyless builds and the AI mock fallback keep working unmetered. Added
  `@polar-sh/sdk`; Polar/`TOKENS_BYPASS` keys added (empty) to `.env.example`.
- **Supabase Google OAuth, content gating & first-auth consent (Library
  Procedure 1).** "Continue with Google" via Supabase Auth (`@supabase/ssr`),
  cookie-based sessions refreshed in `src/middleware.ts`, and a two-layer gate:
  edge middleware checks the session for `PROTECTED_PREFIXES = ["/dashboard"]`
  (marketing pages `/`, `/pricing`, `/faq`, `/landing-claude` stay public),
  while `src/app/dashboard/layout.tsx` enforces onboarding via
  `requireOnboardedUser()`. First sign-in routes to `/welcome`, where the
  re-skinned `ConsentForm` records required Terms + Privacy consent (marketing
  optional) into this app's private `app_immigration` schema over a direct `pg`
  connection. `/login` and the consent form are re-skinned to the Atelier of
  Arrival identity (parchment/ink, gold-leaf, guilloché, perforated rule,
  rubber-stamp) and keep the not-legal-advice / attorney-of-record disclaimer
  visible at sign-up. Everything gates on `isAuthConfigured()`, so the app
  still builds and runs with no secrets. A "Sign in" link was added to the
  marketing header.
- **Data-layer abstraction (`src/lib/data/`).** Typed async accessors
  (`cases.ts`, `forms.ts`, `documents.ts`) form one swappable boundary over the
  mock fixtures; consumers import from `@/lib/data` instead of reaching into
  feature data files. Behavior is identical (mock today, DB/API later).
- **Real Gemini USCIS form-field guidance.** New Node-runtime route
  `src/app/api/guidance/route.ts` returns `{ guidance, disclaimer, source }`.
  With no `GEMINI_API_KEY` it returns deterministic templated guidance (the
  default, secret-free path); with a key it calls `gemini-3-flash-preview` using a
  prompt that mandates general informational guidance only — never legal advice
  — and attorney review. A new **Field guidance** panel on the dashboard wires
  it up with loading/error states. The not-legal-advice / attorney-of-record
  disclaimer renders as a prominent bordeaux stamp on **every** AI output and
  is part of the response contract (`buildGuidanceResponse`).
- **Case portfolio list.** Search + filter (visa classification, case status) +
  sort over the case portfolio, with CSV export, a print-friendly view, and
  empty/loading/error states. Filters persist to `localStorage`.
- **Shared `Skeleton` primitive** and route-level `loading.tsx` / `error.tsx`
  for the dashboard segment.

### Changed

- **Gemini model `gemini-3.5-flash` → `gemini-3-flash-preview`** in the
  `/api/guidance` route and `GEMINI_MODEL` in `.env.example`.
- Case-file dashboard components (`CriteriaTable`, `SidePanels`,
  `CaseFileDashboard`) now read through the data layer with loading skeletons.

### Docs

- Rewrote README to reflect current capabilities and structure.

## [0.2.1] - 2026-05-27

Backward-compatible feature + bug fix. No reinstall or migration required.

### Added

- **`summarizeCriteria()` eligibility helper** (`src/features/case-file/criteria.ts`).
  Aggregates O-1A criteria into `{ total, qualifying, partial, meetsThreshold }`,
  treating `Met`/`Strong` as qualifying against a `QUALIFYING_THRESHOLD` of 3.
  Robust to malformed input (non-array → empty summary; unknown/absent status
  rows are ignored rather than inflating the count). Unit-tested in
  `criteria.test.ts`.

### Fixed

- **Criteria badge no longer hardcodes "1 partial".** `CriteriaTable` previously
  rendered a fixed `1 partial` label and counted "strong" as anything not
  `Partial`; it now derives both `qualifying` and `partial` counts from
  `summarizeCriteria`, so the badge stays accurate as case data changes.

### Changed

- Criteria badge tone is now dynamic: `success` when the qualifying count meets
  the threshold, `warning` otherwise (previously always `success`).

[0.2.1]: #

## [0.2.0] - 2026-05-27

Pre-1.0 platform migration. This release upgrades the core framework and
toolchain across major versions; **anyone running the project locally must
reinstall dependencies** (`rm -rf node_modules && npm install`).

### ⚠️ Breaking

- **Next.js 14 → 16.** Major framework upgrade (App Router). Local dev,
  build, and deploy now require the Next.js 16 runtime.
- **React 18 → 19.** Major React upgrade alongside the framework bump.
- **Tailwind CSS 3 → 4.** Styling now uses the new `@tailwindcss/postcss`
  pipeline; `globals.css` switches to `@import "tailwindcss"`. Custom
  PostCSS/Tailwind setups will need to be migrated.
- **TypeScript 5 → 6** and **ESLint 9 → 10.** Stricter type checking and
  updated lint rules; existing code may surface new diagnostics.

### Changed

- Node.js toolchain types updated (`@types/node` 20 → 25) and React type
  packages bumped to 19.
- `@google/generative-ai` updated 0.21 → 0.24.

[0.2.0]: #
