# Wave A — Cross-route AI plumbing duplication

Behavior-preserving consolidation of the parse / coerce / access-context /
model-source primitives that the 5–8 token-charged AI routes hand-rolled. No API
contract, error-string, status-code, or auth-semantics change.

Branch: `vibeman/code-refactor-2026-06-29`
Gates: `tsc --noEmit` clean after every commit; tests **437 → 443** passing
(6 new validation unit tests), 0 fail throughout.

## Findings closed (5)

| Report | # | Sev | What | Commit |
|---|---|---|---|---|
| evidence-vault.md | 1 | Med | JSON-object body guard duplicated verbatim across all 5 AI parsers | `d5ea5b5` |
| uscis-form-field-guidance.md | 1 | Med | Same untrusted-body guard duplicated across all 5 parsers (twin of evidence #1) | `d5ea5b5` |
| evidence-vault.md | 3 | Med | Inlined string-field coercion instead of the shared `str()` (name field) | `bc62e08` |
| evidence-vault.md | 4 | Low | `CaseAccess` literal `{ userId, email: user.email ?? null }` rebuilt by hand | `f095c84` |
| ai-operation-orchestrator.md | 1 | Med | `source as Parameters<typeof buildX>[1]` widening cast in every spec `build` | `0509b45` |

## New shared module / symbols

- **`src/lib/validation.ts`** (new; pure, client-safe — no `server-only`, no Node builtins):
  - `asObjectBody(body: unknown): Record<string, unknown> | null` — the exact historical
    `typeof body !== "object" || body === null` guard (arrays still pass through, preserved).
  - `JSON_OBJECT_BODY_ERROR` — the single-sourced `"Request body must be a JSON object."` string.
  - `str(value: unknown, max): string` — hoisted from `@/features/drafting/criteria-text`
    (which now re-exports it, so its draft/RFE/forecast/critique importers are unchanged).
- **`src/lib/data/adapters/access.ts`**: `caseAccessFor(user: { id; email? }): CaseAccess` —
  the owner-or-attorney `email ?? null` context constructor (owner-only `email: null` paths untouched).
- **`src/lib/ai/operation.ts`**: `OperationLlm.name`, the orchestrator's `source` variable,
  and `AiOperationSpec.build/adjudicate/persist`'s `source` param are now `ModelSource`
  (from `@/lib/llm/label`) instead of `string`.

## Commits

- `d5ea5b5` refactor(ai): single-source the JSON-object body guard across the 5 AI parsers
- `bc62e08` refactor(ai): hoist shared `str` coercion to @/lib/validation; use it in evidence
- `f095c84` refactor(ai): add caseAccessFor() constructor; collapse the rebuilt CaseAccess literal
- `0509b45` refactor(ai): type the orchestrator `source` as ModelSource; drop 8 widening casts
- `3fbfe33` test(ai): unit-cover the shared validation helpers

## Files touched

- `src/lib/validation.ts` (new), `src/lib/validation.test.ts` (new)
- `src/features/{guidance/guidance,qualification/qualification,drafting/drafting,rfe/rfe,evidence/evidence}.ts` (guard; evidence also `str`)
- `src/features/drafting/criteria-text.ts` (str hoist + re-export)
- `src/lib/data/adapters/access.ts` (`caseAccessFor`)
- `src/features/evidence/actions.ts`, `src/app/api/evidence/categorize/route.ts`, `src/app/api/rfe/route.ts` (caseAccessFor; rfe/categorize also cast removal)
- `src/lib/ai/operation.ts`, `src/lib/ai/operation.test.ts` (ModelSource)
- `src/app/api/qualify/route.ts`, `src/app/api/guidance/route.ts`, `src/features/rfe/forecastOperation.ts`, `src/features/drafting/critiqueOperation.ts`, `src/features/drafting/draftOperation.ts` (cast removal)

## Behaviour-preservation notes

- `asObjectBody` is byte-identical to the inlined guard — **arrays still narrow through**
  (`typeof [] === "object"`). Not "fixed" (would change every parser's contract). A unit
  test pins this quirk.
- The `as unknown as Record<string, unknown>` half of each `build` cast is **kept** — it
  bridges the typed domain result to the untyped body and is a separate concern (the
  report flags making `build` generic over its return as a deferrable follow-up).
- `ModelSource` is assignable to `string`, so every downstream consumer of `source`
  (`runAdjudication`, `petitions.saveDraft/saveRfeResponse`, `evidence.addDocument`) is
  unaffected. The real `getLlm()` returns `Llm.name: LlmEngine ⊆ ModelSource`, so the
  `as OperationLlm` cast in `defaultDeps` stays valid (an upcast).
- `caseAccessFor` only replaced the `email: user.email ?? null` sites. The deliberate
  **owner-only** `email: null` literals (`/api/draft`’s `draftOperation` persist, `qualify`
  persist’s `createCase`) were left exactly as-is.

## Skipped — with reason (follow-ups)

| Report | # | Why skipped |
|---|---|---|
| evidence-vault.md | 3 (content/classification) | `str(record.content, MAX_CONTENT)` would trim+slice eagerly and make the **over-length rejection unreachable** (currently `content.length > MAX_CONTENT` → error) — a real behaviour change. The route's `classification` coercion (`typeof x === "string" ? x : "O-1A"`) does **not** trim/cap/empty-default; `str(...) \|\| "O-1A"` would change `""`/padded inputs. Both left inline. Only the genuinely-identical `name` field was converted. |
| evidence-vault.md | 2 | "resolves the case twice per categorize" — needs a new adapter method (`getCaseAndDocuments`) and changes a hot-path query shape; perf/consolidation, not pure dedup. Out of scope for a behaviour-preserving wave. |
| evidence-vault.md | 5 | Barrel re-export / unused-type dead-code — `evidence.test.ts` imports `DISCLAIMER`/`O1A_CRITERIA` from the barrel; needs a grep-gated delete + test repoint. Dead-code cleanup, not duplication. |
| ai-operation-orchestrator.md | 2 | `adjudicate` envelope (`runAdjudication({ source, result: body, … })`) — moving the call into the orchestrator changes the hook contract AND makes `operation.ts` import the adjudication engine (expanding its surface). Risky; flagged risky by the prompt. Left for a dedicated pass. |
| ai-operation-orchestrator.md | 3 | `loadCaseContext` extraction — ~25-line pre-charge sequence across rfe/draft/forecast with per-spec divergences (draft's 409 merge-base gate, owner-only flag, forecast's lighter variant). Highest-LOC but genuinely divergent; high regression risk. Follow-up. |
| ai-operation-orchestrator.md | 4 | `versionSaveResult` / `versionSaveOnPersistError` — touches the persist/`onPersistError` envelopes that the draft/save-recovery route reads (`saveFailed`); low value, behaviour-sensitive. Follow-up. |
| ai-operation-orchestrator.md | 5 | Stale `operation.ts` docstring ("five"/present-tense) — pure comment cleanup, not duplication. Noted; trivial to do in a docs pass. |
| uscis-form-field-guidance.md | 2 | `WithAdjudication<T>` type dedup across 5 **panel components** — genuine but lives in `.tsx` UI, outside the parser/spec plumbing focus. Clean type-only follow-up. |
| uscis-form-field-guidance.md | 3,4,5 | `blocked: true` dead field, "back-compat" comment, stale route header — dead-code/cleanup findings, not the duplication theme. |
