/**
 * `withGuards` — a structural decorator over the {@link Llm} surface that applies
 * deterministic output guardrails to every `generate()` call ONCE, instead of
 * repeating the same guard block inline in each engine (ADR-0008).
 *
 * It preserves the wrapped engine's `name`, forwards `generate(prompt, opts)`
 * unchanged, then runs `lt.trackGuard(output, rules, { name: "llm-output" })` on
 * the result and warns on a violation. Guards are NON-BLOCKING: the output is
 * always returned byte-for-byte regardless of the verdict — no caller contract
 * changes. If the inner `generate` rejects (e.g. the Claude CLI fails) the guard
 * does NOT run and the rejection propagates unchanged; each engine keeps its own
 * error tracking.
 *
 * WHY NON-BLOCKING / OBSERVABILITY-ONLY (recorded contract): this guard layer is
 * deliberately NOT the place JSON validity is enforced. Each JSON route's
 * `spec.guard` (qualify/draft/rfe/categorize) runs `extractJson` and returns null
 * on malformed/garbled output, which the orchestrator turns into reclaim + mock
 * (operation.ts) — i.e. structural validity is enforced DOWNSTREAM, per route,
 * where the typed shape is known. So a JSON route emitting a prose refusal or a
 * truncated `{` IS caught (at `spec.guard`), just not here; this layer only emits
 * a length/non-empty telemetry signal and never influences the reclaim decision.
 *
 * The shared `LightTrack` instance is INJECTED (not imported by this module) so
 * the score's `source` attribution stays identical to the pre-decorator inline
 * call (`scored_by: "guard:gemini"`) and the decorator is unit-testable with a
 * stub tracker. See ADR-0008 for the three-arg rationale.
 */
import type { GuardRules, LightTrack } from "@/lib/lighttrack";
import type { Llm } from "./engines";

/**
 * The single output guard applied to every LLM engine: non-empty, bounded
 * length. This is a DELIBERATE subset — the vendored `guard()` engine
 * (`lib/lighttrack.ts`) also supports `json`/`jsonKeys`, `mustInclude`/
 * `mustMatch`/`mustNotMatch`, `maxWords`, and `noPII` (+ its PII regexes), but
 * the app opts into length checks only. Those richer branches are therefore
 * unexercised in this codebase by design (not a coverage gap, and not prunable
 * — lighttrack is vendored, kept in sync with upstream). In particular the
 * vendored `json`/`jsonKeys` branch is SUPERSEDED for THIS app by `extractJson`
 * (`lib/llm/json.ts`), the tolerant fences+balanced-brace parser each JSON
 * route's `spec.guard` runs; the vendored strict `JSON.parse` is too strict for
 * prose-wrapped model output and stays inert here. To harden, e.g. add
 * `json: true, jsonKeys: ["sections"]` here or pass a per-route rule to
 * `withGuards`; that turns the dormant branches into used code.
 *
 * `maxChars: 50000` is a FLAG ceiling (telemetry only, non-blocking — see
 * `withGuards`), chosen as comfortable headroom over the longest legitimate
 * output: a full `tier:"long"` petition letter is multiple heading/body sections
 * totalling ~10-20k chars, so 50k flags a runaway/looping response without ever
 * tripping on a real long letter. Because it only warns (never truncates or
 * blocks), a rare legitimate >50k output is still returned intact.
 */
export const LLM_OUTPUT_GUARD: GuardRules = { minWords: 1, maxChars: 50000 };

/**
 * Wrap an {@link Llm} so every `generate()` result is validated against `rules`
 * via the injected `lt` tracker. Returns a new `Llm`; the original is untouched.
 */
export function withGuards(llm: Llm, rules: GuardRules, lt: LightTrack): Llm {
  return {
    name: llm.name,
    async generate(prompt, opts) {
      const output = await llm.generate(prompt, opts);
      const g = lt.trackGuard(output, rules, { name: "llm-output" });
      if (!g.ok) console.warn("[llm] output guard flagged:", g.violations.join("; "));
      return output;
    },
  };
}
