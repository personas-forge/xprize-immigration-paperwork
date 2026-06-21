# LLM Evaluation Harness — Feature Scout + Ambiguity Guardian

> Context #17 · Group: AI Infrastructure & Evaluation
> Total: 5 findings

## 1. Harness scores `qualify` at default temperature while production runs `temperature: 0`
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `scripts/llm-eval/run.ts:80` (and the qualify branch at `:101`)
- **Observation**: `execute()` builds one shared options object `const opts = { json: true, tier: "fast" as const }` (run.ts:80) and the `qualify` branch calls `llm.generate(prompt, opts)` (run.ts:101) with **no `temperature`**. But the real product route passes `temperature: 0` — `src/app/api/qualify/route.ts:56` and `src/app/api/qualify/best-path/route.ts:48` both send `{ json: true, tier: "fast", temperature: 0 }` because (their comment says) "a screening should be as deterministic as the engine allows." `GenerateOptions.temperature` is plumbed through `callGemini` (engine `engines.ts:95`). So on Gemini the harness exercises a *different, higher-variance* sampling configuration than the code users actually hit. EVALUATION.md's whole F2/stability story (the `--repeat` flake hunt on Q10) is measured under the wrong temperature, and the eval can report instability that production has already damped — or miss it.
- **Proposal**: Make `execute()` mirror each route's real `GenerateOptions`. Minimum: give the `qualify` branch `{ json: true, tier: "fast", temperature: 0 }` to match `route.ts`. Better: factor the per-site options into one table shared by the routes and the harness (the README already enumerates the six sites + tiers) so the call config can never silently diverge again.
- **Value / Risk-if-ignored**: The harness is the CI safety net for a screening tool whose biggest risk (per the project's own docs) is unstable scoring on thin profiles. Testing it under a temperature the product never uses means the gate's pass/fail and its `--repeat` variance numbers don't describe shipped behavior — a regression that loosens screening determinism could pass eval, and a "flake" the eval flags may be a harness artifact. (Claude CLI has no temperature knob, so this bites only the production Gemini engine — which is exactly the default in prod.)
- **Effort**: S

## 2. No regression baseline / golden-file diff — every run overwrites the only record
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `scripts/llm-eval/run.ts:212` (`writeReports`)
- **Observation**: `writeReports` writes `out/report.md` and `out/results.json` with `writeFileSync` every run (run.ts:216, 269), and the README says `out/` is git-ignored. There is no committed baseline, no golden file, and no diff: a run only knows "did any FAIL gate trip *this time*" (run.ts:353). The rich `expect` oracle in scenarios.ts catches gross violations, but a slow drift — a criterion that used to score Strong now scoring Partial, a likelihood band creeping, a section that used to ground cleanly now emitting a WARN — leaves zero trail because last run's `results.json` was clobbered. EVALUATION.md even documents run-to-run differences ("run 1 did *not* over-score… run 2 did") with no mechanism to detect that automatically.
- **Proposal**: Add a committed baseline (e.g. `scripts/llm-eval/baseline.json` capturing per-scenario gate verdicts + likelihoods/buckets) and a `--check-baseline` mode that diffs the current run's verdict map against it, printing added/removed/changed gates and failing CI on regressions (with a `--update-baseline` to bless intended changes). Stochastic ops can compare verdict *categories* (pass/warn/fail) rather than exact prose.
- **Value / Risk-if-ignored**: Turns the harness from a point-in-time pass/fail into an actual regression gate — the difference between "the suite is green" and "nothing got worse since we last looked." Without it, prompt edits and model upgrades silently degrade quality between the coarse FAIL invariants.
- **Effort**: M

## 3. No per-scenario cost / token / latency tracking, so model upgrades have no budget signal
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: user_benefit
- **File**: `scripts/llm-eval/engine.ts:24` and `scripts/llm-eval/run.ts:166`
- **Observation**: The harness captures wall-clock `durationMs` per scenario (run.ts:167) and prints it, but nothing else about cost. The shared engine layer *already returns* usage-bearing data — `callGemini` returns a `GeminiCall` with `latencyMs` and the raw SDK `response` object (engines.ts:76–101, the comment notes `response` exists "for usage extraction") — but `engine.ts`'s `getLlm()` throws all of it away, returning only `(await callGemini(...)).text` (engine.ts:31). For a product whose token-economy meters every AI op (the README maps each site to a token cost: draft=12, rfe=5, qualify=3…), the eval has no view of whether a prompt change or a model swap moves real token consumption.
- **Proposal**: Have `engine.ts` surface token usage (read it off the Gemini `response.usageMetadata`; estimate for the Claude CLI from a tokenizer or char heuristic), record `promptTokens`/`outputTokens`/`estCostUsd` per `RunRecord`, and add a cost roll-up to `report.md` (total + per-site + worst offenders). Tie it to the per-op token prices already in the README so a regression that doubles draft length shows up as a budget delta, not just slower output.
- **Value / Risk-if-ignored**: Cost is a first-class quality axis for a metered SaaS — a prompt tweak that improves a gate but triples output tokens is a net loss the current harness can't see. Cheap to add because the usage data is already flowing through the shared engine and just being discarded.
- **Effort**: M

## 4. `guidance-concise` gate thresholds are unexplained magic numbers with a hidden double standard
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: code_quality
- **File**: `scripts/llm-eval/gates.ts:69`
- **Observation**: `guidanceGates` hard-FAILS when `n === 0 || n > 10` and WARNs when `n < 3 || n > 6`, detailing "(prompt asks 3–6)". So the *prompt* contract is 3–6 sentences, but the *hard* gate only fails above 10 — a 9-sentence answer (50% over the documented max) merely warns and still passes CI. The `10` and the `3–6` band appear nowhere else and carry no recorded rationale for the gap between "asked" and "enforced." Relatedly, the abbreviation masking that feeds `sentenceCount` (`src/lib/llm/adjudication-gates.ts:205`, `ABBREVIATIONS`) is a fixed allowlist that omits petition-common forms — `Ph.D.`, `Jr.`, `Sr.`, `Prof.`, `Esq.`, month abbreviations — so those still inflate the count and could tip a clean answer from pass→warn (the count is a soft signal, so it doesn't breach the gate, but it muddies the metric the gate reads).
- **Proposal**: Name the thresholds as documented constants with a one-line rationale (why FAIL only at >10 vs. the 3–6 contract — is the slack intentional tolerance for the model, or should FAIL track the contract?). Extend the `ABBREVIATIONS` list with the petition-prose forms above. (NOTE: the prior NUL-byte concern is RESOLVED — `maskNonTerminalPeriods` does a length-preserving dot→space replace, no NUL; this finding is the *threshold ambiguity*, not a re-open of that.)
- **Value / Risk-if-ignored**: An undocumented gap between the contract (3–6) and the hard gate (>10) means "concise" is enforced at half-strength with no recorded decision; a future editor can't tell if tightening it would be a fix or a false-alarm storm. Low blast radius (soft gate) but it's exactly the kind of unrecorded threshold that erodes trust in the suite.
- **Effort**: S

## 5. `--repeat` runs stability passes but never computes flake/variance — disagreement is invisible
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: feature
- **File**: `scripts/llm-eval/run.ts:328` (the repeat loop) and `writeReports` at `:212`
- **Observation**: `--repeat N` re-runs each scenario N times, tagging ids `Q10#1, Q10#2…` (run.ts:331), and the summary correctly reports coverage as "`scenarios ×N passes`" rather than inflating the count (run.ts:342). But every pass is pushed into a flat `records[]` and `writeReports` treats `Q10#1` and `Q10#2` as unrelated scenarios — there is **no grouping back by base id and no variance computation**. The one thing `--repeat` exists to measure (does this scenario's verdict change across passes?) is left for a human to eyeball across N report sections. EVALUATION.md describes doing exactly this manually ("3/3 stability passes had 0 hard failures").
- **Proposal**: Group records by base id (strip the `#k` suffix), and in `report.md` emit a stability section: per scenario, the distribution of each gate's verdict across passes and a `flaky: true` flag when any gate disagrees pass-to-pass (e.g. `Q10 qualify-grounding-negative: 4 pass / 1 fail → FLAKY`). Optionally exit non-zero on flake when a `--fail-on-flake` flag is set, so determinism regressions on screening ops are caught in CI.
- **Value / Risk-if-ignored**: Flake detection on a metered, UPL-sensitive screening tool is a real quality gate — a criterion that scores Met on 1 of 5 runs is a latent compliance hazard the current harness silently averages away. The mechanism (repeated passes) already exists; only the analysis is missing, so this is low-cost high-leverage.
- **Effort**: M
