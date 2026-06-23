# Code Refactor — USCIS Form-Field Guidance
> Total: 5 (C0/H1/M2/L2)

> NOTE on FILES TO ANALYZE drift: the prompt lists `src/features/guidance/components/CitationNote.tsx`
> and `.../DisclaimerStamp.tsx`, but those files do not exist there. The guidance feature has NO
> `components/CitationNote` or `components/DisclaimerStamp`; the panel imports `DisclaimerStamp` /
> `AdjudicationBadge` from the shared `@/components/legal` barrel. The real legal primitives live at
> `src/components/legal/{CitationNote,DisclaimerStamp,AdjudicationBadge}.tsx`. I analyzed the actual
> guidance feature (`guidance.ts`, `guidance.test.ts`, `index.ts`, `components/FieldGuidancePanel.tsx`,
> `components/FieldGuidancePanel.test.ts`, `app/api/guidance/route.ts`) plus `@/lib/result` and the
> two referenced legal components. Findings below are all verified against the real tree.

## 1. `DISCLAIMER` re-export pyramid — the whole app imports a `@/lib/result` constant THROUGH the `guidance` feature
- **Severity**: High
- **Category**: structure
- **File**: src/features/guidance/guidance.ts:32 (re-export `{ DISCLAIMER }`); src/features/drafting/drafting.ts:35 (second-hop re-export)
- **Scenario**: `DISCLAIMER` is authored once in `@/lib/result` (the documented canonical home, ADR-0011, lines 30-41). `guidance.ts:20` imports it, then `guidance.ts:32` re-exports it "for back-compat." A grep `from "@/features/guidance/guidance"` shows **8 non-test modules** import `DISCLAIMER` from the guidance feature rather than from `@/lib/result`: `lib/ai/operation.ts`, `lib/llm/adjudication-gates.ts`, `features/drafting/drafting.ts`, `features/qualification/jurisdictions.ts`, `features/rfe/rfe.ts`, `features/evidence/evidence.ts` (+ 2 test files). Worse, `drafting.ts:35` then does `export { DISCLAIMER };` AGAIN, so the chain is `@/lib/result` → `guidance` → `drafting` → consumers — a multi-hop re-export of a single string. None of these consumers (`evidence`, `qualification`, `rfe`, `ai/operation`) have anything to do with the guidance feature; they reach through it purely because the constant USED to live there.
- **Root cause**: ADR-0011 relocated the constant to `@/lib/result` but left a back-compat re-export in `guidance.ts` and never migrated callers. The re-export was meant as a temporary bridge; it became the de-facto import path.
- **Impact**: Unrelated features have a phantom structural dependency on `guidance`. Anyone deleting/renaming the guidance feature, or reading the import graph to understand coupling, is misled into thinking `evidence`/`rfe`/`qualification` depend on guidance. The "canonical home" docstring in `result.ts` is contradicted by actual import behavior, so the SSoT claim is cosmetic.
- **Fix sketch**: Codemod the 8 modules to `import { DISCLAIMER } from "@/lib/result"`, drop `export { DISCLAIMER };` from both `guidance.ts:32` and `drafting.ts:35`, then keep `wrapResult`/`DISCLAIMER` imported from `@/lib/result` directly where guidance internally needs it (it already does, line 20). One mechanical pass; tests already import from both homes so coverage is intact.

## 2. Mid-file `import` breaks the established pure-module convention
- **Severity**: Medium
- **Category**: structure
- **File**: src/features/guidance/guidance.ts:20
- **Scenario**: In `guidance.ts` the file docstring (1-12) is followed by `interface GuidanceRequest` (14-18), and ONLY THEN the `import { wrapResult, DISCLAIMER, type Result } from "@/lib/result"` at line 20. The two sibling pure modules in the same `features/` family put imports immediately after the docstring at the top: `features/rfe/rfe.ts:18` and `features/drafting/drafting.ts:19` both open with the import block before any declarations. `guidance.ts` is the odd one out — its sole import is buried between two type/value declarations.
- **Root cause**: The interface was likely the original first export; the `@/lib/result` import was added later (during the ADR-0011 move) and dropped in beside the first place it was needed instead of being hoisted to the top.
- **Impact**: Reader friction and an inconsistent feature layout — a maintainer scanning for the module's dependencies has to read past a declaration to find the import. Diverges from the project's own twin modules, weakening the "all pure feature modules look alike" invariant the docstrings advertise.
- **Fix sketch**: Hoist line 20's `import` to immediately below the closing `*/` of the docstring (above `interface GuidanceRequest`), matching `rfe.ts`/`drafting.ts`. Pure mechanical move, zero behavior change.

## 3. `buildGuidanceResponse` re-spreads the envelope field-by-field instead of `{ ...rest, guidance }`
- **Severity**: Medium
- **Category**: structure
- **File**: src/features/guidance/guidance.ts:144-150
- **Scenario**: `buildGuidanceResponse` calls `wrapResult(...)` → `{ data, disclaimer, source }`, then manually reconstructs the envelope: `return { guidance: wrapped.data, disclaimer: wrapped.disclaimer, source: wrapped.source };`. It hand-copies `disclaimer` and `source` one property at a time purely to rename `data` → `guidance`. The `GuidanceResponse` type (line 28) is literally `Omit<Result<string>, "data"> & { guidance: string }` — i.e. "everything from the envelope except `data`, plus `guidance`."
- **Root cause**: Renaming one envelope key was done by enumerating all keys rather than destructuring-and-spreading the remainder.
- **Impact**: If `Result<T>` ever gains a fourth envelope field (e.g. a `model` or `requestId`), `wrapResult` and the type would carry it but `buildGuidanceResponse` would silently DROP it — the manual spread only forwards the three keys it knows about. The construction is coupled to the exact current shape of `Result`, defeating the point of the `Omit<…>` type. Low-grade divergence risk on a compliance-critical factory.
- **Fix sketch**: `const { data, ...rest } = wrapResult(guidance.trim(), source); return { ...rest, guidance: data };` — future-proof against new envelope fields and removes the per-field copy. Behavior-identical for the current three keys; `guidance.test.ts:68` still passes.

## 4. Double `as unknown as` cast to launder the `build` return type
- **Severity**: Low
- **Category**: cleanup
- **File**: src/app/api/guidance/route.ts:71-75
- **Scenario**: The `build` callback returns `buildGuidanceResponse(guidance, source as Parameters<typeof buildGuidanceResponse>[1]) as unknown as Record<string, unknown>`. Two stacked casts: `source` is cast into the `ModelSource` union, then the whole `GuidanceResponse` is double-cast (`as unknown as Record<string, unknown>`) to satisfy the orchestrator's `Record<string, unknown>` slot. A `GuidanceResponse` is already an object assignable to `Record<string, unknown>`; the `as unknown` step exists only to silence the structural check.
- **Root cause**: `executeAiOperation`'s `build` is typed to return `Record<string, unknown>`, so a concrete interface needs widening. The author reached for the blunt `as unknown as` escape hatch rather than a structural widen.
- **Impact**: `as unknown as` is the strongest type-safety override TypeScript offers and disables ALL checking at that boundary — if `buildGuidanceResponse`'s return shape ever drifts (e.g. the fix in finding #3 is botched), the compiler won't catch a mismatch here. On the route that carries the UPL disclaimer contract, an un-checked cast is the wrong place to be lax.
- **Fix sketch**: Widen with a single safe cast: drop `as unknown` and rely on `GuidanceResponse` already structurally satisfying `Record<string, unknown>` (it does — all keys are `string`-keyed). If the generic still complains, prefer `satisfies Record<string, unknown>` or type `build` to accept the concrete envelope rather than laundering through `unknown`.

## 5. Decorative-counter comment over-explains; reads as stale rationale
- **Severity**: Low
- **Category**: cleanup
- **File**: src/features/guidance/components/FieldGuidancePanel.tsx:178-182
- **Scenario**: The character-counter `<span>` carries a 2-line inline comment — "Visible counter; the cap itself is enforced by maxLength (which AT already announces), so the counter is decorative." — justifying the `aria-hidden` on a one-line `{situation.length} / {MAX_FIELD}` counter. The `textarea` right below it already has `maxLength={MAX_FIELD}` (line 189). The comment restates what `aria-hidden` + `maxLength` already express in code, and reads like leftover a11y-review rationale rather than guidance a future editor needs.
- **Root cause**: A11y review note left inline as a comment instead of being captured in the PR/commit; the self-evident `aria-hidden` attribute makes the prose redundant.
- **Impact**: Cosmetic clutter on a component that is otherwise dense; the comment is the kind of "explains the obvious attribute" note that drifts out of date (e.g. if the counter later becomes a live region the comment would be actively wrong). Minor reader noise, no functional effect.
- **Fix sketch**: Trim to a one-liner or delete — `aria-hidden` + the adjacent `maxLength` already communicate intent. If kept, shorten to `{/* decorative — cap enforced by maxLength below */}`.
