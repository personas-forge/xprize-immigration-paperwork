> Total: 5 | Critical: 2 | High: 2 | Medium: 1 | Low: 0
> Context: LLM Evaluation Harness
> Lens mix: bug-hunter 5, ui-perfectionist 0

## 1. Hard gate failures never set a non-zero exit — only thrown pipelines do
- **Severity**: Critical
- **Lens**: bug-hunter
- **Category**: false-green / CI exit-code logic
- **File**: scripts/llm-eval/run.ts:291-302
- **Scenario**: Run the eval in CI; every scenario answers but the disclaimer is dropped (or `real-engine` is "mock"), producing dozens of `fail` gates. No pipeline throws.
- **Root cause**: `main()` computes `fail`, `warn`, `errored`, but the only thing wired to `process.exitCode` is `if (errored > 0)`. `errored` counts ONLY scenarios whose `execute()` *threw* (LLM timeout / parse exception). A run where the model answered but violated a deterministic FAIL invariant (missing/altered `DISCLAIMER`, wrong-classification leak, invalid criteria set, `real-engine` fell to mock) has `errored === 0`, so the process exits **0**. The whole point of the FAIL tier ("deterministic invariants the product must never break") is silently un-enforced at the exit boundary.
- **Impact**: The harness is the quality gate for all six LLM sites, yet a green exit can hide every hard failure it detected. A regression that strips the UPL disclaimer from every paid output passes CI. This is the worst class of bug for an eval: it reports "all passed" (exit 0) when it actually flagged hard violations.
- **Fix sketch**: `if (fail > 0 || errored > 0) process.exitCode = 1;`. Optionally also fail when `records.length === 0` (see #2). Keep `errored` in the message but stop treating it as the sole gate.

## 2. Zero scenarios after filtering reports a clean pass
- **Severity**: Critical
- **Lens**: bug-hunter
- **Category**: false-green / empty-set boundary
- **File**: scripts/llm-eval/run.ts:195-206, 273-302
- **Scenario**: `npm run eval:llm -- --site qualfy` (typo) or `--ids Q99`. `applyFilters` returns `[]`.
- **Root cause**: `applyFilters` filters with no floor on the result size. `main()` then loops over an empty list, `records = []`, so `fail = 0`, `warn = 0`, `errored = 0`. Output: "── done: 0 scenarios, 0 hard failures …" and exit 0. `writeReports([])` even emits "_None — all deterministic invariants held._". A mistyped `--site`/`--ids` (or a future code change that drops a `Site` value from `SCENARIOS`) silently tests nothing and is indistinguishable from a real green.
- **Impact**: An operator believes the suite ran and passed when it executed zero model calls. Combined with #1, the harness can exit 0 while exercising nothing — the most dangerous false confidence in a compliance-sensitive eval.
- **Fix sketch**: After `applyFilters`, if `scenarios.length === 0` print an error and `process.exit(2)`. Also validate that every requested `--ids` token matched a known scenario (warn/fail on unknown ids).

## 3. No-engine run exits 0 even though no model was ever exercised
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: false-green / fallback masking
- **File**: scripts/llm-eval/run.ts:79, 88-100 + engine.ts:24-37 + config.ts:25-34
- **Scenario**: This very checkout has no `GEMINI_API_KEY` and, if `LLM_ENGINE` is unset, `getLlm()` returns `null`. Every scenario takes the `if (!llm)` branch: `source: "mock"`, no `generate()` call. None of these *throw*.
- **Root cause**: A null engine is a successful "mock" path, not an error, so `errored` stays 0 and (per #1) the exit is 0. The `real-engine` gate hard-FAILs on each scenario, and several site gates fail vacuously against `result: {}` — but none of that touches the exit code. The harness's stated guarantee ("a green run proves the model actually answered") holds for the Playwright specs (which assert `source === EXPECTED_SOURCE`) but NOT for this offline runner, which has no equivalent assertion gating its exit.
- **Impact**: `npm run eval:llm` with a forgotten `LLM_ENGINE` runs all 30 scenarios entirely on the template, prints a wall of failures, and still exits 0 — looking like a pass to any caller that checks `$?`. Tests the harness wiring, never the model.
- **Fix sketch**: Resolve the engine once at startup; if `getLlm()` is null, exit non-zero with "no engine configured — set LLM_ENGINE=claude or GEMINI_API_KEY" (smoke.ts already does exactly this with `exit(2)` — the main runner should too). Fixing #1 also covers it via the `real-engine` fails.

## 4. `--repeat` re-tags only the id, so duplicate-id collisions corrupt a stability run
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: harness correctness / mutation
- **File**: scripts/llm-eval/run.ts:282-289, 276-277
- **Scenario**: `--ids Q10 --repeat 5` (the documented stability flow), or any `--repeat N` over the full set.
- **Root cause**: Per pass the runner does `{ ...s, id: \`${s.id}#${pass}\` }`. `Number(argv[ri+1]) || 1` means `--repeat 0` and `--repeat -3` silently coerce to 1 (the `Math.max(1, …)` then also clamps), so a "0 passes" request quietly runs once — a stability run that swallows its own argument. More importantly, the displayed id is the ONLY thing made unique; the underlying `scenario.title`/`intent` collide, and `writeReports` keys per-scenario sections by `scenario.id` only in the heading — fine — but the run loop pushes every pass into one flat `records`, so the headline "Scenarios: N" double-counts passes (30 scenarios ×5 reported as 150 "scenarios"), misrepresenting coverage in report.md.
- **Impact**: Stability runs over-report scenario count and silently accept a malformed `--repeat`, so the variance measurement the EVALUATION.md F2 finding relies on can be quietly wrong (e.g. a `--repeat foo` typo → one pass, presented as the stability result).
- **Fix sketch**: Reject non-positive/NaN `--repeat` with an error instead of coercing to 1; in the report distinguish "passes" from "distinct scenarios" (e.g. `Scenarios: 30 ×5 passes`); consider keying detail blocks by tagged id to avoid heading collisions when `repeat === 1` is later relaxed.

## 5. `guidance-concise` sentence gate is fooled by abbreviations / decimals → wrong verdict
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: gate heuristic / scoring math
- **File**: scripts/llm-eval/gates.ts:69-75 + adjudication-gates.ts:201-203 (`sentenceCount`)
- **Scenario**: G01/G02/G04 guidance answers that legitimately write "Form I-129", "U.S. employer", "e.g.", "8 C.F.R.", or "section 214.2(o)" — all common in immigration prose.
- **Root cause**: `sentenceCount` splits on `/(?<=[.!?])\s+/`, counting every period+space as a sentence boundary. "U.S. employer", "e.g. the", "8 C.F.R. § ..." and an enumerated "1. ... 2. ..." each inflate the count. A concise 4-sentence answer containing two such abbreviations reads as 6+ and trips the WARN (or, past 10, the hard FAIL `guidance-concise`). Conversely a run-on with no terminal punctuation under-counts. The gate's "3–6 sentences" verdict is therefore systematically biased by formatting that is correct petition style.
- **Impact**: Spurious `guidance-concise` warns/fails on perfectly good guidance, eroding trust in the gate and (via #1, if the FAIL branch trips) potentially the only signal a reviewer reads. A heuristic that mis-fires on the domain's own vocabulary is noise dressed as a deterministic check.
- **Fix sketch**: Pre-mask known abbreviations (`U.S.`, `e.g.`, `i.e.`, `No.`, `Inc.`, single-letter initials, `C.F.R.`, `§`-anchored cites, leading "N." list markers) before splitting, or count sentences via a tokenizer that ignores abbreviation-internal periods; widen the band tolerance and demote the >10 case from FAIL to WARN since length is a style signal, not a compliance invariant.
