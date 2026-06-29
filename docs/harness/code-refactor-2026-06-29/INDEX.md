# Code Refactor Scan — immigration-paperwork, 2026-06-29

> `code_refactor` scanner (cleanup / dead-code / duplication / structure) over **all 20 contexts**, 5 findings/context target.
> 20 parallel subagent runs, batched in waves of ≤8 (throttled to 3–4 after a transient API rate-limit cascade).
> Re-scan 6 days after the 2026-06-23 `code_refactor` pass (PR #114, 93/98 closed) + the Next 16.3-preview upgrade + Tiger fixes #115–#119.

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Across 20 contexts | 0 | 7 | 45 | 43 | **95** |
| Share | 0% | 7% | 47% | 45% | 100% |

Counts verified two ways: 95 `## N.` headings = 95 `**Severity**:` bullets. Zero criticals, High-light, Medium/Low-heavy — the expected residual-debt shape for a codebase refactored a week ago. The 7 Highs collapse to **5 distinct issues** (two are flagged from both sides).

---

## Per-context breakdown

(Sorted by High desc, then total)

| # | Context | C | H | M | L | Total | Report |
|---|---|--:|--:|--:|--:|--:|---|
| 1 | Brand & Design System | 0 | 1 | 3 | 1 | 5 | `brand-design-system.md` |
| 2 | Case File Dashboard | 0 | 1 | 3 | 1 | 5 | `case-file-dashboard.md` |
| 3 | Domain Event Bus | 0 | 1 | 2 | 2 | 5 | `domain-event-bus.md` |
| 4 | O-1A Eligibility Screening | 0 | 1 | 2 | 2 | 5 | `o1a-eligibility-screening.md` |
| 5 | Petition Letter Drafting Studio | 0 | 1 | 3 | 1 | 5 | `petition-drafting-studio.md` |
| 6 | RFE Response Drafting | 0 | 1 | 2 | 2 | 5 | `rfe-response-drafting.md` |
| 7 | Token Economy & Ledger | 0 | 1 | 2 | 2 | 5 | `token-economy-ledger.md` |
| 8 | AI Operation Orchestrator | 0 | 0 | 3 | 2 | 5 | `ai-operation-orchestrator.md` |
| 9 | Evidence Vault & Categorization | 0 | 0 | 3 | 2 | 5 | `evidence-vault.md` |
| 10 | LLM Engine & Observability | 0 | 0 | 3 | 2 | 5 | `llm-engine-observability.md` |
| 11 | LLM Evaluation Harness | 0 | 0 | 3 | 2 | 5 | `llm-evaluation-harness.md` |
| 12 | Marketing Site | 0 | 0 | 3 | 2 | 5 | `marketing-site.md` |
| 13 | USCIS Form-Field Guidance | 0 | 0 | 1 | 4 | 5 | `uscis-form-field-guidance.md` |
| 14 | Validation & Jurisdiction | 0 | 0 | 2 | 3 | 5 | `validation-jurisdiction.md` |
| 15 | Attorney Review & Filing | 0 | 0 | 2 | 3 | 5 | `attorney-review-filing.md` |
| 16 | Authentication & Session | 0 | 0 | 2 | 3 | 5 | `authentication-session.md` |
| 17 | Checkout & Token Bundles | 0 | 0 | 2 | 3 | 5 | `checkout-token-bundles.md` |
| 18 | Data Adapter Layer | 0 | 0 | 2 | 3 | 5 | `data-adapter-layer.md` |
| 19 | Rate Limiting | 0 | 0 | 1 | 2 | 3 | `rate-limiting.md` |
| 20 | Consent & Onboarding | 0 | 0 | 1 | 1 | 2 | `consent-onboarding.md` |

---

## The 7 High findings (→ 5 distinct issues)

### A. localStorage external-store triplication (2 reports, 1 issue)
1. **Brand #1** — `ThemeToggle.tsx:11`, `usePersistentQuery.ts:19`, `bannerDismiss.ts:7` all hand-roll the same SSR-safe `useSyncExternalStore` + localStorage + snapshot-stability shim; no shared factory.
2. **Case File Dashboard #1** — `usePersistentQuery.ts:50` + `bannerDismiss.ts:10` are byte-pattern twins, already drifting. → Extract `createLocalStorageStore<T>` collapsing all three.

### B. Compliance prompt scaffolding duplicated draft ↔ RFE (2 reports, 1 issue)
3. **Petition Drafting #1** — STRICT-RULES preamble + `CITATION_RULE` copy-pasted across `drafting.ts:251-263/170-176/312-322` ↔ `rfe.ts:239-259`.
4. **RFE #1** — same, from the RFE side: `rfe.ts:244-248/286/450` vs `drafting.ts:255-259/277`. A compliance contract that must stay in lockstep. → Lift to `criteria-text.ts` (beside `marketBarFraming`).

### C–E. Three standalone Highs
5. **Domain Event Bus #1** — provenance ledger is **write-only**: `getProvenanceChain` (`index.ts:50`), `verifyChain`/`records` (`provenance.ts:127-141`) have zero production callers; the "tamper-evident audit trail" can't be inspected/exported. → Ship a consumer route, or stop registering it.
6. **O-1A Eligibility #1** — screening form + client state machine triplicated across `QualifyPanel.tsx:36`, `InstantVerdict.tsx:29`, `BestPathFinder.tsx:21` (~120 LOC, drifting). → `useScreeningForm` hook + shared `<ScreeningFields>`.
7. **Token Economy #1** — dead `insufficientResponse` (`guard.ts:66`) divergently duplicates the live 402 path in `operation.ts` and **drops the UPL `disclaimer` field**. → Delete; live path is canonical.

---

## Triage themes (suggested fix-wave split)

| Theme | ~Count | Why it's a wave, not loose fixes |
|---|---:|---|
| **A. Cross-route AI plumbing dup** | ~8 | Body-guard (`asObjectBody`), field coercion (`requireString`/`str`), `CaseAccess` literal (`caseAccessFor`), and the `as unknown as Record` build-hook cast (export `ModelSource`) are hand-rolled across all 5–8 AI specs (guidance/evidence/rfe/qualify/draft + orchestrator). One mental model: collapse the per-spec primitives. |
| **B. Compliance prompt + drafting structure** | ~6 | The 2 prompt-dup Highs + `criteriaLines` flat-map + citation-gate predicate + the lying `criteria-text.ts` header + `drafting.ts` at 857 LOC (critique/citation-audit subsystems). Lift shared prose to `criteria-text.ts`, optionally split drafting. |
| **C. localStorage-store factory** | ~3 | The 2 store Highs → `createLocalStorageStore<T>`; collapses ThemeToggle + usePersistentQuery + bannerDismiss. |
| **D. Canonical status → Badge tone** | ~3 | `statusTone` flagged in 3 contexts (CaseList/ReviewPanel/CaseFileDashboard) coloring "Filed" gold/green/grey. Badge should own one canonical status→tone map. |
| **E. Dead code & dead infrastructure** | ~10 | provenance ledger (H) · `insufficientResponse` (H) · `authProvider` explicit branch / `NEXT_PUBLIC_AUTH_PROVIDER` no-op · `registerAuditLog`/`AuditSink` · `stampIn` Variants · dead `indigo` ramp (4 files) · orphaned `smoke.ts` · `CLASSIFICATIONS` redeclare · `PRO_PRICE_CAPTION` fallback. Grep-confirmed unused. |
| **F. Guard / façade dup + webhook** | ~6 | 3 non-orchestrated routes hand-build the rate-limit guard → `enforceRateLimit()`; webhook bypasses `pickStr` (`polar-fields.ts`) on the double-clawback dedupe key; `featured`-flag adoption incomplete (magic `"pro"` key at 2 sites); `labelOf` throws → latent billing-page crash; `ChargeOutcome` two shapes. |
| **G. Stale/lying docs, comments & dead anchors** | ~12 | validation-framework.md (`provisional`/`verifiedBy`) · EVALUATION.md migration notes · llm-engines.md adding-an-engine · `cost-telemetry.ts` "unrelated" header · rate-limit.ts header (3/5 endpoints) · middleware `__session` comment · SiteChrome "(home)" · dead `/#start` + `/#how` in-page anchors. Mostly Low; batch as one doc-truth pass. |

Themes A–G cover all 7 Highs + ~45 Mediums; the remaining Lows fold into whichever wave touches the same file, or a final sweep.

---

## ⚠ Context-map drift (refresh recommended in Phase B7)

The scan surfaced many context `filePaths` pointing at files that **no longer exist** or **moved** (the 2026-06-23 pass + later work deleted/relocated them). Scanners verified the real locations:
- `qualification/questionnaire.ts(.test)` — gone (O-1A context)
- `guidance/components/CitationNote.tsx` + `DisclaimerStamp.tsx` — now in `src/components/legal/`
- `events/subscribers/analytics.ts` — gone; real extra file is `events/provenance.ts`
- `src/lib/rate-limit.ts` — actually `src/lib/tokens/rate-limit.ts`
- Brand: `SectionHeader.tsx`, `StatCard.tsx`, `lib/format.ts(.test)` — don't exist
- Marketing: `landing-claude/page.tsx`, `components/PetitionStepper.tsx` — deleted; real homepage is `PassportLanding.tsx`; shared chrome is `SiteChrome.tsx`

→ `refresh_context` for: O-1A Eligibility, Form Guidance, Domain Event Bus, Rate Limiting, Brand & Design System, Marketing Site (at minimum).

---

## How this scan was run

- Scanner: Vibeman `code_refactor` agent prompt (`agent_code_refactor`), per-context subagent dispatch.
- Scope: all 20 contexts, full-stack (Next.js, no `src-tauri`). Target 5 findings/context.
- Method: 20 `general-purpose` subagents, read-only, each writing one structured report; verify-before-flag mandated (recently refactored). ~1,900 files-reads-equivalent across runs (~9–22 files/agent).
- Baseline (Phase B2): `tsc` 0 errors · `npm test` 437/437 pass.
- Verification: 95 findings reconcile (heading count == severity-bullet count); severity tally 0C/7H/45M/43L.
- Notable false-positives caught & NOT flagged: `petitions.ts` alive (adapter/authorizeRoute/cases page), `createCaseWithCriteria` dynamically imported, `parseCategorizeResponse` used by eval harness, `result.ts` (ADR-0011) vs `adapters/result.ts` (ADR-0010) deliberately distinct, the two firebase admin modules share `adminApp.ts`.
