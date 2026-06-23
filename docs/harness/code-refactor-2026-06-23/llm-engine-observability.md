# Code Refactor — LLM Engine & Observability
> Total: 5 (C0/H2/M2/L1)

## 1. Per-engine telemetry try/catch is duplicated across `geminiClient` and `claudeClient`
- **Severity**: High
- **Category**: duplication
- **File**: src/lib/llm/client.ts:62-106 (geminiClient) and src/lib/llm/client.ts:108-145 (claudeClient)
- **Scenario**: Both engine factories implement the identical scaffold: capture `const startedAt = Date.now()`, `try { const out = await <call>; void trackLlm({ provider, model, inputTokens, outputTokens, latencyMs: ..., status: out.trim() === "" ? "error" : "success" }); return out } catch (err) { void trackLlm({ ...same shape..., status: "error" }); throw err }`. The only real differences are the call (`callGemini` vs `runClaudeCli`), the provider string (`"google"`/`"anthropic"`), how `model` is derived, and that Gemini reads real `usageMetadata` token counts while Claude reports zeros. The success-`trackLlm` and the catch-`trackLlm` payloads are written out twice each (4 near-identical `trackLlm({...})` literals). Verified by reading both functions end to end; `trackLlm` is the only telemetry call on these paths (`grep "trackLlm" client.ts`).
- **Root cause**: The observability wrapper was layered per-engine inline rather than as one shared decorator/helper. (Note: `withGuards` already proves the "wrap an Llm once" pattern exists in this very module — telemetry was simply not folded into it.)
- **Impact**: Any change to the telemetry contract (a new field, a different empty-output policy, a tag) must be edited in four places and kept byte-identical, or the gemini/claude dashboards silently diverge. This is exactly the drift the `engines.ts` single-sourcing comment (lines 17-21) was written to prevent, re-introduced one layer up.
- **Fix sketch**: Extract a `trackGenerate(provider, { model, startedAt, status }, tokens?)` helper, or a `withCostTelemetry(llm, provider, modelFor)` decorator mirroring `withGuards`, so each engine body shrinks to the call + the provider/model/token specifics. The empty-output→`"error"` rule and the catch-path emission then live once.

## 2. `extractJson` vs `guard`'s inline `JSON.parse` — two parallel "is this JSON" paths
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/llm/json.ts:11-79 (extractJson/balancedObject/parseObjectAt) and src/lib/lighttrack.ts:149-164 (guard's `json`/`jsonKeys` branch)
- **Scenario**: `json.ts` is the project's tolerant JSON extractor (fences + balanced-brace scan) used by every JSON route (`grep extractJson src/` → drafting/evidence/rfe/qualification + json.test.ts). Separately, `lighttrack.ts:151-158` does a strict `JSON.parse(output.trim())` with its own `json`/`jsonKeys` verdict. Per `guards.ts:32-49` the app deliberately opts the LightTrack guard into **length checks only** (`{ minWords: 1, maxChars: 50000 }`), so the guard's `json` branch is never exercised in this codebase, while the real JSON-validity enforcement lives downstream in each route's `spec.guard` calling `extractJson` (documented in guards.ts:14-21).
- **Root cause**: `lighttrack.ts` is vendored and carries its own strict `JSON.parse` guard; the app grew a separate tolerant parser because the vendored one is too strict for prose-wrapped model output. The two coexist.
- **Impact**: Low behavioral risk (the vendored path is intentionally dormant per grounding), but a reader auditing "how does this app validate model JSON?" finds two answers and must read guards.ts's essay to learn the vendored `json` rule is inert. Conceptual duplication, not a divergence bug.
- **Fix sketch**: No code change to the vendored file (grounding: don't restructure lighttrack). The one-line cleanup is to ensure the guards.ts note explicitly states the vendored `json`/`jsonKeys` branch is superseded by `extractJson` for THIS app — it nearly does; tightening that cross-reference closes the "which one is authoritative" gap without touching either parser.

## 3. Misleading comment: shared `lt` claims "per-engine source attribution" but is hardcoded `source: "gemini"`
- **Severity**: Medium
- **Category**: cleanup
- **File**: src/lib/llm/client.ts:52-60
- **Scenario**: The comment at lines 51-53 says guards share "the module `lt` so the score's `source` attribution stays per-engine," and line 60 constructs a single `const lt = new LightTrack({ project: ..., source: "gemini" })`. That one instance is passed to `withGuards` for BOTH the gemini and claude engines (lines 54-55). Because `source` is fixed at construction, `trackGuard` always emits `scored_by: "guard:gemini"` (see lighttrack.ts:291) regardless of engine — so the guard score is NOT per-engine; the comment describes behavior the code does not produce.
- **Root cause**: Comment was likely written when an inline guard call used the engine's own name, then left stale after the refactor to a single injected `lt`.
- **Impact**: A maintainer trusts the comment and assumes claude-engine guard scores are tagged `guard:claude`; they are not. Pure documentation/clarity defect (telemetry attribution, not request behavior). Flagged as cleanup, not a bug.
- **Fix sketch**: Reword the comment to state the guard score is attributed to a single fixed `source: "gemini"` for all engines (or, if per-engine attribution is actually wanted, that's a behavior change for a different lane — out of scope here). The cleanup is to make comment and code agree.

## 4. `"sonnet"` default literal duplicated within `claudeModel`
- **Severity**: Low
- **Category**: duplication
- **File**: src/lib/llm/config.ts:48-51
- **Scenario**: `claudeModel` writes the default model string `"sonnet"` twice on adjacent lines: line 49 `const m = env.CLAUDE_CLI_MODEL ?? "sonnet"` and line 50 `return m.replace(/.../g, "") || "sonnet"` (the post-sanitize fallback when the env value reduces to empty). The doc (docs/llm-engines.md:26) and the test (llm.test.ts:56) independently restate `sonnet` as the default.
- **Root cause**: The sanitize-or-fallback idiom naturally repeats the literal once per branch.
- **Impact**: Trivial; changing the default Claude model means editing two literals in one function (plus the doc/test). Cosmetic.
- **Fix sketch**: `const DEFAULT_CLAUDE_MODEL = "sonnet";` and reference it in both spots so the default has a single source of truth.

## 5. `Llm` type imported from `./client` instead of its definition module `./engines`
- **Severity**: Medium
- **Category**: structure
- **File**: src/lib/llm/guards.ts:29 (`import type { Llm } from "./client"`) and src/lib/llm/guards.test.ts:6 (`import type { Llm } from "./client"`)
- **Scenario**: `Llm` (and `GenerateOptions`) are DEFINED in `engines.ts:42-45`. `client.ts:42` re-exports them solely so legacy importers keep working (comment lines 40-41). `guards.ts`, a sibling in the same `llm/` folder, imports the `Llm` type through the `server-only` production wrapper `client.ts` rather than from the pure `engines.ts` where it lives — a type-only dependency on the heaviest module in the package. Verified: `engines.ts` is the canonical definition (`grep "interface Llm" src/lib/llm` → engines.ts), and the only non-client importer of `Llm` is guards.ts/guards.test.ts.
- **Root cause**: The `Llm`/`GenerateOptions` definitions were moved from `client.ts` into `engines.ts` (single-sourcing, see engines.ts:8-14) and a back-compat re-export was added; the in-package consumer `guards.ts` was left pointing at the re-export rather than re-aimed at the source.
- **Impact**: A type-only import routes through `client.ts` (with its `import "server-only"`), making the module graph for `guards.ts` look like it depends on server-only code when it only needs a type. It also obscures where `Llm` actually lives. The `client.ts` re-export exists for EXTERNAL importers (operation.ts:11 still uses it); the intra-package one should point at `engines.ts`.
- **Fix sketch**: Change `guards.ts` and `guards.test.ts` to `import type { Llm } from "./engines"`. Keep the `client.ts` re-export for `operation.ts`. Optionally update the client.ts re-export comment (lines 40-41) to drop the now-stale "guards.ts / guards.test.ts" reference.
