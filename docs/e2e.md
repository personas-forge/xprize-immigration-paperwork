# End-to-end tests (Playwright)

Drives the **real app on port 3003** and exercises every AI route — including the
points where the LLM engine runs — so the Gemini and Claude engines can be
validated automatically.

## Run

```bash
npm run e2e:install     # one-time: download the Chromium browser
npm run e2e             # template fallback (deterministic, no engine, CI-safe)
```

The harness boots the app **keyless + unmetered** (no DB, no auth,
`TOKENS_BYPASS=1`), so the public `/qualify` flow and all AI routes work with no
backend.

## Against a real engine

```bash
LLM_ENGINE=claude npm run e2e                          # local Claude Code CLI login
LLM_ENGINE=claude CLAUDE_CLI_MODEL=haiku npm run e2e   # faster / cheaper
GEMINI_API_KEY=... npm run e2e                         # Gemini
```

PowerShell:

```powershell
$env:LLM_ENGINE="claude"; npm run e2e
```

Each test asserts the response `source` equals the active engine, so a green
`LLM_ENGINE=claude` run **proves the Claude function actually executed** — if the
CLI errors, the route falls back to `"mock"` and the assertion fails.

## Coverage

| Spec | What it drives |
|---|---|
| `e2e/llm-routes.api.spec.ts` | Direct POSTs to all five routes — guidance, qualify, draft, rfe, evidence/categorize — asserting shape + disclaimer + engine. |
| `e2e/qualify-draft.ui.spec.ts` | UI click-through: `/qualify` → fill + "Check my eligibility" (fires `/api/qualify`) → "Draft the petition" (fires `/api/draft`). |

## Notes

- Port is configurable: `E2E_PORT=4000 npm run e2e`.
- Outside CI, `reuseExistingServer` is on — if you already have `next dev -p 3003`
  running, the suite reuses it.
- Engine selection and the image-operation constraint are documented in
  [`llm-engines.md`](./llm-engines.md). The Claude CLI engine is local-only.
- Timeouts are generous (a live full-draft call can take minutes); the suite runs
  serially (`workers: 1`).
