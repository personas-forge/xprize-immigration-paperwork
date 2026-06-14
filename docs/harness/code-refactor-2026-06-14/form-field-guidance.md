# Code Refactor Scan — USCIS Form-Field Guidance

> Total: 5 (C0 / H2 / M2 / L1)

## 1. `index.ts` barrel re-exports are dead — only `FieldGuidancePanel` is consumed through it
- **Severity**: high
- **Category**: dead-code
- **File**: src/features/guidance/index.ts:2-11
- **Scenario**: The barrel re-exports `DisclaimerStamp`, `DISCLAIMER`, `buildGuidancePrompt`, `buildGuidanceResponse`, `mockGuidance`, `parseGuidanceRequest`, `GuidanceRequest`, `GuidanceResponse`. A maintainer assumes `@/features/guidance` is the public surface and keeps these exports in sync.
- **Root cause**: Every consumer except `CaseFileDashboard` deep-imports instead of using the barrel. `@/features/guidance` (bare) is imported in exactly ONE place (`src/features/case-file/components/CaseFileDashboard.tsx:6`), and it pulls only `FieldGuidancePanel`. The pure-logic exports are imported from `@/features/guidance/guidance` (route.ts, lib/ai/operation.ts, rfe/evidence/qualification/drafting, tests); `DisclaimerStamp` from `@/features/guidance/components/DisclaimerStamp`.
- **Impact**: The 8 non-`FieldGuidancePanel` re-export lines are never resolved through the barrel — dead re-export surface that invites drift and falsely advertises a public API.
- **Verification**: `grep 'from "@/features/guidance"'` (bare path, no trailing segment) → 1 hit (CaseFileDashboard, FieldGuidancePanel only). `grep` for each named symbol shows all other importers use deep paths. No dynamic import of the barrel exists.
- **Fix sketch**: Reduce `index.ts` to `export { FieldGuidancePanel }` only, OR adopt the barrel everywhere and remove the deep imports. Pick one convention; current state is the worst of both.

## 2. Shared `DisclaimerStamp` / `CitationNote` primitives are misplaced inside the `guidance` feature
- **Severity**: high
- **Category**: structure
- **File**: src/features/guidance/components/DisclaimerStamp.tsx, src/features/guidance/components/CitationNote.tsx
- **Scenario**: A developer working on drafting, RFE, qualification, or the sign-up consent flow needs the not-legal-advice stamp and reaches across feature boundaries into `guidance`.
- **Root cause**: These are cross-cutting compliance primitives, but they live under one feature. `DisclaimerStamp` is deep-imported by `drafting/DraftStudio.tsx`, `rfe/RfeStudio.tsx`, `qualification/QualifyPanel.tsx`, `qualification/CriteriaReport.tsx`, and `components/ConsentForm.tsx` (a non-feature, app-level component). `CitationNote` by `drafting/DraftStudio.tsx` and `rfe/RfeStudio.tsx`. Neither is used uniquely by guidance UI more than any other feature.
- **Impact**: Feature-coupling: every feature that shows AI output now depends on `@/features/guidance/components/...`. Deleting/refactoring the guidance feature would break drafting, rfe, qualification, and sign-up. The structure misrepresents ownership of a shared UPL safeguard.
- **Verification**: `grep DisclaimerStamp` → 6 importing files across 5 features + ConsentForm; `grep CitationNote` → 2 importing features (drafting, rfe). Both confirmed used outside guidance.
- **Fix sketch**: Move both to a shared location (e.g. `src/components/legal/` next to `ConsentForm`, or `@/components/ui`). They are presentational and depend on nothing feature-specific.

## 3. `GuidanceResponse` + `buildGuidanceResponse` duplicate the canonical `Result<T>` / `wrapResult`
- **Severity**: medium
- **Category**: duplication
- **File**: src/features/guidance/guidance.ts:23-28,144-150
- **Scenario**: A new AI feature follows `guidance` as a template and hand-rolls its own envelope type + wrapper instead of using the shared one.
- **Root cause**: `@/lib/result.ts` (ADR-0011) already defines `Result<T>` ( `data` + `disclaimer: string` + `source: ModelSource`) and `wrapResult<T>(data, source)` as the single disclaimer chokepoint. `GuidanceResponse` re-declares the same shape (renaming `data`→`guidance`) and `buildGuidanceResponse` re-implements `wrapResult` (`{ guidance: guidance.trim(), disclaimer: DISCLAIMER, source }`). The route already imports `DISCLAIMER` only via guidance's re-export, and the orchestrator (`executeAiOperation`) is the real disclaimer owner.
- **Impact**: Two parallel response-envelope abstractions for one concern; the "single chokepoint" goal of `wrapResult` is undermined. Field-rename (`guidance` vs `data`) blocks reuse of any generic `Result<T>` helper.
- **Verification**: Read both modules. `Result<T>` shape and `wrapResult` confirmed in `lib/result.ts:21-49`; `GuidanceResponse`/`buildGuidanceResponse` confirmed used by route.ts and FieldGuidancePanel.tsx. The `.trim()` in `buildGuidanceResponse` is the only behavioral extra over `wrapResult`.
- **Fix sketch**: Type `GuidanceResponse = Result<string>` with `guidance` aliased, or have `buildGuidanceResponse` delegate to `wrapResult(guidance.trim(), source)` and remap the key. At minimum, document why guidance needs its own envelope rather than the canonical one.

## 4. `ATTORNEY_DISCLAIMER` is a second hardcoded disclaimer string outside the canonical home
- **Severity**: medium
- **Category**: duplication
- **File**: src/components/ConsentForm.tsx:16-20
- **Scenario**: Legal updates the not-legal-advice wording in `@/lib/result.DISCLAIMER` but the sign-up consent stamp keeps the old text because it has its own copy.
- **Root cause**: `ConsentForm` defines a local `ATTORNEY_DISCLAIMER` constant covering the same UPL / attorney-of-record / not-legal-advice ground as the canonical `DISCLAIMER`, then renders it through the shared `DisclaimerStamp`. Two source-of-truth strings for one compliance message.
- **Impact**: Compliance drift risk on a UPL-sensitive product: the two disclaimers can diverge silently. The shared `@/lib/result` was created precisely to be the single home for this string.
- **Verification**: `grep ATTORNEY_DISCLAIMER` → defined and used only in ConsentForm.tsx; wording overlaps `DISCLAIMER` in `lib/result.ts:37-41` but is not byte-identical (sign-up context adds "Creating an account does not form an attorney–client relationship").
- **Fix sketch**: Move the sign-up variant into `@/lib/result` (e.g. `CONSENT_DISCLAIMER`) alongside `DISCLAIMER` so all UPL strings live in one audited module; import it in ConsentForm.

## 5. Disclaimer docstring block is byte-duplicated across `guidance.ts` and `lib/result.ts`
- **Severity**: low
- **Category**: cleanup
- **File**: src/features/guidance/guidance.ts:30-37
- **Scenario**: Someone edits the "MUST accompany every AI output … UPL safeguard" comment in one file; the identical block in the other goes stale.
- **Root cause**: When `DISCLAIMER` was relocated to `@/lib/result` (ADR-0011) and re-exported from guidance.ts, the original multi-line "Do not weaken or drop this string" docstring was left attached to the re-export AND copied onto the canonical constant — the same prose now lives in both `guidance.ts:30-37` and `result.ts:30-36`.
- **Impact**: Cosmetic comment duplication; minor staleness risk on a compliance-critical note.
- **Verification**: Read both files; the comment bodies are near-identical. `DISCLAIMER` is genuinely re-exported (7 importers via guidance path), so the re-export line itself is NOT dead — only the duplicated prose is redundant.
- **Fix sketch**: On the re-export in guidance.ts, replace the copied prose with a one-line pointer ("Canonical: `@/lib/result`; re-exported for back-compat") and keep the authoritative docstring on the constant in result.ts.
