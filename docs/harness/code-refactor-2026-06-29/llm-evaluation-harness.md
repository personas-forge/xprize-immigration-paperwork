# Code Refactor — LLM Evaluation Harness
> Total: 5
> Critical: 0 | High: 0 | Medium: 3 | Low: 2

> Steered area checked — NOT re-flagged: the engine-body duplication the prompt
> asks about (`scripts/llm-eval/engine.ts` vs `src/lib/llm/client.ts`) is already
> RESOLVED. Both now import the single-sourced bodies from `@/lib/llm/engines`
> (`callGemini`/`runClaudeCli`/`selectEngine`); `e2e/engine.ts` derives its source
> from the canonical `resolveEngine()` in `@/lib/llm/config`. The harness `getLlm()`
> still mirrors the tiny engine→`{name,generate}` dispatch shape of `client.ts`, but
> that split (bare vs guarded/telemetered) is the deliberate decoupling documented
> at `engine.ts:1-13` — genuine, not accidental, so it is not flagged.

## 1. `sectionGates` reuses `letterStructureGates` by filtering its output, computing a throwaway gate
- **Severity**: Medium
- **Category**: consolidation
- **File**: scripts/llm-eval/gates.ts:269 (helper at :193-221, classification block :214-219)
- **Scenario**: `npm run eval:llm -- --site draft_section` (S01/S02/S03) — every single-section run.
- **Root cause**: `sectionGates` needs only the `*-classification-consistent` check, but reuses the whole composite `letterStructureGates(ctx, "draft")` and filters its results: `.filter((g) => g.id.endsWith("classification-consistent"))`. For a `draft_section` result `ctx.result.sections` is `undefined`, so `letterStructureGates` first computes a `draft-structure` gate over `sections = []` (`hasIntro && hasConcl` both false → a `fail`), then that gate is silently discarded by the filter. The one reusable sub-gate (classification consistency, which is genuinely shared by draft/section/rfe) is buried inside a function that also emits structure gates.
- **Impact**: Confusing reuse-by-filtering: a reader sees `letterStructureGates(…, "draft")` invoked on a *section* run and must trace the filter to realize the structure verdict is intentionally thrown away. The throwaway computation is benign today but is a latent footgun — any future side effect or counter inside `letterStructureGates` would leak into section runs. It also obscures that classification-consistency is the real cross-site invariant.
- **Fix sketch**: Extract `classificationConsistencyGate(ctx, kind)` (the `wrongCodes` block at :214-219) into its own helper; have `letterStructureGates` and `sectionGates` each call it directly. `sectionGates` then drops the `.filter(...)` and never computes a meaningless `draft-structure` gate.

## 2. `EVALUATION.md` F2b note describes a completed migration as "in-flight" and contradicts the current eval code
- **Severity**: Medium
- **Category**: cleanup (lying/stale doc)
- **File**: scripts/llm-eval/EVALUATION.md:162, :189-195 (vs scripts/llm-eval/run.ts:103-107)
- **Scenario**: A maintainer reads EVALUATION.md to understand whether the qualify eval exercises `temperature: 0`.
- **Root cause**: The F2b note says the temperature change "lives in `src/lib/llm/client.ts`, which is part of an in-flight migration; it is applied in the working tree but kept out of the eval commit to avoid entangling that work," and the summary row marks it "done (Gemini-only; see note)." That migration is finished — `client.ts` now imports the shared bodies from `@/lib/llm/engines`, and `run.ts:103-107` was later updated to explicitly send `temperature: 0` on the qualify branch ("Match PRODUCTION… send temperature: 0"). So the eval DOES now set it; the doc's "kept out of the eval commit" / "in-flight migration" framing is stale and actively misleading.
- **Impact**: A reader trusts a doc that says the eval can't/doesn't exercise the production temperature config, when the harness now does. Wastes investigation time and undermines confidence in the other (correct) findings in the same file.
- **Fix sketch**: Update the F2b note to state that `run.ts` sends `temperature: 0` on qualify to mirror production, and that only the Claude CLI path (no temperature knob) can't exercise it. Drop the "in-flight migration / kept out of the eval commit" sentence.

## 3. `smoke.ts` is obsolete build-time scaffolding, redundant with `run.ts`'s own fail-fast guard
- **Severity**: Medium
- **Category**: dead-code
- **File**: scripts/llm-eval/smoke.ts:1-32 (header :5-6; only `run.ts` is wired in package.json:14)
- **Scenario**: Onboarding/CI — there is no `npm run` entry for smoke; only `eval:llm → run.ts` exists.
- **Root cause**: The header states its purpose is to confirm two things "before we build the full harness" — the full harness (`run.ts` + `gates.ts` + 30 scenarios) is long since built. Its two checks are now subsumed: (a) `@/` alias resolution under tsx is exercised by `run.ts`'s feature-module imports on every run, and (b) "the active engine actually answers" is exercised by `run.ts`'s fail-fast `if (!getLlm()) { …; process.exit(2) }` guard plus the real scenario round-trips. It is not referenced by any npm script, CI config, or doc beyond a one-line mention in README.md:50; it survives only as a manual `npx tsx scripts/llm-eval/smoke.ts`.
- **Impact**: Dead-weight file that re-imports `getLlm` and restates connectivity logic already owned by `run.ts`; its stale "before we build the harness" comment misleads about its role. More surface to keep green when the engine/config layer changes.
- **Fix sketch**: Delete `smoke.ts` (and its README.md:50 mention). If a fast single-round-trip connectivity probe is still wanted, keep it but rewrite the header to its real purpose and add an `eval:smoke` npm script so it's a discoverable, maintained tool rather than orphaned scaffolding.

## 4. `--ids` / `--repeat` / `--site` argv parsing duplicated between `main()` and `applyFilters()`
- **Severity**: Low
- **Category**: duplication
- **File**: scripts/llm-eval/run.ts:201-212 (`applyFilters`) and :285-309 (`main`)
- **Scenario**: Any CLI invocation with `--ids`/`--site`/`--repeat`.
- **Root cause**: Flag parsing is hand-rolled with `argv.indexOf("--x") + 1` in two places. `idsArg = argv[argv.indexOf("--ids") + 1]` is computed identically at :203 (for filtering) and :298 (for unknown-id validation); `--repeat`, `--ids`, and `--site` are each re-scanned from `process.argv` rather than parsed once.
- **Impact**: Two sources of truth for the same flags; a future flag rename or quoting fix must be made in both spots or validation silently diverges from filtering. Low risk but pure boilerplate.
- **Fix sketch**: Parse argv once into `{ ids?: string[]; site?: string; repeat: number }` (a small `parseArgs(process.argv.slice(2))`), then have `main()` validate and `applyFilters()` consume that object instead of re-scanning `process.argv`.

## 5. The `"claude" | "gemini" | "mock"` source union is restated and left loosely typed
- **Severity**: Low
- **Category**: consolidation
- **File**: scripts/llm-eval/types.ts:91 (`source: string`) and e2e/engine.ts:8 (`ExpectedSource`); literals at run.ts:90,102,118,131,141,153,183,185
- **Root cause**: `GateContext.source` is documented as `"claude" | "gemini" | "mock"` (types.ts:90 comment) but typed merely as `string`, so `run.ts` sprinkles bare `source: "mock"` string literals with no compiler check. Separately, `e2e/engine.ts:8` declares `export type ExpectedSource = "mock" | "gemini" | "claude"` — the same union, restated. The canonical engine union already exists as `LlmEngine = "gemini" | "claude"` in `@/lib/llm/config`.
- **Impact**: A typo'd source literal (`"moc"`) would compile and silently break the `real-engine` gate's `ctx.source !== "mock"` comparison; the union also lives in three places (comment, `string`, `ExpectedSource`) that can drift.
- **Fix sketch**: Define `export type Source = LlmEngine | "mock"` once (in `types.ts`, importing `LlmEngine`), type `GateContext.source: Source`, and re-export it for `e2e/engine.ts` to replace its hand-written `ExpectedSource`.
