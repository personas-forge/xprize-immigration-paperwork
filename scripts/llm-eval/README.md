# LLM-eval harness

A quality gate for every place the app sends a prompt to a model. It runs a set
of **real scenarios** through the **real product code path** for each site
(validate → build prompt → `getLlm().generate` → parse → disclaimer-wrap) and
checks the live output against automated **gates**.

## The six LLM sites

| Site            | Route                          | Module                          | Token op        | Tier |
| --------------- | ------------------------------ | ------------------------------- | --------------- | ---- |
| `guidance`      | `/api/guidance`                | `features/guidance`             | guidance (1)    | fast |
| `qualify`       | `/api/qualify`                 | `features/qualification`        | qualify (3)     | fast |
| `draft`         | `/api/draft`                   | `features/drafting`             | draft (12)      | long |
| `draft_section` | `/api/draft` (`focus`)         | `features/drafting`             | draft_section(5)| long |
| `rfe`           | `/api/rfe`                     | `features/rfe`                  | rfe (5)         | long |
| `evidence`      | `/api/evidence/categorize`     | `features/evidence`             | categorize (1)  | fast |

All six funnel through one wrapper, `src/lib/llm/client.ts` (`getLlm()` over
Gemini / Claude-CLI / template fallback).

## Running

There is no `GEMINI_API_KEY` in this checkout, so run against the local Claude
CLI (no key, local subscription):

```pwsh
$env:LLM_ENGINE='claude'; npm run eval:llm
# or directly, without the npm script:
$env:LLM_ENGINE='claude'; npx --no-install tsx scripts/llm-eval/run.ts
```

Subsets while iterating:

```pwsh
$env:LLM_ENGINE='claude'; npm run eval:llm -- --ids Q01,D02
$env:LLM_ENGINE='claude'; npm run eval:llm -- --site qualify
# stability: run the filtered set N times (ids tagged Q10#1, Q10#2, …)
$env:LLM_ENGINE='claude'; npm run eval:llm -- --ids Q10 --repeat 5
```

Outputs land in `scripts/llm-eval/out/` (git-ignored): `report.md` (human) and
`results.json` (full prompts + raw outputs + gate verdicts).

## Files

- `scenarios.ts` — the 30 scenarios + per-scenario expectations.
- `gates.ts` — the quality gates (FAIL = hard invariant, WARN = review signal).
- `engine.ts` — a `server-only`-free mirror of `client.ts` (so it runs under tsx).
- `run.ts` — the harness; `types.ts` — shared types; `smoke.ts` — wiring check.

## Gate tiers

- **FAIL** (deterministic, must never break): disclaimer attached, a real engine
  answered, canonical criteria set, valid statuses/buckets, letter structure,
  classification consistency (an O-1B letter must not call itself O-1A),
  expected evidence bucket, RFE addresses its issues, no legal advice in
  guidance.
- **WARN** (high-signal heuristics for a human): possible fabrication (invented
  numbers/years/money not in the record), weakly-grounded evidence/facts,
  verbosity, missing attorney mention.
