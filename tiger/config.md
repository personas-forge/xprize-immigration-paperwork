---
type: tiger/config
app: Immigration Concierge
last_init: 2026-06-23
engine_summary: one chokepoint (executeAiOperation) → Gemini (prod) | Claude CLI (dev) | deterministic mock
---

# Tiger config — Immigration Concierge

The per-app file (the "overlay"). The engine (`.claude/skills/tiger.md`) is portable;
everything app-specific lives here. Resolve the open questions at the bottom before a
`--live` run.

## What counts as a call site
One note per **distinct prompt builder** that reaches a model — not per route and not
per billing key (several call sites share an `operation` key for billing, e.g.
`draft-critique` bills as `draft_section`). A route that only does CRUD / preview math
(`api/qualify/preview/*`, `api/draft/save`, `api/me/export`) is **out of scope** — no
model call.

## Discovery globs
- Chokepoint: `src/lib/ai/operation.ts` (`executeAiOperation` — the single funnel).
- Entry routes: `src/app/api/**/route.ts` (look for `executeAiOperation(request, <spec>)`).
- Specs + prompt builders + parsers + mocks: `src/features/<x>/<x>.ts` and
  `src/features/<x>/<x>Operation.ts` (pure modules, unit-tested).
- LLM client / model resolution / telemetry: `src/lib/llm/{client,config,label,json}.ts`,
  `src/lib/cost-telemetry.ts`.
- Token economy (cost per call site): `src/lib/tokens/registry.ts` (tiers
  light=1 / medium=3 / heavy=5 / xl=12).

## The model-invocation recipe (Lens 3 — the key recipe)
Production engine is **Gemini Flash**; this checkout has **no `GEMINI_API_KEY`**, so the
real AI path locally is the **Claude Code CLI** (`LLM_ENGINE=claude`). Tier→model
(`src/lib/llm/config.ts`):
- Gemini `fast` tier → `GEMINI_MODEL` ?? `gemini-3-flash-preview`
- Gemini `long` tier → `GEMINI_DRAFT_MODEL` ?? (falls back to the fast model when unset)
- Claude CLI → `CLAUDE_CLI_MODEL` ?? `sonnet`, spawned as `claude -p` (prompt on stdin)
- No engine configured → deterministic template mock (`source: "mock"`)

**Recipe that works (per the engine's learned note):** for a benchmark cell, dispatch one
**Agent-tool subagent per matrix cell** with the tool's *real* system+user prompt (built by
the call site's `build*Prompt` fn) and a fixed Character input, varying the Agent's
`model`/`effort` params. The subagent returns the schema JSON (parse with the call site's own
`tryParse*`/`parse*`) and its wall-clock is a usable latency proxy. **No external API keys
needed.** Judge each cell with a *separate* model (never the one under test); adversarial /
majority judging for close calls.

Three live entry points to drive the real product path (not the mock):
1. **Eval harness** — `LLM_ENGINE=claude npm run eval:llm` (filters `-- --site qualify` /
   `-- --ids Q01,D02`). 30 scenarios through the real validate→prompt→generate→parse→gate
   path; gates in `scripts/llm-eval/gates.ts`. Outputs `scripts/llm-eval/out/`.
2. **Direct API POST** — dev-auth resolves for direct POSTs (no cookie). Fastest grounded
   path for `/api/qualify` + `/api/draft` + `/api/rfe`.
3. **E2E** — `LLM_ENGINE=claude npm run e2e` (boots the app, asserts `source == engine`).

## Fixtures
Reuse the **`/uat` Character profiles** as the canonical inputs (`uat/characters/*.md` — 25
of them; 10 adapted into `characters/` here). Each carries a real free-text profile (qualify
input) and a JTBD that names the call sites it exercises. The eval harness scenarios
(`scripts/llm-eval/`) are a second fixture set already wired to the real path.

## Cost-awareness (cache the vault, never re-run an identical cell)
There is **NO input-hash output cache** in the product (`operation.ts` dedupes the *charge*
on `Idempotency-Key`, not the model output). So Tiger must do its own caching: every Lens-3
cell result is keyed by `(call-site, model, thinking, input-hash)` in `models/*` and never
re-run. Sample call sites for `--live`; don't benchmark all 9 every pass.

## Compliance invariants Tiger must never regress (pin these)
- The single `DISCLAIMER` rides on every AI payload (UPL safeguard).
- Adjudication hard-stop: a `blocked` output is withheld + charge reclaimed
  (`operation.ts` step 9 / `onBlocked`). Don't propose anything that ships flagged text.
- A mock is never billed as model output (`source: "mock"`), and mocks are not adjudicated.

## Open questions
- [x] **Is `GEMINI_DRAFT_MODEL` meant to be stronger than Flash?** RESOLVED 2026-06-24
      ([[2026-06-24-lens3-draft-models]]): yes — capability drives draft quality (~+$1,400/petition from
      cheap→mid tier, saturating at the mid tier), so **set `GEMINI_DRAFT_MODEL` to a Pro-class
      long-context model** (standard thinking) and A/B with real Gemini. Don't pay for the top tier.
- [x] **Judge model for benchmarks** RESOLVED: must differ from the cell under test; **Fable is currently
      unavailable** here, so for a {haiku,sonnet,opus} matrix judge with Sonnet and use haiku↔opus as the
      clean independent brackets (sonnet cells self-judged → caveat).
- [ ] Real Gemini A/B (Flash vs the chosen Pro model) once a `GEMINI_API_KEY` is available — to quantify
      the proxy's ~+$1,400/petition estimate exactly.
