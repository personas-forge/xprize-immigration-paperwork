# Code Refactor Scan — immigration-paperwork, 2026-06-14

> Code-cleanliness audit (dead code, duplication, structure, leftover cruft) across the whole app.
> 20 parallel `code_refactor` subagent runs, batched in waves of 8 / 8 / 4.
> Baseline at scan time: `tsc` 0 errors, 298/298 tests passing.

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Across 20 contexts | 1 | 31 | 33 | 23 | **88** |
| Share | 1% | 35% | 38% | 26% | 100% |

Verified two ways: sum of `> Total:` headers = 88; count of `- **Severity**:` bullets = 88. ✔

~10 of the 88 are **cross-report duplicates** (the same underlying issue surfaced from two contexts) — see the "Cross-report duplicates" section. Distinct underlying issues ≈ **78**.

---

## Per-context breakdown

(Sorted by criticals, then highs, then total.)

| # | Context | C | H | M | L | Total | Report |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | AI Operation Orchestrator | 1 | 1 | 1 | 1 | 4 | `ai-orchestrator.md` |
| 2 | Petition Letter Drafting Studio | 0 | 3 | 1 | 1 | 5 | `petition-drafting.md` |
| 3 | Data Adapter Layer | 0 | 2 | 2 | 1 | 5 | `data-adapter.md` |
| 4 | Brand & Design System | 0 | 2 | 2 | 1 | 5 | `brand-design-system.md` |
| 5 | Case File Dashboard | 0 | 2 | 2 | 1 | 5 | `case-file-dashboard.md` |
| 6 | USCIS Form-Field Guidance | 0 | 2 | 2 | 1 | 5 | `form-field-guidance.md` |
| 7 | O-1A Eligibility Screening | 0 | 2 | 2 | 1 | 5 | `eligibility-screening.md` |
| 8 | RFE Response Drafting | 0 | 2 | 2 | 1 | 5 | `rfe-drafting.md` |
| 9 | Evidence Vault & Categorization | 0 | 2 | 1 | 1 | 4 | `evidence-vault.md` |
| 10 | LLM Evaluation Harness | 0 | 2 | 1 | 1 | 4 | `llm-eval-harness.md` |
| 11 | Marketing Site | 0 | 2 | 1 | 1 | 4 | `marketing-site.md` |
| 12 | Validation & Jurisdiction Framework | 0 | 1 | 2 | 2 | 5 | `validation-jurisdiction.md` |
| 13 | Checkout & Token Bundles | 0 | 1 | 2 | 1 | 4 | `checkout-bundles.md` |
| 14 | Consent & Onboarding | 0 | 1 | 2 | 1 | 4 | `consent-onboarding.md` |
| 15 | Domain Event Bus | 0 | 1 | 2 | 1 | 4 | `event-bus.md` |
| 16 | Token Economy & Ledger | 0 | 1 | 2 | 1 | 4 | `token-economy.md` |
| 17 | LLM Engine & Observability | 0 | 1 | 2 | 1 | 4 | `llm-engine.md` |
| 18 | Attorney Review & Filing Workflow | 0 | 1 | 2 | 1 | 4 | `attorney-review.md` |
| 19 | Authentication & Session | 0 | 1 | 1 | 2 | 4 | `auth-session.md` |
| 20 | Rate Limiting | 0 | 1 | 1 | 2 | 4 | `rate-limiting.md` |

---

## The 1 critical + 31 high findings, grouped by theme

### A. Stalled ADR-0004 orchestrator adoption — the AI routes hand-roll the pipeline `executeAiOperation` was built to own
- **[CRIT]** ai-orchestrator #1 — migration stalled at **4/6**: `draft`, `rfe`, `evidence/categorize` still hand-roll parse→rate-limit→charge→model→guard→persist (~300 LOC). Only `guidance` + `qualify` adopted it.
- **[H]** ai-orchestrator #2 — `draft/save` 429 omits the `DISCLAIMER` the orchestrator (and every other route) guarantees.
- **[H]** evidence-vault #1 — `categorize` route hand-rolls the same auth→rate-limit→charge→LLM-or-mock preamble as `draft`/`rfe`.
- **[H]** rate-limiting #1 — rate-limit preamble copy-pasted across the orchestrator-bypassing routes.

### B. Half-adopted PetitionAdapter / inline access gates (ADR-0010)
- **[H]** data-adapter #1 — `EvidenceAdapter.add/get` + `PetitionAdapter.create/RFE` built, tested, but **never wired**; routes call the raw data layer.
- **[H]** data-adapter #2 ≡ auth-session #1 — `cases/[id]/page.tsx` hand-rolls the owner-or-attorney gate the adapter centralizes (last surviving inline copy).
- **[H]** rfe-drafting #1 ≡ petition-drafting #3 — `/api/rfe` never migrated to the adapter; re-implements ~25 LOC of ungated reads + bespoke error-shaping.
- **[H]** evidence-vault #2 — categorize WRITE gates via `authorizeRoute` while remove/refile gate via `EvidenceAdapter`: two gate paths for one vault.

### C. Duplicated LLM parse/coercion helpers
- **[H]** petition-drafting #1 ≡ rfe-drafting #2 — `toSection` JSON-section coercer copy-pasted **byte-identical** in `drafting.ts`, `rfe.ts`, `saveRecovery.ts` (the validity gate for paid work product, split 3 ways).
- **[H]** petition-drafting #2 — `parseDraftResponse`/`parseSectionResponse`/`parseRfeResponse` exported-but-test-only; routes use the `tryParse*` variants. Dead surface that re-introduces a known billing bug if reused.

### D. Disclaimer / UPL constant fragmentation (legal-correctness risk)
- **[H]** consent-onboarding #1 ≡ form-field-guidance #4 — `ConsentForm` hardcodes an `ATTORNEY_DISCLAIMER` string that **diverges in wording** from the canonical `DISCLAIMER` (`src/lib/result.ts`) used by every other UPL surface — a second source of truth on the most legally significant screen.

### E. Definitely-dead exported code (safe to delete)
- **[H]** validation #1 — `isStale` dead, superseded by `freshnessOf`.
- **[H]** eligibility #1 — entire `questionnaire.ts` module dead (~177 src + 146 test LOC, no UI/route caller).
- **[H]** brand #1 — `src/lib/format.ts` dead (zero production importers; confirmed).
- **[H]** attorney-review #1 ≡ auth-session #2 — `reviews.setCaseStatus` dead non-atomic wrapper, superseded by `transitionCase` (attractive-nuisance in a legal audit path).
- **[H]** token-economy #1 — `OPERATIONS` export dead (only a self-referential test).
- **[H]** event-bus #1 — `getAnalytics()` dead exported surface (collector written, never read).
- **[H]** form-field-guidance #1 — 8 of 9 `guidance/index.ts` barrel re-exports dead.

### F. UI shell / chrome triplication
- **[H]** brand #2 ≡ case-file #1 — prop-driven `ThemeToggle` + `BalancePill` triplicated byte-for-byte across `DashboardView`/`CaseDetailView`/`ReviewQueueView`; the transient copy doesn't persist/sync with the canonical localStorage toggle (theme picked on landing is lost on dashboard).
- **[H]** case-file #2 — criteria-table markup duplicated between `CriteriaTable` and `CaseDetailView`'s inline table.
- **[H]** marketing #2 — `SiteHeader`/`SiteFooter` duplicated across 5 routes (already drifted).

### G. LLM engine-selection triplication
- **[H]** llm-eval-harness #1 — engine-selection precedence triplicated across `config.ts`, `scripts/llm-eval/engine.ts`, `e2e/engine.ts`.
- **[H]** llm-eval-harness #2 ≡ llm-engine #1 — `scripts/llm-eval/engine.ts` clones `client.ts` engine bodies and **has already drifted** (missing the stdin-error guard that stops the Claude CLI hanging ~180s on auth failure).

### H. Money-path / pricing-truth robustness
- **[H]** checkout #1 — dead `tokens` value in Polar checkout metadata (written, never read; attacker-influenceable second source of truth — invites a future credit-path bug).
- **[H]** marketing #1 — homepage + landing-claude advertise the **retired flat-fee model** ($2,500/$3,500/$4,500) and link to `/pricing`, which now redirects to a token-bundle economy — a live pricing contradiction on a regulated SaaS.

### I. Other highs
- **[H]** form-field-guidance #2 — `DisclaimerStamp`/`CitationNote` (used by 5+ features) misplaced under the `guidance` feature.
- **[H]** eligibility #2 — `CriteriaReport` hardcodes the O-1A threshold (3) for every classification instead of the pack's own `threshold` (latent eligibility-correctness bug, currently masked because all live packs = 3).

---

## Triage themes

| Theme | Findings (approx) | Why this is a wave, not just individual fixes |
|---|---:|---|
| A. Orchestrator adoption (ADR-0004) | 4–5 | One mental model: move each route onto `executeAiOperation`; the disclaimer-drift bug closes for free. Money-path sensitive. |
| B. Adapter migration / inline gates (ADR-0010) | 6–8 | All variations of "route the call through the single fail-closed gate"; auth-sensitive, shares files. |
| C. LLM parse/coercion helpers | 4–6 | Extract one shared `toSection`/`parse*` module; delete the test-only dead variants together. |
| D. Disclaimer / UPL single source of truth | 4–5 | Collapse all disclaimer strings to one canonical constant; legal-correctness mental model. |
| E. Dead-code deletion | ~20 | Pure removal, zero behavior change, high certainty — the safest wave; immediate LOC win. |
| F. UI chrome de-duplication | 5–6 | Extract shared dashboard/marketing shell components; all view-layer. |
| G. Engine-selection triplication | 3–4 | One shared engine module imported by client + harness + e2e; fixes the drift bug. |
| H. Money-path / pricing truth | 4–5 | Billing-correctness mental model; small but high-value. |

---

## Suggested next-phase split (7 waves, 5–7 fixes each)

Ordered safe→risky so the pattern catalogue builds before the money/auth refactors:

- **Wave 1 — Dead-code deletion (Theme E, safe wins).** `isStale`, `questionnaire.ts`, `format.ts`, `setCaseStatus` wrapper, `OPERATIONS`, `getAnalytics`, `documents.ts`, + bundle the low-risk dead exports (`StatCard`/`SectionHeader`, `getCaseById`/`getFormById`, `isOk`, barrel re-exports, `provisional`, `teal`/`midnight`, `windowMs`, `glyph`). ~6–7 atomic commits. **Recommended start.**
- **Wave 2 — Disclaimer / UPL single source of truth (Theme D).** Collapse `ATTORNEY_DISCLAIMER` + redundant re-exports + docstring dup to the canonical `DISCLAIMER`; optionally relocate `DisclaimerStamp`/`CitationNote`.
- **Wave 3 — LLM parse/coercion consolidation (Theme C).** Extract shared `toSection`/section-parse into `@/lib/llm/json`; delete test-only `parse*`; dedupe `str`/`criteriaLines`.
- **Wave 4 — Adapter migration completion (Theme B, auth-sensitive).** Route `/api/rfe`, `categorize`, and `cases/[id]/page.tsx` through the adapter gate; retire unused raw paths.
- **Wave 5 — Orchestrator adoption (Theme A, money-path sensitive).** Migrate `draft`/`rfe`/`categorize` onto `executeAiOperation`; fix `draft/save` 429 disclaimer drift.
- **Wave 6 — UI chrome de-duplication (Theme F).** Shared `DashboardShell`/`SiteChrome` + a single theme-toggle; dedupe criteria table.
- **Wave 7 — Money-path + engine-mirror + misc (Themes G, H, I).** Engine module dedup, checkout metadata/refund symmetry, pricing-truth fix, remaining structural cleanups.

---

## Cross-report duplicates (fix once, close both)

1. `toSection` 3-file dup — petition-drafting #1 ≡ rfe-drafting #2
2. test-only `parse*` dead surface — petition-drafting #2 ⊇ rfe-drafting #3
3. `str()`/`criteriaLines` dup — petition-drafting #5 ≡ rfe-drafting #4
4. `/api/rfe` bypasses adapter — rfe-drafting #1 ≡ petition-drafting #3
5. inline gate in `cases/[id]/page.tsx` — data-adapter #2 ≡ auth-session #1
6. `setCaseStatus` dead wrapper — attorney-review #1 ≡ auth-session #2
7. ThemeToggle+BalancePill triplication — brand #2 ≡ case-file #1
8. `ATTORNEY_DISCLAIMER` divergent — consent #1 ≡ form-field-guidance #4
9. eval engine mirror drift — llm-eval-harness #2 ≡ llm-engine #1
10. engine-selection triplication — llm-eval-harness #1 (overlaps #2 / llm-engine #1)

---

## How this scan was run

- **Scanner**: `code_refactor` role prompt (`src/lib/prompts/registry/agents/code-refactor.ts`) — dead code, duplication, structure, cleanup.
- **Date**: 2026-06-14. **Scope**: all 20 contexts (full app), client + server (no `src-tauri`).
- **Method**: 20 isolated `general-purpose` subagents, one per context, each writing a structured report; orchestrator read only terse replies during scanning. Each agent was instructed to grep the whole repo to verify every dead-code claim (the ~9% historical false-positive guard) and to state its verification per finding.
- **Verification**: finding count confirmed two ways (`> Total:` header sum = severity-bullet count = 88).
- **Notable FP-guards by agents**: `event-bus` disproved the "whole bus is dead" hypothesis (it's wired at `store.ts:290`); `marketing-site` disproved "landing-claude is dead" (it's linked + public); `data-adapter` disproved "AdapterResult duplicates ResultEnvelope" (distinct concerns); `petition-drafting`/`rfe` deliberately did NOT flag the widely-shared `src/lib/data/petitions.ts`.
