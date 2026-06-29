# Code Refactor — LLM Engine & Observability
> Total: 5
> Critical: 0 | High: 0 | Medium: 3 | Low: 2

_Scope note: all five 2026-06-23 findings are fixed in current code (telemetry `withTelemetry` decorator extracted, `DEFAULT_CLAUDE_MODEL` const, `guards.ts` note tightened, `Llm` now imported from `./engines`, the `lt` source-attribution comment corrected). The Tiger warn-once area (`warnLongTierFallbackOnce` + `isLongTierOnFastFallback`) is clean — wired, tested, no leftover debug logging. `extractJson` is defined ONCE (`json.ts`) and imported by drafting/rfe/qualification/evidence — no duplicate definition (the only "other" JSON path is the vendored guard's strict `JSON.parse`, already documented as superseded). No TODO/console.log/commented-out code in `src/lib/llm`. The findings below are the residue._

## 1. `cost-telemetry.ts` reimplements the vendored LightTrack client's event-tracking, and its header comment misdescribes `lib/lighttrack.ts`
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/cost-telemetry.ts:6 (comment) + :43-60 (`post`) + :63-80 (`trackLlm`); src/lib/lighttrack.ts:228-260 (`track`) + :310-328 (`post`)
- **Scenario**: `cost-telemetry.trackLlm` POSTs to `/v1/events` with `{ provider, model, usage: { input, output }, latency_ms, status, metadata }` (line 72-79). The vendored `LightTrack.track` (lighttrack.ts:228-260) POSTs the SAME `/v1/events` with the SAME `{ provider, model, usage: { input, output }, latency_ms, status, … }` shape. Both modules also carry their own near-identical fire-and-forget `post()` — `fetch` + `AbortController` + 2000 ms timeout + swallow-errors + `clearTimeout` in `finally` (cost-telemetry.ts:43-60 vs lighttrack.ts:310-328). So the LightTrack `/v1/events` event contract is hand-maintained in two places. On top of that, the cost-telemetry header comment (line 6) asserts `lib/lighttrack.ts` "is our own first-party *funnel* analytics — unrelated name collision." That is false: `lib/lighttrack.ts`'s own header says it is "VENDORED from LightTrack … fire-and-forget LLM event ingestion," and `guards.ts` uses its `trackGuard` to POST guard SCORES to the SAME LightTrack `/v1/scores`. The two modules are the same observability service, not unrelated.
- **Root cause**: `cost-telemetry.ts` was forked off the vendored client to add `AsyncLocalStorage` billing attribution (`runWithBilling`/`metadata.customer_id`) that can't be edited into the vendored file. `client.ts:142-143` confirms the migration ("the old SDK-client `lt.track` path was removed"). The fork was justified, but the event-shaping/POST was copied rather than shared, and the explanatory comment drifted to a wrong description of the sibling module.
- **Impact**: A maintainer reading line 6 concludes the two LightTrack modules are unrelated and may double-emit or fail to keep the `/v1/events` shape aligned across them. Any change to the event contract (a new field, a renamed `usage` key) must be edited in both `trackLlm` and `LightTrack.track` or the gemini/claude cost feed silently diverges from the guard-score feed.
- **Fix sketch**: Cheap win — correct line 6 to state `lib/lighttrack.ts` is the vendored LightTrack client (events + scores + `guard`), and that cost-telemetry is a deliberate fork ONLY to add ALS billing metadata. Larger (optional): have `trackLlm` delegate the `/v1/events` shaping + POST to a module-level `LightTrack` instance, passing `metadata` through `TrackOptions`, so the event contract and the fire-and-forget POST live once (the vendored client already accepts `metadata`).

## 2. Success-path telemetry is still duplicated across `geminiClient` and `claudeClient`
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/llm/client.ts:116-126 (gemini) and :144-153 (claude)
- **Scenario**: The 2026-06-23 pass extracted the *error*-path `trackLlm` into the shared `withTelemetry` decorator (lines 75-100), but the *success*-path emission was left inline and is still written twice. Both clients hand-write `void trackLlm({ provider, model, inputTokens, outputTokens, latencyMs, status: <text>.trim() === "" ? "error" : "success" })` — including the identical "empty/whitespace output → mark `error`" rule (line 125 mirrors line 152) and the `void trackLlm({...})` fire-and-forget wrapper. The only genuine differences are the provider string, the model source, and that Gemini reads real `usageMetadata` token counts while Claude reports zeros.
- **Root cause**: `withTelemetry` was built to own the catch-path only; the success emission stayed in each `run` body because the token source differs, so the shared decorator never saw the result text needed to apply the empty→error rule centrally.
- **Impact**: The empty-output policy and the success `trackLlm` payload shape are maintained in two spots; a change (new tag, different empty-output handling, a renamed field) must be edited in both or the two engines' dashboards diverge — the same drift `withTelemetry` was introduced to prevent, half-applied.
- **Fix sketch**: Have each engine's `run` return `{ text, tokens: { input, output } }` instead of a bare string, and move the success `trackLlm` (including the `text.trim() === ""` → `error` rule) into `withTelemetry` alongside the existing catch emission. Each engine body then only produces text + token counts; the emission + empty-output policy live once.

## 3. `docs/llm-engines.md` "Adding an engine" steps predate the `engines.ts` split
- **Severity**: Medium
- **Category**: cleanup
- **File**: docs/llm-engines.md:39-43 (esp. line 41)
- **Scenario**: Step 1 reads "Implement an `Llm` in `client.ts` (a `name` + `generate`)." But the `Llm` interface and the raw engine mechanics (`callGemini`, `runClaudeCli`, `selectEngine`) now live in `src/lib/llm/engines.ts`, whose own header (engines.ts:1-18) declares it the SINGLE home for engine bodies, shared with the eval/e2e harness. `client.ts` only holds the thin per-engine factories that layer telemetry + guards. The doc never mentions `engines.ts`, so a contributor following it would add a new engine's call body to the wrong file and miss the harness-shared seam the codebase deliberately created.
- **Root cause**: The doc was written before engine mechanics were single-sourced into `engines.ts`; the extraction updated the code but not this how-to.
- **Impact**: The one place documenting the supported extension path points contributors at `client.ts` and omits `engines.ts` and `selectEngine`, re-introducing exactly the production/harness drift the split eliminated.
- **Fix sketch**: Update step 1 to "Add the raw call + `selectEngine` case in `engines.ts`, then a thin factory in `client.ts` (telemetry + guards)." Keep steps for `config.ts` (`resolveEngine`/`LlmEngine`) and `label.ts` (`ModelSource`/`sourceLabel`).

## 4. `ModelSource` redefines the `LlmEngine` union independently
- **Severity**: Low
- **Category**: consolidation
- **File**: src/lib/llm/label.ts:10 vs src/lib/llm/config.ts:7
- **Scenario**: `label.ts` declares `type ModelSource = "mock" | "gemini" | "claude"` while `config.ts` declares `type LlmEngine = "gemini" | "claude"`. `ModelSource` is exactly `LlmEngine | "mock"`, but the engine names are spelled out a second time. Adding an engine therefore means editing the union in BOTH files (plus `sourceLabel`/`isModelSource`/`asModelSource`, which also hardcode the names) — the multi-place edit the "Adding an engine" doc itself enumerates. `config.ts` is pure (no `server-only`, no Node built-ins), so `label.ts` (also client-safe) can import the type from it without coupling to server code.
- **Root cause**: `label.ts` was written to stay dependency-free; the engine union was duplicated rather than derived from the canonical `LlmEngine`.
- **Impact**: Minor — two unions to keep in sync; a new engine added to `LlmEngine` but forgotten in `ModelSource` would silently narrow to `"mock"` in `asModelSource`.
- **Fix sketch**: `import type { LlmEngine } from "./config";` then `export type ModelSource = LlmEngine | "mock";` so the engine set has one source of truth.

## 5. `isLongTierOnFastFallback` re-encodes `geminiModelFor`'s long→fast fallback condition
- **Severity**: Low
- **Category**: consolidation
- **File**: src/lib/llm/config.ts:37-40 (`geminiModelFor`) and :51-53 (`isLongTierOnFastFallback`)
- **Scenario**: `geminiModelFor` decides the long tier falls back to the fast model when `GEMINI_DRAFT_MODEL` is unset (`tier === "long" ? env.GEMINI_DRAFT_MODEL ?? fast : fast`). `isLongTierOnFastFallback` independently re-states the same condition (`tier === "long" && !env.GEMINI_DRAFT_MODEL`). The "long silently runs on the fast model" rule thus lives in two functions; if the fallback policy ever changed (e.g. long falls back to a distinct default instead of the fast model), both must be edited in lockstep or the warn-once observability (engines.ts:139-147) would lie.
- **Root cause**: The Tiger Lens-3 predicate was added next to `geminiModelFor` but expressed as a fresh boolean rather than derived from the model resolution it describes.
- **Impact**: Trivial today (the two agree), but it's a latent divergence: the predicate that warns about the fallback is not derived from the function that performs the fallback.
- **Fix sketch**: Derive it: `return tier === "long" && geminiModelFor("long", env) === geminiModelFor("fast", env);` — then the warning is provably tied to the actual model-resolution behaviour, single-sourcing the rule.
