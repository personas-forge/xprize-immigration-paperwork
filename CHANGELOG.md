# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While pre-1.0 (`0.x`), breaking changes increment the **minor** version.

## [Unreleased]

## [0.6.0] - 2026-06-08

Foundation release for the typed response envelope (ADR-0011, increment 1/4).
Pre-1.0 **minor** bump — adds new backward-compatible public API in `src/lib/`
with no change to existing behavior. This is the foundation that lets every AI
feature attach the non-negotiable not-legal-advice disclaimer (and its model
source) at the type level, closing a UPL (unauthorized-practice-of-law)
compliance gap where a route could silently omit the disclaimer. Subsequent
increments (2–4/4) wire the AI routes onto `wrapResult`.

### Added

- **`Result<T>` envelope + `wrapResult` factory (ADR-0011, 1/4, #32).** New
  `src/lib/result.ts` defines `Result<T> = { data: T; disclaimer: string;
  source: ModelSource }` and a `wrapResult(data, source)` factory. The module
  is pure and client-safe (no `server-only`/React imports) so the disclaimer
  invariant is unit-testable. A new AI route now gets the disclaimer + model
  source for free and cannot silently drop them. Covered by non-vacuous tests
  (`src/lib/result.test.ts`): payload-field shadowing, generics across
  string/object/array, and a UPL content assertion paired with a positive
  control so it cannot pass when the disclaimer is emptied.

### Changed

- **`DISCLAIMER` constant relocated to its canonical home (#32).** The shared
  not-legal-advice `DISCLAIMER` now lives in `src/lib/result.ts`;
  `src/features/guidance/guidance.ts` re-exports it **byte-identically** for
  back-compatibility, so existing importers are unaffected. No field semantics
  changed.

## [0.5.2] - 2026-06-08

Maintenance / refactor release. Pre-1.0 **patch** bump — behavior-preserving
internal refactors that **complete** the data-adapter migration (ADR-0010,
tasks 6 and 7 of 7), with no change to API contracts, status codes, or
observable behavior at the call sites (one intentional internal error-handling
change in the evidence actions, noted below). This release finishes the team
goal of insulating routes/actions from direct Store calls behind the adapter
layer.

### Changed

- **Review server actions now route through `PetitionAdapter` (ADR-0010, 7/7,
  #28).** The owner-or-attorney case gate in `src/features/review/actions.ts`
  now flows through the shared `PetitionAdapter` rather than a hand-rolled
  access check, finishing the adapter migration (7/7). Adds
  `owner-only-gate.test.ts` pinning the `email: null` owner-only invariant.
  Behavior at the call site is preserved.
- **Evidence-vault server actions now route through `EvidenceAdapter` (ADR-0010,
  6/7, #29).** `removeDocument` and `refileDocument` in
  `src/features/evidence/actions.ts` no longer hand-roll their own
  owner-or-attorney access check; every mutation now flows through the shared
  `EvidenceAdapter → resolveCase` fail-closed seam. The cross-tenant
  attorney-of-record check (the invariant behind the prior HIGH PII-egress
  findings) is now enforced in one audited place instead of being copy-pasted
  per route, so it can no longer be accidentally omitted at this call site. The
  action consumes the `AdapterResult` union directly and treats every non-ok
  outcome (`unconfigured` / `forbidden` / `not_found` / `store_error`) as a
  no-op. **One intentional behavior change:** a Store throw previously
  propagated out of the server action; the adapter now catches it and degrades
  to a no-op (the page is not revalidated), matching ADR-0010's uniform
  error-handling contract. Scope: 1 file, +34 / −24. Suite 271/271 green.

## [0.5.1] - 2026-06-08

Maintenance / refactor release. Pre-1.0 **patch** bump — a behavior-preserving
internal refactor that continues the data-adapter migration (ADR-0010, task 4
of 7) with no change to API contracts, status codes, or runtime behavior.

### Changed

- **`/api/draft` now routes through `PetitionAdapter` (ADR-0010, 4/7, #26).**
  The draft route no longer hand-wraps the raw `petitions` data functions
  (`getCriteriaForCase` / `getLatestDraft` / `saveDraft`) in ad-hoc try/catch.
  Its criteria read and draft persistence now go through the `PetitionAdapter`
  (`petitions.getCriteria` / `getLatestDraft` / `saveDraft`), which owns access
  re-validation, null-handling, and Firestore error handling. Store faults are
  surfaced as typed adapter errors mapped to proper statuses via
  `toErrorResponse` (503 / 500 / 404 / 403) instead of collapsing into an
  uncaught 500. Access context is owner-only — `draft` omits the
  `requiresAttorney` cross-tenant fallback, consistent with the upstream
  `authorizeRoute` decision. The null-latest-draft, paid-then-save-failed, and
  regenerate-section merge paths preserve prior semantics. Adds three
  `getCriteria` adapter tests (gate-first, owner-success, store_error); suite
  232/232 green.

## [0.5.0] - 2026-06-04

Backward-compatible feature release. Pre-1.0 **minor** bump — introduces the
data-adapter layer foundation (the first slice, tasks 1–3 of 7, of the team
goal to insulate API routes from direct Store calls). Purely additive: ten new
standalone modules under `src/lib/data/adapters/`, not yet wired into any route,
so there is no change to existing route behavior, API contracts, or status
codes. No migration or reinstall required.

### Added

- **Data-adapter layer foundation + Petition/Evidence adapters (ADR-0010, #24).**
  A thin adapter layer that wraps raw Store calls with a consistent result
  contract, so API routes stop calling the Store directly:
  - **`result.ts` — `AdapterResult<T>`.** A discriminated `ok` / `err` union
    with four typed error kinds (`unconfigured` → 503, `forbidden` → 403,
    `not_found` → 404, `store_error` → 500), replacing the prior layer's lossy
    bare-`null` returns.
  - **`access.ts` — `resolveCase()`.** A fail-closed, dependency-injected
    owner-or-attorney access gate that consolidates the previously copy-pasted
    cross-tenant check; denies without revealing case existence and never leaks
    its `cause` to the client.
  - **`http.ts`.** A pure `AdapterError → NextResponse` mapping that never
    leaks `cause`/PII to the client.
  - **`petition.ts` / `evidence.ts`.** The first two concrete adapters
    (Petition, Evidence).
  - Unit tests for every module (186/186 suite green).

## [0.4.0] - 2026-06-04

Backward-compatible feature release. Pre-1.0 **minor** bump — a large batch of
backward-compatible features, an AI-route orchestrator, a route-authorization
helper, an in-process event bus, and a cross-tenant security-hardening sweep
accumulated on `main` since `0.3.1`. No breaking changes (and per the `0.x`
policy even breaking changes would only bump minor). No migration or reinstall
required.

### Added

- **In-process domain event bus + Store emission + subscribers (ADR-0007, #18).**
  A typed in-process event bus the Store emits domain events onto, with
  subscribers wiring side-effects off those events — decoupling write paths from
  downstream reactions.
- **`authorizeRoute` case-access helper (ADR-0006, #14).** A single owner-only
  case-access guard for API routes, with unit tests, so per-route authorization
  is centralized and consistent instead of re-implemented per handler.

### Changed

- **`executeAiOperation` orchestrator core (ADR-0004, #10).** A single
  orchestration entry point for AI operations (auth → rate-limit → token charge →
  model call → token reclaim on failure → persist), the foundation the AI routes
  migrate onto.
- **Migrate `/api/qualify` and `/api/guidance` to `executeAiOperation`
  (ADR-0004, #12, #13).** Both AI routes now run through the orchestrator,
  inheriting uniform auth, rate-limiting, and charge-then-reclaim token handling.
- **Adopt `authorizeRoute` (owner-only) in `/api/draft` (ADR-0006, #17).** The
  draft route now uses the shared case-access helper.
- **`OperationRegistry` — single source of truth for op cost / rate-limit / label
  (ADR-0007, #19).** Per-operation cost, rate-limit, and display metadata are
  consolidated into one registry rather than scattered constants.
- **Composite `useCaseFileData` hook (ADR-0009, #22).** Replaces the case
  dashboard's three independent `useEffect` fetches (`getCaseFacts`,
  `getOutstandingTasks`, `getPetitionExcerpt`) with one composite hook over a
  React-free `caseFileData.ts` that runs the three concurrently and exposes
  unified loading/error state.

### Security

- **Cross-tenant access fail-closed + systemic IDOR remediation (#9).**
  `isConfiguredAttorney` is now strict/fail-closed; cross-tenant access is denied
  on the review queue, case detail, and evidence actions; IDOR holes closed
  across `/api/draft`, `/api/rfe`, `/api/guidance`, and `/api/evidence/categorize`.
- **AI-route abuse + cost controls (#9).** An in-process fixed-window rate
  limiter guards the AI routes, and tokens are charged-then-reclaimed (refunded
  when the model call throws or returns unparseable output) so failures don't
  burn balance.
- **Data-integrity guards (#9).** Atomic guarded case transitions, never-reused
  PGlite exhibit identifiers, a double-submit guard, and save-failure surfacing
  in the Draft/RFE studios; model-fallback discrimination and isolation of
  untrusted prompt input.

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

[0.6.0]: #
[0.5.2]: #
[0.5.1]: #
[0.5.0]: #
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
