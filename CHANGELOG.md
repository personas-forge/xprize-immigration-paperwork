# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While pre-1.0 (`0.x`), breaking changes increment the **minor** version.

## [Unreleased]

## [0.4.0] - 2026-06-04

Backward-compatible feature + hardening release. Pre-1.0 **minor** bump for the
work accumulated on `main` since `0.3.1`: a security-hardening pass on the
charged AI routes, the first steps of the AI Operation Orchestrator (ADR-0004)
— its core utility plus the `qualify` and `guidance` routes migrated onto it —
the first pieces of the route-authorization consolidation (ADR-0006): a
composable `authorizeRoute()` helper plus `/api/draft` wired onto it
(owner-only), and a new in-process domain event bus (ADR-0007) that decouples
side-effects from persistence. No data migration required.

> **Heads-up for API clients:** the charged AI routes now return new status
> codes — **401/403** for an unauthorized `caseId` (no more silent fallthrough
> to the demo payload) and **429** when rate-limited. `/api/qualify` is now
> rate-limited too (40 req/min). Clients that call these routes directly must
> handle these responses. Every error body still carries the not-legal-advice
> `DISCLAIMER`.

### Added

- **AI Operation Orchestrator core — `executeAiOperation()` (ADR-0004, task
  1/6).** A reusable `executeAiOperation<TInput, TOutput>()` utility
  (`src/lib/ai/operation.ts`) that encapsulates the shared charged-AI-route
  pipeline — parse → rate-limit → token charge → model call → output guard →
  persist, with token reclaim on failure — as a single declarative spec. Routes
  migrate onto it incrementally to eliminate the ~500 lines of per-route
  boilerplate duplication; fully unit-covered.
- **Composable route-authorization helper — `authorizeRoute()` (ADR-0006, task
  1/4).** A single fail-closed case-access decision
  (`src/lib/auth/authorizeRoute.ts`) shared by the token-charged AI routes:
  `authorizeRoute(request, policy)` takes a `RoutePolicy` (`requiresCase`,
  `requiresAttorney`) and returns a discriminated `Authorized` result —
  `ok` (caller may access the resolved case), `unauthenticated` (→ 401),
  `forbidden` (→ 403) — that each route maps to its response. Its decision logic
  is injected (`AuthzDeps`) so it unit-tests with no DB, cookies, or network;
  fully unit-covered. This consolidates the access-control checks currently
  copy-pasted across the AI routes into one auditable boundary, advancing the
  team's auth-middleware consolidation goal. `/api/draft` is the first route
  wired onto it (task 3/4, see _Changed_); the remaining route migrations land
  in tasks 2 and 4.
- **In-process domain event bus (ADR-0007).** A typed, in-process event bus
  (`src/lib/events/`) that decouples side-effects from persistence. Discriminated
  -union domain events (`CaseStatusChanged`, `DraftGenerated`, `EvidenceUploaded`)
  flow through an `EventBus` (`on` / `onAny` / `publish`) with **per-subscriber
  error isolation** — a failing subscriber can no longer break the DB write or
  its sibling subscribers. The `Store` (the single persistence boundary) is
  wrapped by a `withEvents()` Proxy decorator that publishes an event only
  **after** a successful, non-no-op write (a failed compare-and-set
  `transitionCase` stays silent). Ships three isolated subscribers — audit-log,
  attorney-notify, and analytics. Fully unit-covered. This advances the team
  goal of introducing domain events for case-status transitions; future
  durable-outbox work plugs into the same `Store` seam.

### Security

- **Cross-tenant access control on the AI routes (IDOR fix).** `/api/draft`,
  `/api/rfe`, and `/api/evidence/categorize` now authorize the case a request
  acts on: a supplied `caseId` must resolve to a case the caller owns, otherwise
  the request is denied — **401** when not signed in, **403** when signed in
  without access — instead of silently degrading to the inline demo payload.
  Cross-tenant access on `/api/rfe` and `/api/evidence/categorize` gates on
  `isConfiguredAttorney` (fail-closed when `ATTORNEY_EMAILS` is unset) rather
  than the demo-default `isAttorney`, closing a hole where any signed-in user
  could read another applicant's PII by case id, or file a document (with a real
  exhibit number) into a stranger's case vault.
- **Rate limiting on the charged AI routes.** `/api/draft` and `/api/rfe`
  (20 req/min) and `/api/guidance` and `/api/evidence/categorize` (40 req/min)
  enforce a fixed 60-second window, checked **before** any token charge or model
  call. Over-limit requests get **HTTP 429** with a `Retry-After` header and
  `retryAfterSec` in the body, so a flood can't drain a token balance or run up
  model cost.
- **`/api/qualify` now rate-limited (ADR-0004, task 4/6).** Adds a
  `RATE_LIMITS.qualify = 40` (req/min) bucket, closing the gap where `qualify`
  was the **only** token-charged AI route with no per-user frequency cap — an
  authenticated caller could loop the medium-cost screening to drain their own
  balance and run up real model cost. It now matches `/api/draft`, `/api/rfe`,
  `/api/guidance`, and `/api/evidence/categorize`.

### Changed

- **`/api/draft` migrated onto `authorizeRoute` — owner-only (ADR-0006, task
  3/4).** The draft-generation route now delegates its case-access decision to
  `authorizeRoute({ requiresCase: true })`, replacing ~30 lines of hand-rolled
  auth + case-lookup boilerplate. `requiresAttorney` is intentionally **omitted**
  — a draft is the owner's work product, so the configured-attorney cross-tenant
  fallback honored by `/api/rfe` is **not** granted here; access is owner-only.
  The 401/403 decision is resolved up front (before any rate-limit, token
  charge, or model call), preserving fail-closed behaviour with no change to the
  external contract. First route wired onto the ADR-0006 helper.
- **`/api/qualify` migrated onto `executeAiOperation` (ADR-0004, task 4/6).**
  The route is now a declarative spec on the orchestrator, replacing ~88 lines
  of hand-rolled parse → rate-limit → charge → model → guard → persist
  boilerplate with no change to its external contract (besides the new 429).
- **`/api/guidance` migrated onto `executeAiOperation` (ADR-0004, task 3/6).**
  The third route folded onto the orchestrator, replacing ~70 lines of
  hand-rolled parse → rate-limit → charge → model → guard → respond boilerplate
  with a declarative spec. Behaviour is preserved with one consistency fix: when
  the engine returns blank text, the route now reclaims the charge and labels the
  templated fallback `source: "mock"` (the orchestrator's honest-mock invariant)
  instead of billing a fallback stamped with the engine name — matching every
  other migrated AI route.
- **AI route responses report the persistence outcome.** `/api/draft` and
  `/api/rfe` responses now include `saveFailed` (and `version`): when the user
  has already paid but storing the work product fails, the failure is surfaced
  to the client instead of being silently swallowed — the saved version is the
  draft the attorney of record reviews and signs.

### Fixed

- **Token refunded on unusable model output.** Previously a token was reclaimed
  only when the model call threw; `/api/draft`, `/api/rfe`, and
  `/api/evidence/categorize` now also refund the token when the model returns
  unparseable output, and label the fallback honestly as `source: "mock"`
  instead of billing for — and persisting — a deterministic mock stamped as a
  real model response.
- **Paid single-section draft regenerate now persists.** A `focus` regenerate on
  `/api/draft` previously never saved, so it diverged from the stored draft and
  was lost on reload. It now merges into the latest draft as a new version, with
  the regenerated section pinned to the requested heading so a model rename can't
  turn a paid regenerate into a silent no-op.

## [0.3.1] - 2026-06-02

Patch release. A defensive fix to the leaf display formatters so AI-sourced
scores can never crash the UI or surface `$NaN`/`NaN%`. No API changes, no
migration required.

### Fixed

- **Format helpers guard non-finite / non-number input (ADR 0003).**
  `formatCurrency`, `formatSignedCurrency`, `formatNumber`, and `formatPercent`
  now return the `—` placeholder when given `null`, `undefined`, `NaN`, or
  `±Infinity` instead of throwing or emitting `"$NaN"` / `"NaN%"`. These helpers
  are leaf formatters consuming AI-sourced scores with no upstream validation
  boundary, so they degrade safely. Adds a `finite()` type guard in
  `src/lib/format.ts`; covered by new unit tests for the null/undefined crash,
  `NaN`, and `±Infinity` cases.

## [0.3.0] - 2026-06-01

Backward-compatible feature release. Pre-1.0 **minor** bump — multiple
backward-compatible features accumulated since `0.2.1`, no breaking changes
(and per the `0.x` policy even breaking changes would only bump minor). No
migration or reinstall required.

### Added

- **Structured eligibility questionnaire (ADR-001).** A deterministic, guided
  yes/no/unsure screening path that complements the free-text profile funnel,
  so users who can't write a strong bio still get screened. Questions are
  DERIVED from the criteria packs (`packFor()`), keeping `packs.ts` the single
  source of truth; live programs only (planned/unknown classifications return
  `null`, never a silent O-1A fallback); every output carries the shared UPL
  `DISCLAIMER`; and `answersToProfile` bridges answers into the profile string
  the existing `/api/qualify` engine consumes unchanged. Pure (no
  network/React/env) and unit-tested. New
  `src/features/qualification/questionnaire.ts` with `index.ts` exports.
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

[0.4.0]: #
[0.3.1]: #
[0.3.0]: #
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
