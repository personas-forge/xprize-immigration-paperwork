# Code Refactor — LLM Evaluation Harness
> Total: 5 (C0/H1/M2/L2)

## 1. Token-overlap grounding ratio duplicated across two gates
- **Severity**: High
- **Category**: duplication
- **File**: scripts/llm-eval/gates.ts:165-174 (qualify evidence-grounding) and scripts/llm-eval/gates.ts:320-326 (evidence facts-grounding)
- **Scenario**: Both gates run the same "crude token-overlap grounding" heuristic: tokenize a source string into a `Set`, then for each candidate string compute `overlappingTokens / candidateTokens` and compare to a threshold (0.34 for criterion evidence-vs-profile; 0.5 for facts-vs-document). Confirmed with `grep -n "filter((t) => " scripts/llm-eval/gates.ts` → exactly two hits (lines 172 and 325), and `grep -n "tokens(" scripts/llm-eval/gates.ts` → the same paired `tokens(source)` + `[...tokens(candidate)]` shape at lines 165/170 and 321/323. The shared `@/lib/llm/adjudication-gates` exports the `tokens()` tokenizer (verified line 69) but **no overlap-ratio helper** — so the ratio math itself is inlined twice.
  ```ts
  // line 172:  const overlap = et.filter((t) => profTok.has(t)).length / et.length;
  // line 325:  return ft.filter((t) => cTok.has(t)).length / ft.length < 0.5;
  ```
- **Root cause**: The grounding-overlap heuristic was written inline in each per-site gate rather than factored into a named helper. (Note: this is NOT the scenario-free leaf scanner that intentionally lives in adjudication-gates.ts — that module exposes `tokens` only, not a ratio helper, so consolidating the *ratio* here does not touch the single-sourcing seam.)
- **Impact**: Two copies of the same "fraction of candidate tokens present in source" logic can drift independently — a future tweak to the empty-token guard (`if (!ft.length) return false` vs `if (et.length === 0) continue`) or the ratio definition would silently apply to only one gate, making "weakly grounded" mean two different things in the same report.
- **Fix sketch**: Add one local helper in gates.ts, e.g. `function overlapRatio(candidate: string, source: Set<string>): number | null` (returns `null` for the empty-token case so each caller keeps its own continue/skip semantics), and call it from both sites with their respective thresholds. ~8 lines net removed; no behavior change.

## 2. `getLlm({ requiresImages })` parameter is dead in the eval wrapper
- **Severity**: Medium
- **Category**: dead-code
- **File**: scripts/llm-eval/engine.ts:24
- **Scenario**: `getLlm(opts: { requiresImages?: boolean } = {})` forwards `opts` to `selectEngine(opts)`, but every call site passes **no arguments**. `grep -rn "getLlm(" scripts/llm-eval e2e` → all real call sites are bare: run.ts:79 `getLlm()`, run.ts:321 `getLlm()`, smoke.ts:13 `getLlm()`. `grep -rn "requiresImages" scripts/llm-eval e2e` → the only hit is the parameter declaration itself (engine.ts:24); it is never supplied. The harness has only text scenarios (no image inputs in scenarios.ts), so the multimodal-downgrade path can never trigger here.
- **Root cause**: The eval wrapper mirrored the production `client.ts` `getLlm` signature (which legitimately uses `requiresImages` for the evidence-image path) even though the offline harness never exercises images.
- **Impact**: Misleading surface area — a reader of the harness sees an image-aware selector that is never reached, and the parameter implies a capability the eval doesn't test. Low risk, but it's pure unused config.
- **Fix sketch**: Drop the parameter: `export function getLlm(): Llm | null { const engine = selectEngine(); … }`. `selectEngine()` already defaults `opts = {}`, so the shared production behavior is unaffected. (Alternatively keep it but add a one-line comment that the harness never passes it — the deletion is cleaner.)

## 3. `"na"` verdict is declared and mapped but never produced
- **Severity**: Medium
- **Category**: dead-code
- **File**: scripts/llm-eval/types.ts:24 (and the `SYM` map at scripts/llm-eval/run.ts:69)
- **Scenario**: `Verdict = "pass" | "fail" | "warn" | "na"` includes `"na"`, documented at types.ts:22 as "the gate does not apply to this scenario," and run.ts:69 maps `na: "·"` in `SYM`. But **no gate ever emits `"na"`**: `grep -rn '"na"' scripts/llm-eval e2e` returns only the type definition (types.ts:24) — zero producers. Every gate constructs results via `r(id, "pass"|"fail"|"warn", …)` and the gates skip inapplicable checks by simply not pushing a result (e.g. `if (mustNot.length) { out.push(…) }`), so the "doesn't apply" case is represented by *absence*, not by an `na` verdict.
- **Root cause**: An early design intended an explicit not-applicable verdict; the gates instead settled on conditional `push`, leaving `na` as a vestigial member.
- **Impact**: The type permits a value the report renderer and the FAIL-counting logic in run.ts never anticipate exercising; the `SYM["na"]` entry is unreachable. Cosmetic but it widens the verdict surface and the EVALUATION.md/README tables describe only pass/fail/warn.
- **Fix sketch**: Remove `"na"` from the `Verdict` union (types.ts:24), drop the `na: "·"` entry from `SYM` (run.ts:69), and trim the `na` line from the doc comment (types.ts:22). tsc will confirm nothing references it.

## 4. `GenerateOptions` / `Llm` re-export from engine.ts has no consumers
- **Severity**: Low
- **Category**: dead-code
- **File**: scripts/llm-eval/engine.ts:22
- **Scenario**: `export type { GenerateOptions, Llm };` re-exports the two engine types. But consumers of `./engine` import only the value `getLlm`: `grep -rn 'from "./engine"' scripts/llm-eval` → run.ts:51 and smoke.ts:10, both `import { getLlm } from "./engine"`. No file imports `GenerateOptions` or `Llm` *from the eval engine* (run.ts builds its `opts` inline as `{ json: true, tier: "fast" as const }` and never annotates with these types). The types remain available from their real home `@/lib/llm/engines` for anyone who needs them.
- **Root cause**: A convenience re-export added alongside the single-sourcing refactor, never actually consumed.
- **Impact**: Dead public surface on the harness module; trivially misleading (suggests the eval is a typed facade over the engine when it only needs `getLlm`).
- **Fix sketch**: Delete line 22 and drop `type GenerateOptions` / the `type ... Llm` from the import if they become unused after removing the `requiresImages` param in finding #2 (engine.ts still needs `Llm` for the return type, so keep that import; `GenerateOptions` becomes fully unused once it's no longer re-exported). Verify with tsc.

## 5. `opts` constant and inline `{ tier: "fast" }` express the same generate config two ways
- **Severity**: Low
- **Category**: cleanup
- **File**: scripts/llm-eval/run.ts:80, 92
- **Scenario**: `execute()` defines `const opts = { json: true, tier: "fast" as const };` (line 80) and uses it for the `evidence` and `qualify` sites, but the `guidance` branch calls `llm.generate(prompt, { tier: "fast" })` inline (line 92) — same fast tier, just omitting `json` (guidance is prose, not JSON). The two ways of expressing "fast-tier call" sit a few lines apart; a reader must diff `opts` vs the inline object to see that guidance deliberately drops `json`. (This is a readability nit, not a bug — guidance correctly should not request JSON.)
- **Root cause**: `opts` was introduced as a shared default but only partially adopted; the guidance call predates or sidesteps it.
- **Impact**: Minor inconsistency that obscures the one intentional difference (guidance = no `json`). Makes the "which sites share config" question harder to answer at a glance.
- **Fix sketch**: Either inline `opts` at its two use sites for symmetry with the guidance branch (each call then self-documents its tier/json), or add a short comment at line 92 noting guidance intentionally omits `json` because it returns prose. Cosmetic; no behavior change. (Lowest-value of the five — list last.)
