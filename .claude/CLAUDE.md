# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Pre-flight: run the gate before every commit

Automated dev ships this repo frequently, so the cheap, deterministic checks run **locally, in this loop** — they are the primary gate. (Where CI exists it is only a thin backstop; skipping these locally just costs a slow CI round-trip and burns GitHub Actions minutes.)

Before committing, run and make green:

```bash
npm run typecheck && npm run lint && npm test
```

Git hooks enforce a subset automatically (husky, wired by `npm install`):

- **pre-commit** → `eslint --fix` on staged files
- **pre-push** → `npm run typecheck && npm test`

Note: the full Playwright E2E suite now runs on PRs and nightly (not on every push to `main`) — run `npm run test:e2e` locally if your change touches the funnel.

Fix red before committing — don't push red and let CI catch it. Bypass only for genuine WIP (`git commit --no-verify`) and never on a push to `main`.
