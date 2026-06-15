# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While pre-1.0 (`0.x`), breaking changes increment the **minor** version.

## [Unreleased]

## [0.13.0] - 2026-06-15

Pre-1.0 **minor** bump — attorney review queue now surfaces queue-age badges
and staleness warnings so reviewers can prioritise overdue petitions at a
glance. No API-contract or persisted-field semantics changed.

### Added

- **Queue-age badges and staleness warnings on attorney petition review list
  (#87).** Each petition card in the attorney review queue now displays elapsed
  time since draft submission as a visible badge; cards older than a configured
  threshold turn amber/red to signal staleness. Requires an explicit
  `submittedAt` mapping from `StoredCase → SavedCaseSummary` at the dashboard
  data layer (resolves prior TS2322 blocker on `dashboard/page.tsx`).

## [0.12.0] - 2026-06-15

Pre-1.0 **minor** bump — moonshot batch: 8 major features spanning the AI
advocacy engine (adjudication-risk, adjudicator redline, RFE Risk Radar,
exhibit-cited petitions, exhibit-bound RFE), qualification UX (Instant Verdict
landing screener, best-path recommender), and viral sharing (Letters Patent
certificate). Accompanied by a full dead-code + adapter-migration refactor
(ADR-0010, ADR-0004 completion) and a +2 px typography pass. No
API-contract or persisted-field semantics changed.

### Added

- **Shareable Letters Patent sealed certificate (#18).** Mint a screening result
  into a public "Letters Patent of Extraordinary Ability" with no database
  requirement — the snapshot is encoded in an unguessable URL token; `/c/[token]`
  renders an engraved certificate and `/opengraph-image` draws a unique 1200×630
  Open Graph card for LinkedIn/X sharing.
- **Exhibit-cited petitions — evidence vault bound into draft route (#10).**
  Draft prompts are now exhibit-aware; the evidence vault is wired into the draft
  API; an Exhibit Index with citation-integrity meter appears in DraftStudio; and
  the full Exhibit Index is appended to the packet export.
- **Instant Verdict anonymous screener on the landing hero (#16).** An
  anonymous "Instant Verdict" certificate screener appears on the landing page;
  results pre-fill the full qualification form via a handoff route — zero-friction
  funnel entry.
- **Best-path recommender engine + comparison UI on /qualify (#7).** A keyless
  best-path route evaluates all visa categories and the `/qualify` page now leads
  with a "Find my best path" visa comparison UI; the qualify→draft E2E flow is
  updated accordingly.
- **Live adjudication-risk engine + per-document compliance-risk badges (#1).**
  A live adjudication-risk LLM gate runs in the orchestrator (single-sourced with
  the eval harness) and each evidence document now shows a compliance-risk badge.
- **Adjudicator critique/redline for draft sections (#19).** A new
  `/api/draft/critique` route scores and redlines each petition section;
  DraftStudio surfaces score chips, redline cards, and an Apply button.
- **RFE Risk Radar forecast engine + one-click Reinforce (#20).** A Risk Radar
  panel in DraftStudio forecasts RFE likelihood per section and offers one-click
  Reinforce to tighten the weakest points.
- **Exhibit-bound RFE responses + shared Exhibit Index (#21).** RFE section
  responses are now exhibit-bound (same vault integration as draft); the Exhibit
  Index is shared across draft and RFE.

### Fixed

- **Include DISCLAIMER on 429 rate-limited draft-save response.** Rate-limited
  saves now carry the UPL disclaimer so the client can surface the correct error
  copy.
- **Mirror paid-path bundle resolution on refund clawback (webhook).** The
  webhook refund path now resolves the token bundle the same way the purchase
  path does, closing a divergence that could leave credits un-clawed.
- **Drive qualify eligibility threshold from the pack, not a hardcoded 3.** The
  pass/fail cutoff now reads from the visa-pack definition, making it configurable
  per visa type.
- **Stop LLM eval harness engine copies drifting from canonical.** The harness
  now imports the shared engine core instead of maintaining a separate copy.

### Changed

- **+2 px typography promotion + single-row homepage header (#85).** Every
  sub-base font size is promoted +2 px app-wide; the homepage nav is now
  single-row (no overflow/wrap).
- **Large dead-code deletion batch (wave 1–4, −677+ LOC).** Removed dead
  modules: questionnaire, format helpers (currency/number), documents mock layer,
  non-atomic `setCaseStatus` wrapper, `isStale` (superseded by `freshnessOf`),
  `getCaseById`/`getFormById`, `StatCard`/`SectionHeader` UI kit components,
  `getOwnedCases` adapter method, `OPERATIONS` export, `getAnalytics`
  subscriber path, `RfeSection` type re-export, `getOwnedCases` dep chain.
- **Adapter migration complete — ADR-0010 (PetitionAdapter + EvidenceAdapter).**
  `/api/rfe`, case-detail gate, evidence categorize write, and qualify
  `createCase` all now route through the respective adapter's
  `resolveCase`/`createCase`/`addDocument` methods; removes the last inline
  owner-or-attorney gate copies.
- **AI orchestrator route migration complete — ADR-0004 (executeAiOperation).**
  `/api/draft`, `/api/rfe`, `/api/evidence/categorize`, and `/api/guidance` all
  run through `executeAiOperation`; orchestrator now receives `AuthUser.email`
  and persists the source.
- **Legal UPL primitives centralised.** `DisclaimerStamp` and `CitationNote`
  moved from `@/features/guidance` to `@/components/legal`; `DISCLAIMER` and new
  `CONSENT_DISCLAIMER` consolidated in `@/lib/result` with content-regression
  tests; `qualification.ts` re-targets canonical `@/lib/result` import.
- **Shared helpers extracted.** `toSection`/`tryParseSections`, `str()`/
  `criterionLine()`/cap constants, `todayIso()`/`addDays()`, `clientIp()`,
  `requireAttorney`/`applyTransition` spine, `profileFieldsFromUser`, and the
  firebase-admin initializer are now single-sourced across their consumers.
- **Pricing surface aligned with the token model** (removes attacker-influenceable
  `tokens` metadata field from checkout; pricing copy reflects actual pack sizes).

## [0.11.0] - 2026-06-14

Pre-1.0 **minor** bump — batches the vibeman UI polish series (#75–#83): visual
improvements across drafting, qualification, evidence, billing, and guidance
surfaces, plus a large security-and-hardening batch (#75) covering double-submit
guards, rate-limit hardening, auth cookie prefix, prompt-injection strip, and
token-lifecycle fixes. No API-contract or persisted-field semantics changed.

### Added

- **Distinct visual treatment for mock/placeholder AI output in DraftStudio
  (#83).** AI sections generated from mock/seed data now render with a clear
  visual distinction so users can immediately tell which content is real vs.
  placeholder.
- **Responsive O-1A criteria report — table on desktop, cards on mobile (#82).**
  The qualification criteria summary adapts its layout to the viewport: a full
  table on wide screens and a stacked-card view on mobile, improving readability
  at any screen size.
- **Purchase-success toast when Polar redirects back after checkout (#81).** A
  confirmation toast is now shown on successful token-bundle purchase, giving
  users clear feedback that their credits were added.
- **Regenerate-button restyle + cascade section cards in DraftStudio (#80).**
  The section-level regeneration controls have been restyled and the section
  cards now cascade visually, improving scanability of the drafting canvas.
- **Coverage progress bar on the Evidence Vault replaces the fraction badge
  (#79).** The evidence coverage indicator now uses a progress bar instead of a
  raw fraction (e.g. "3/8"), making coverage status faster to parse at a glance.
- **Parchment shimmer skeleton replaces the generic `animate-pulse` placeholder
  (#79).** Loading skeletons now use the app's parchment theme shimmer animation
  instead of the default grey pulse, keeping the visual language consistent while
  data loads.
- **Left-border status accent on O-1A criteria rows (#77).** Each criterion row
  in the qualification report now shows a coloured left border reflecting its
  assessment status (strong/weak/neutral), adding a fast visual status scan.
- **Freshness progress bar with days-remaining countdown on the transparency page
  (#77).** The document-freshness indicator now shows a progress bar and a
  "N days remaining" label alongside the tier label, making expiry timing
  concrete for users.
- **Token-cost labels on the 'Get field guidance' and 'Screen my profile'
  buttons (#77).** Both action buttons now show the token cost inline (e.g.
  "2 tokens") so users know the charge before clicking. A live character-count
  helper is also shown on the qualification form.
- **Humanized error messages for adapter fetch failures (#76).** When an API
  adapter returns an error envelope, the message shown to users is now
  human-readable rather than a raw HTTP status string. `ErrorEnvelope` is
  exported as a typed client type for consistent error handling across the UI.

### Fixed

- **BundleGrid hardened against double-submit and stuck back-button (#76).**
  Rapid double-clicks on a purchase button no longer fire duplicate checkout
  requests; browser back-button state after a Polar redirect no longer leaves the
  UI in a stuck loading state.
- **In-memory rate-limit bucket map is now bounded to prevent a memory leak
  (#76).** The server-side fixed-window rate limiter now caps its bucket map
  size, preventing unbounded growth on long-running instances.
- **`pgcrypto` PGlite extension loaded so the dev DB initialises correctly
  (#78).** Local development database now loads the `pgcrypto` extension on
  startup, fixing a crash when the dev schema uses `gen_random_uuid()`.
- **`__Host-` session-cookie prefix used in production for CSRF hardening
  (#75).** The session cookie is now set with the `__Host-` prefix in production,
  enforcing Secure + path=/ constraints and tightening CSRF posture.
- **Control-character strip on guidance fields to block prompt-injection (#75).**
  Input fields used in LLM guidance prompts now have control characters stripped
  before sending, preventing prompt-injection via crafted field values.
- **Double-submit guards on QualifyPanel and Evidence 'Add & categorize' (#75).**
  Both actions are now guarded against concurrent submissions, preventing
  duplicate charges or duplicate evidence rows.
- **Sign-up token grant happens before the profile is marked onboarded (#75).**
  Fixes a race where a user was marked onboarded before their initial token grant
  landed, leaving them with zero balance on first dashboard visit.
- **Forwarded IP validated before keying the rate limiter on it (#75).** The
  rate-limit middleware now validates the `X-Forwarded-For` header value before
  using it as a key, preventing spoofed IPs from bypassing limits.
- **Token reclaim ledger scoped by user id (#75).** Prevents one user's reclaim
  from being attributed to another when concurrent reclaims race on the same
  session.
- **Polar refund deduplication keyed on original order id (#75).** Duplicate
  `order.refunded` webhook deliveries no longer trigger a double clawback of
  token credits.
- **Additional hardening:** `getStore()` memoized to prevent double-init races;
  CSV blob URL freed even if `click()` throws; RFE inline edits keyed by index
  (not heading) to survive heading renames; `saveFailed` surfaced when a section
  regen has no base draft; `transitionCase` reports failure when no store is
  configured; `extractJson` balances braces instead of grabbing first-to-last.

## [0.10.1] - 2026-06-14

Pre-1.0 **patch** bump — a single critical copy fix, no API or persisted-field
changes. Restores the missing consent verb on the onboarding submit button so
the action a user takes to grant consent is unambiguous (a valid-consent / UPL
safeguard). Ships with a source-level regression guard so the copy cannot
silently regress past a green CI gate again.

### Fixed

- **Restored the 'Agree' consent verb on the ConsentForm submit button (#73).**
  The button copy had regressed in v0.10.0 (#64) to the verb-less "Finish
  setup — open my case file"; it now reads **"Agree & open my case file"** so
  the consent action is explicit. A new `ConsentForm.consent-copy.test.ts`
  asserts the button contains the consent verb and never regresses to the
  banned label — closing the gap where component copy was not covered by the
  React/E2E suites.

## [0.10.0] - 2026-06-13

Pre-1.0 **minor** bump — batches every increment merged after v0.9.1 (#45, #46,
#47, #48, #64, #70, #20, #16). User-facing features (recurring Polar
subscription, onboarding progress indicator, post-screening guidance, dashboard
empty-state CTA, draft save-failure recovery) drive the minor bump; internal
auth/LLM-guard refactors and an a11y fix ride along. No breaking API or
persisted-field semantics changes.

### Added

- **Polar monthly subscription — recurring token allowance (#70).** A new
  `monthly` bundle ($19/mo ≈ 2,500 tokens per billing cycle), wired to
  `POLAR_PRODUCT_MONTHLY` and reusing the existing checkout/webhook flow, gives
  users a recurring alternative to one-off token purchases.

- **'Step 2 of 2 · Confirm your details' progress indicator in the welcome flow
  (#64).** The consent/onboarding step now shows where the user sits in the
  two-step flow and clarifies the submit-button copy, reducing onboarding
  drop-off.

- **'What happens next' panel after successful O-1A screening (#47).** After a
  positive qualification result, a contextual "§ What happens next" card renders
  below the criteria report, listing the three ordered steps (Create account →
  Upload evidence → Attorney reviews) with a "Get started →" CTA linking to
  `/login`. Users who qualify now have a clear path forward from the screening
  page.

- **Dashboard empty-state 'Qualify your profile' CTA (#46).** When a user has
  no saved cases the "Your cases" slot now shows an `EmptyCasesCallout` — a
  prompt and a "Qualify your profile" button linking to `/qualify` — instead of
  rendering nothing. New users are no longer left with a blank dashboard section.

- **Actionable `saveFailed` recovery in DraftStudio — copy draft + no-charge
  retry save (#45).** When `/api/draft` charges and generates but version
  persistence fails, the failure banner is now a `role="alert"` recovery surface
  offering two escapes: copy the generated draft to the clipboard, or retry
  saving via the new `/api/draft/save` endpoint (owner-only, rate-limited, never
  re-charges or re-generates). Users no longer lose paid AI work product when a
  transient persistence error occurs.

### Changed

- **Output guards composed via a `withGuards` decorator (ADR-0008, #20).**
  `getLlm()` now wraps both engines (gemini, claude) through `withGuards(...)`,
  applying the deterministic output guard exactly once on every `generate()`
  call; the engine clients stay guard-free. No change to guard behaviour.

- **`authorizeRoute` adopted in the RFE and evidence-categorize routes
  (ADR-0006, #16).** `/api/rfe` and `/api/evidence/categorize` now use the
  shared `authorizeRoute` case-access helper instead of hand-rolled checks;
  401/403 status codes and error copy are byte-identical to before.

### Fixed

- **`role=alert` on `RfeStudio` `saveFailed` banner (a11y, WCAG 4.1.3, #48).**
  The data-loss warning in the RFE drafting studio now uses `role="alert"`
  (assertive live region) instead of `role="status"` (polite), so screen-reader
  users are immediately notified when their saved work is lost.

## [0.9.1] - 2026-06-12

Bug-fix release. Pre-1.0 **patch** bump — two error-handling fixes that
surface previously silent fetch/regeneration failures with retryable inline
alerts (#63, #65). No new feature surface; no API-contract or persisted-field
semantics changed.

### Fixed

- **The field-guidance form list no longer hangs on a fetch failure (#65).**
  The `useEffect` in `FieldGuidancePanel` that loads the USCIS form/field
  list now has a `.catch()`: on API or network failure users see a
  `role="alert"` error notice with a **Retry** button instead of an endless
  loading skeleton. Error state is set only inside the async `.catch()`, and
  the Retry handler owns the reset (clearing the error and re-running the
  fetch via an attempt counter).
- **Single-section regeneration failures in the drafting studio are no longer
  silent (#63).** When regenerating one petition section fails (API error or
  network failure), `DraftStudio` now shows an inline `role="alert"` notice on
  the affected section — "Regeneration failed — your previous text was kept" —
  instead of giving no feedback. The existing section text is always preserved,
  and the alert clears when the user retries regeneration or edits the section
  inline. Tokens behavior is unchanged. No API-contract or persisted-field
  semantics changed.

## [0.9.0] - 2026-06-12

Feature release. Pre-1.0 **minor** bump — two onboarding UX increments
merged since v0.8.0: O-1A criteria primer tooltips for first-time dashboard
visitors (#56) and a one-time dismissible token economy explainer banner
before the first paywall encounter (#57). No API-contract or persisted-field
semantics changed.

### Added

- **O-1A criteria primer tooltips on the case-file dashboard (#56).**
  Each of the eight O-1A criterion labels in `CriteriaTable` now shows a
  `?` icon button that opens an inline popover with a one-sentence plain-English
  definition and a concrete evidence example. `criteria-primers.ts` holds the
  static primer data; `CriterionPrimerButton.tsx` manages the toggle popover
  (Escape / outside-click to close). The popover is fully accessible:
  `role="dialog"`, `aria-modal="true"`, focus moves into the close button on
  open and returns to the trigger on close. `overflow-hidden` was scoped to the
  `CardHeader` so absolutely-positioned popovers are not clipped.
- **One-time dismissible token economy explainer banner (#57, ADR-0006).**
  `TokenExplainerBanner` mounts in `DashboardView` (inside `ThemeScope`, before
  `DashboardTopBar`) and explains the token credit model before users first hit
  a paywall. Gated on `balance !== null` (demo/bypass mode → no mount). Dismiss
  state persists to `localStorage` via `useSyncExternalStore` through
  `bannerDismiss.ts`, injected for testability.

### Tests

- 5 data-integrity tests for `criteria-primers.ts` (all primer fields present and
  non-empty for every O-1A criterion, #56).
- 7 unit tests for `bannerDismiss.ts` (first-visit display, dismiss behaviour,
  localStorage persistence, #57).

## [0.8.0] - 2026-06-12

Feature release. Pre-1.0 **minor** bump — per-panel React error boundaries
for the case-file dashboard (#55). A throw inside any single dashboard panel
(CriteriaTable, TasksCard, PetitionDraftCard, EvidenceVault) now renders an
inline "Could not load — retry" card instead of crashing the whole dashboard.
No API-contract or persisted-field semantics changed.

### Added

- **Per-panel `PanelErrorBoundary` component (#55).** A reusable class-based
  React error boundary (`getDerivedStateFromError` + `componentDidCatch`) with
  an inline `PanelFallback` ("Could not load {panel} — retry") exported from
  `src/components/ui`. Each dashboard panel gets its own boundary instance, so
  a render error in one panel does not unmount its siblings or trigger the
  route-level error page.
- **Error boundaries applied to all four dashboard panels (#55).**
  `CriteriaTable`, `TasksCard`, and `PetitionDraftCard` in
  `CaseFileDashboard.tsx`, and `EvidenceVault` in `CaseDetailView.tsx` are
  each individually wrapped, completing the team goal "Wrap dashboard feature
  panels in per-panel React error boundaries."
- **Structural unit tests for `PanelErrorBoundary` (7 tests, #55).** Tests
  verify `getDerivedStateFromError`, `componentDidCatch`, class-component
  shape, `hasError` guard, exported symbols, and the "Could not load" / "Retry"
  user-facing copy in `PanelFallback`.

## [0.7.0] - 2026-06-12

Feature release. Pre-1.0 **minor** bump — four backward-compatible increments
merged since v0.6.1 (#45–#48). Highlights: a user-facing empty-cases CTA on
the dashboard, a post-qualification Next Steps panel, actionable saveFailed
recovery in the drafting studio, and an ARIA live-region fix for the RFE
banner. No breaking changes; no API-contract or persisted-field semantics
changed.

### Added

- **Empty-cases CTA callout on the case-file dashboard (#46).** When a user
  has no cases, the dashboard now renders an `EmptyCasesCallout` card with a
  "Start your case" link that routes to `/qualify`. Previously the 'Your cases'
  card was unconditionally hidden at `cases.length === 0`, leaving new users
  with a blank screen and no path forward.
- **Next Steps panel after a successful qualification result (#47).** After a
  passing qualification assessment, users now see a structured Next Steps
  panel guiding them toward filing, rather than landing on a dead-end result
  screen.
- **Actionable saveFailed recovery in the drafting studio (#45).** When a
  draft save fails, users are now offered a "Copy draft" action and a
  no-charge retry so no work is silently lost. The retry does not re-charge
  token balance on transient failures.

### Fixed

- **`role="alert"` on the RFE Studio saveFailed banner (a11y, #48, WCAG
  4.1.3).** The save-failure error banner in `RfeStudio` was a plain `<div>`
  invisible to assistive technology. Adding `role="alert"` ensures screen
  readers announce the error immediately without requiring user focus.
- **Nested `<a>` + `<button>` in `EmptyCasesCallout` corrected (a11y, #51,
  issue #50).** The callout was rendering a `<Link>` wrapping a `<Button>`,
  producing an interactive element inside an anchor — invalid HTML and a
  screen-reader/keyboard trap. Replaced with a single `<Link>` styled as a
  button so the DOM tree is valid.

## [0.6.1] - 2026-06-11

Accessibility patch release. Pre-1.0 **patch** bump — two backward-compatible
a11y fixes merged since v0.6.0 (#40, #42), plus a new automated CI contrast
audit that prevents future WCAG AA regressions. No features, no breaking
changes, no API-contract or persisted-field semantics changed.

### Fixed

- **Dark-theme muted-text contrast now meets WCAG AA (a11y, #42).** The ink
  (midnight) theme's `--muted` token failed the AA 4.5:1 ratio for normal
  text (`#95876a` measured 4.44:1 on `--surface` and 3.75:1 on
  `--surface-elevated` — the ground under the dashboard doc-number labels).
  Lifted to `#a89a7e`, which clears 4.78:1 on the tightest surface while
  preserving the warm-khaki hue and the muted / muted-strong hierarchy.
- **`DashboardTopBar` backdrop-blur gated behind `prefers-reduced-motion`
  (a11y, #40).** Users who prefer reduced motion no longer get the
  backdrop-blur effect on the dashboard top bar.

### Added

- **CI contrast audit (`themes.contrast.test.ts`, #42).** Every text token is
  now audited against every opaque surface token in both themes on every
  `npm test` run, so CI fails on any future WCAG AA contrast regression.
  Includes a positive control proving the audit flags the old `#95876a`.

## [0.6.0] - 2026-06-10

Feature release. Pre-1.0 **minor** bump — two backward-compatible additions
(the `Result<T>` envelope foundation and the ghost-Button focus-visible ring)
ship alongside accessibility fixes, a landing-page image perf tweak, and an
internal case-file data-fetch consolidation. Batches all seven increments
merged to `main` since v0.5.2 (#32, #34–#39) into one published release. No
breaking changes; no API-contract or persisted-field semantics changed.

### Added

- **`Result<T>` envelope + `wrapResult` factory (ADR-0011, 1/4 foundation,
  #32).** Introduces a typed success/error result envelope and a `wrapResult`
  helper as the foundation for the upcoming uniform error-handling rollout.
  Additive only — no existing call sites changed.
- **Focus-visible ring on the ghost `Button` variant (#35).** The ghost
  variant now renders a keyboard focus-visible ring, closing an accessibility
  gap for keyboard users without affecting mouse interaction or visual
  styling at rest.

### Fixed

- **Skip-link target is now a real `<main>` landmark (a11y, #34).** The
  skip-to-content link now points at a genuine `<main>` element, fixing
  screen-reader landmark navigation.
- **Recovered the stranded ghost focus-ring contrast fix (a11y, #36).**
  Re-applies an a11y contrast correction for the ghost focus ring that had
  been stranded on a branch.
- **`scope="col"` on `CriteriaTable` column headers (a11y, #38).** Column
  headers now declare `scope="col"` so assistive tech associates cells with
  the correct header.

### Changed

- **Responsive `sizes` prop on the landing hero background image (perf,
  #37).** Adds a responsive `sizes` hint so the browser fetches an
  appropriately scaled hero image, reducing wasted bytes on small viewports.
- **Consolidated `CriteriaTable`'s data fetch into `useCaseFileData`
  (refactor, #39).** `CriteriaTable` no longer runs its own
  `useEffect`/`useState` fetch — `getCriteria()` now rides the coordinated
  `useCaseFileData` `Promise.all` fan-out (now 4 sources) and the component
  consumes `criteria` as a prop. Behavior-preserving; removes a redundant
  per-component network read and avoids the set-state-in-effect lint trap.
  Completes the team goal *"Consolidate CriteriaTable data fetch into
  useCaseFileData hook."*

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

[0.13.0]: #
[0.12.0]: #
[0.11.0]: #
[0.10.1]: #
[0.10.0]: #
[0.9.1]: #
[0.9.0]: #
[0.8.0]: #
[0.7.0]: #
[0.6.1]: #
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
