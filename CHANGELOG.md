# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While pre-1.0 (`0.x`), breaking changes increment the **minor** version.

## [Unreleased]

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
