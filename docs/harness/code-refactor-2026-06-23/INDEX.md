# Code Refactor Scan - immigration-paperwork, 2026-06-23

> Code-cleanliness audit (dead code, duplication, structure, leftover cruft) across the whole app.
> 20 parallel `code_refactor` subagent runs, batched in waves of 8 / 8 / 4. 5 findings per context.
> Baseline at scan time: `tsc` 0 errors, 429/429 tests passing.
> Targets cruft accumulated since the 2026-06-14 code-refactor pass (10 moonshots, two dual-lens
> fix campaigns, and the Passport landing redesign all landed in between).

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Across 20 contexts | 2 | 31 | 41 | 24 | **98** |
| Share | 2% | 32% | 42% | 24% | 100% |

Verified two ways: sum of `> Total:` headers = 98; count of `- **Severity**:` bullets = 98. (match)

**By category:** duplication 44 - dead-code 20 - cleanup 21 - structure 12 - naming 1.
Duplication dominates (45%) - expected for a maturing codebase that absorbed three feature campaigns since the last cleanup.

---

## Per-context breakdown

(Sorted by criticals, then highs, then total.)

| # | Context | C | H | M | L | Total | Report |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | Attorney Review & Filing Workflow | 1 | 1 | 2 | 1 | 5 | `attorney-review-filing-workflow.md` |
| 2 | Validation & Jurisdiction Framework | 1 | 1 | 2 | 1 | 5 | `validation-jurisdiction-framework.md` |
| 3 | Marketing Site | 0 | 3 | 1 | 1 | 5 | `marketing-site.md` |
| 4 | Authentication & Session | 0 | 2 | 3 | 0 | 5 | `authentication-session.md` |
| 5 | Brand & Design System | 0 | 2 | 2 | 1 | 5 | `brand-design-system.md` |
| 6 | Case File Dashboard | 0 | 2 | 2 | 1 | 5 | `case-file-dashboard.md` |
| 7 | Checkout & Token Bundles | 0 | 2 | 2 | 1 | 5 | `checkout-token-bundles.md` |
| 8 | Data Adapter Layer | 0 | 2 | 2 | 1 | 5 | `data-adapter-layer.md` |
| 9 | Domain Event Bus | 0 | 2 | 2 | 1 | 5 | `domain-event-bus.md` |
| 10 | Evidence Vault & Categorization | 0 | 2 | 2 | 1 | 5 | `evidence-vault-categorization.md` |
| 11 | O-1A Eligibility Screening & Questionnaire | 0 | 2 | 2 | 1 | 5 | `o-1a-eligibility-screening-questionnaire.md` |
| 12 | RFE Response Drafting | 0 | 2 | 2 | 1 | 5 | `rfe-response-drafting.md` |
| 13 | AI Operation Orchestrator | 0 | 1 | 1 | 3 | 5 | `ai-operation-orchestrator.md` |
| 14 | LLM Engine & Observability | 0 | 1 | 3 | 1 | 5 | `llm-engine-observability.md` |
| 15 | LLM Evaluation Harness | 0 | 1 | 2 | 2 | 5 | `llm-evaluation-harness.md` |
| 16 | Petition Letter Drafting Studio | 0 | 1 | 3 | 1 | 5 | `petition-letter-drafting-studio.md` |
| 17 | Token Economy & Ledger | 0 | 1 | 3 | 1 | 5 | `token-economy-ledger.md` |
| 18 | USCIS Form-Field Guidance | 0 | 1 | 2 | 2 | 5 | `uscis-form-field-guidance.md` |
| 19 | Consent & Onboarding | 0 | 1 | 2 | 1 | 4 | `consent-onboarding.md` |
| 20 | Rate Limiting | 0 | 1 | 1 | 2 | 4 | `rate-limiting.md` |

---

## The 2 critical + 31 high findings, grouped by fix theme

Each finding links to its full entry in the per-context report. Theme letters map to the fix waves below.

### A. Single-source drift on money / legal-decision paths (the 2 criticals live here)
- **[CRIT]** Attorney Review & Filing Workflow #1 (duplication) - Demo-receipt flag re-derived in the UI by regex instead of reading the stored boolean. `src/features/review/components/ReviewPanel.tsx:77-79 (consumer) ; src/features/review/acti`
- **[CRIT]** Validation & Jurisdiction Framework #1 (duplication) - `subject` field redundantly restates each record's own map key. `src/features/qualification/validation.ts:38 (the field) — restated at :66, :90, :114, :138`
- [H] Attorney Review & Filing Workflow #2 (duplication) - The three USCIS decision values are hard-coded in two places (server allowlist vs. <select> options). `src/features/review/actions.ts:266 ; src/features/review/components/ReviewPanel.tsx:178-18`
- [H] Checkout & Token Bundles #1 (duplication) - `productId` snake/camel normalization triplicated across the webhook context. `src/app/api/polar/webhook/route.ts:90, src/app/api/polar/webhook/route.ts:117, src/app/api`
- [H] Checkout & Token Bundles #2 (duplication) - `resolveUserId` and the revenue relay's `userId` resolve the buyer from DIFFERENT field sets. `src/app/api/polar/webhook/route.ts:34-43, src/app/api/polar/webhook/relay-revenue.ts:44-47`
- [H] Marketing Site #2 (duplication) - Cost-comparison literal in `charts.tsx` duplicates `FIRM_FEE`. `src/components/landing/charts.tsx:110 (vs single source src/lib/site.ts:23-26)`
- [H] Marketing Site #3 (duplication) - `$48 / 8,000 tokens` bundle price hard-coded in two places, neither sourced from token economy. `src/components/landing/charts.tsx:111 and src/components/landing/PassportLanding.tsx:455`
- [H] Token Economy & Ledger #1 (duplication) - `MAX_LEDGER_AMOUNT` cap (1,000,000) duplicated as an inline literal in the dev grant route. `src/app/api/dev/grant-tokens/route.ts:28 ↔ src/lib/tokens/ledger.ts:33`

### B. Hand-rolled clones of an existing shared helper
- [H] Evidence Vault & Categorization #2 (duplication) - `Ex. ${ord}` exhibit-label format is triplicated across both stores and the client. `src/features/evidence/components/EvidenceVault.tsx:111 (+ src/lib/db/pglite-store.ts:766, `
- [H] O-1A Eligibility Screening & Questionnaire #2 (duplication) - `statusAccent` re-implements the centralized status ladder instead of deriving from `classifyStatus`. `src/features/qualification/components/CriteriaReport.tsx:17-23`
- [H] Petition Letter Drafting Studio #1 (duplication) - DraftStudio re-implements `mergeRegeneratedSection` inline instead of reusing the pure helper. `src/features/drafting/components/DraftStudio.tsx:247-256 (vs src/features/drafting/draftOp`
- [H] RFE Response Drafting #1 (duplication) - `attachRfeExhibits` is a byte-for-byte clone of drafting's `attachExhibits`. `src/features/rfe/rfe.ts:125-145 (clone of src/features/drafting/drafting.ts:564-586)`
- [H] RFE Response Drafting #2 (duplication) - `isAddressable` and `isRelied` are two names for the same predicate. `src/features/rfe/rfe.ts:71-73 (isAddressable) and rfe.ts:330-332 (isRelied)`

### C. Cross-cutting boilerplate that wants one shared wrapper
- [H] AI Operation Orchestrator #1 (duplication) - The owner/attorney case-resolve preamble is hand-copied across four AI specs. `src/app/api/rfe/route.ts:62-89, src/features/drafting/draftOperation.ts:135-161, src/featu`
- [H] Authentication & Session #1 (duplication) - Session-revoke + cookie-clear logic duplicated across two route handlers. `src/app/api/auth/session/route.ts:59-74 (DELETE) and src/app/auth/signout/route.ts:23-35 (`
- [H] Authentication & Session #2 (duplication) - Consent-row write duplicated inside each store driver (upsertProfileWithConsent vs recordConsent). `src/lib/db/firestore-store.ts:148-157 & 215-224; src/lib/db/pglite-store.ts:276-290 & 322-`
- [H] Consent & Onboarding #1 (duplication) - Re-consent gate logic is duplicated, expressed as two independent inverses. `src/app/welcome/page.tsx:28-31 and src/lib/auth/session.ts:132-148`
- [H] Data Adapter Layer #1 (duplication) - `defaultDeps()` dependency-injection boilerplate duplicated verbatim across two adapters. `src/lib/data/adapters/petition.ts:64-88 and src/lib/data/adapters/evidence.ts:49-70`
- [H] Domain Event Bus #2 (duplication) - `CaseStatusChanged` publish payload is duplicated across two Proxy branches. `src/lib/events/store-events.ts:61–68 and src/lib/events/store-events.ts:77–84`
- [H] LLM Engine & Observability #1 (duplication) - Per-engine telemetry try/catch is duplicated across `geminiClient` and `claudeClient`. `src/lib/llm/client.ts:62-106 (geminiClient) and src/lib/llm/client.ts:108-145 (claudeClien`
- [H] LLM Evaluation Harness #1 (duplication) - Token-overlap grounding ratio duplicated across two gates. `scripts/llm-eval/gates.ts:165-174 (qualify evidence-grounding) and scripts/llm-eval/gates.`
- [H] Rate Limiting #1 (duplication) - The "429 from a RateLimitResult" response envelope is hand-rolled in 4 places — no shared helper. `src/lib/ai/operation.ts:295-300; src/app/api/qualify/preview/route.ts:40-49; src/app/api/q`

### D. Dead code - whole components / fields / functions to delete
- [H] Brand & Design System #1 (dead-code) - Dead `[data-animate]` keyframe system in globals.css (4 hooks + 4 keyframes, ~50 lines). `src/app/globals.css:239-302 (keyframes inkRise/sealPress/ribbonSlide/underlineGrow at 239-`
- [H] Case File Dashboard #2 (dead-code) - `checklistToCsv` (+ `CaseDocument`/`DocumentStatus` types) is dead production code. `src/features/case-file/export.ts:51-60; src/features/case-file/types.ts:83-92`
- [H] Data Adapter Layer #2 (dead-code) - `EvidenceAdapter.restoreDocument` is built and tested but never wired. `src/lib/data/adapters/evidence.ts:153-167`
- [H] Domain Event Bus #1 (dead-code) - `EvidenceUploaded.name` is a dead payload field — emitted but read nowhere. `src/lib/events/types.ts:43 (declaration) + src/lib/events/store-events.ts:115 (population)`
- [H] Evidence Vault & Categorization #1 (dead-code) - `parseCategorizeResponse` is dead production code (only its own test keeps it alive). `src/features/evidence/evidence.ts:175-181`
- [H] Marketing Site #1 (dead-code) - `PetitionStepper.tsx` is dead — rendered by nothing. `src/components/PetitionStepper.tsx:35 (whole 183-line component)`
- [H] Validation & Jurisdiction Framework #2 (dead-code) - Dead `verifiedBy` field — a typed column + 6 identical literals nothing reads. `src/features/qualification/validation.ts:47 (field) — assigned identically at :71, :95, :1`

### E. Design-system class-string drift (Button / focus-ring hand-copies)
- [H] Brand & Design System #2 (duplication) - Hand-copied focus-ring class string across 35 files, in two divergent syntaxes. `src/components/ui/Button.tsx:52 (canonical) vs 35 hand-rolled call-sites`
- [H] Case File Dashboard #1 (duplication) - Empty-state CTA hand-copies the entire `Button` class string (already drifted). `src/features/case-file/components/CaseFileDashboard.tsx:146-151 (vs src/components/ui/Butt`
- [H] O-1A Eligibility Screening & Questionnaire #1 (duplication) - `SAMPLE` CV constant triplicated byte-for-byte across three Qualify components. `src/features/qualification/components/QualifyPanel.tsx:35; src/features/qualification/comp`

### F. Module / layering hygiene
- [H] USCIS Form-Field Guidance #1 (structure) - `DISCLAIMER` re-export pyramid — the whole app imports a `@/lib/result` constant THROUGH the `guidance` feature. `src/features/guidance/guidance.ts:32 (re-export { DISCLAIMER }); src/features/drafting/dra`

---

## Triage themes

| Theme | C+H | Why it is a wave, not just N individual fixes |
|---|---:|---|
| A. Money/legal single-source drift | 8 | All share one root: a value or flag is re-derived where a single source exists, so a copy/i18n/price change silently diverges on a **compliance or money** path. Both criticals are here. |
| B. Clones of a shared helper | 5 | Each is a hand-rolled reimplementation of a pure, tested helper that already exists (exhibit-attach, section-merge, status-ladder, predicate). Fix = delete the clone, import the original. |
| C. Cross-cutting boilerplate | 9 | The same preamble/envelope/DI/telemetry block is copy-pasted across 2-4 call sites with no shared wrapper; several have **already drifted**. Fix = extract one helper, route all sites through it. |
| D. Dead code | 7 | Whole components/fields/functions with zero production readers (grep-verified). Pure deletions - the safest, highest-LOC-reduction wave. |
| E. Design-system drift | 3 | Button/focus-ring class strings hand-copied (one already lost its WCAG ring); a sample-CV constant triplicated. Fix = single shared source. |
| F. Module/layering hygiene | 1 | The whole app imports `DISCLAIMER` *through* the guidance feature instead of its canonical `@/lib/result` home - phantom coupling. |

---

## Suggested fix-wave split

Waves 1-5 close **all 2 criticals + all 31 highs** (33 findings). Wave 6+ is the 65-item medium/low tail.

- **Wave 1 - Money & legal single-source drift (Theme A, 8 findings, incl. both criticals).** receipt-flag boolean, USCIS-decision allowlist, ledger cap, Polar productId/userId, marketing price literals. Make each value flow from its one source.
- **Wave 2 - Delete clones, import the original (Theme B, 5 findings).** attachRfeExhibits->attachExhibits; isRelied->isAddressable; inline merge->mergeRegeneratedSection; statusAccent->classifyStatus; Ex.N formatter -> one helper.
- **Wave 3 - Extract cross-cutting wrappers (Theme C, 9 findings - may split 5+4).** owner/attorney resolve preamble, 429 envelope, adapter defaultDeps, session-revoke, consent-row write, per-engine telemetry, gates ratio, status-change publish, re-consent gate.
- **Wave 4 - Dead-code deletion sweep (Theme D, 7 findings).** PetitionStepper (183 LOC), [data-animate] CSS (~50 LOC), checklistToCsv+types, parseCategorizeResponse, EvidenceAdapter.restoreDocument (wire or delete), EvidenceUploaded.name, verifiedBy. Highest net-LOC win; run tests after each delete.
- **Wave 5 - Design-system drift + module hygiene (Themes E+F, 4 findings).** shared focus-ring/Button source for the CTA + 35-file sweep; SAMPLE CV constant; DISCLAIMER import path -> @/lib/result.
- **Wave 6+ - Medium/Low cleanup tail (65 findings).** per-report structure + cleanup. Optional, multiple short sessions; not gating.

---

## How this scan was run

- **Scanner:** `code_refactor` (Vibeman registry `agent_code_refactor`) - dead code, duplication, structure, cleanup lens.
- **Scope:** all 20 contexts, full-stack (no Rust). 5 findings/context target.
- **Method:** 20 isolated `general-purpose` subagents, one per context, each grep-verifying every dead-code/duplication claim across `src/` before flagging (CERTAINTY standard). Reports written directly; orchestrator read only terse replies.
- **Grounding fed to subagents** (so intentional patterns were not flagged): six-op OPERATION_REGISTRY, charge-then-reclaim guard, mock fallbacks, two-driver Store, adapters-vs-libs layering, ADR single-sourcing, vendored lighttrack.
- **Count integrity:** header-sum 98 = severity-bullet-count 98.
- **FPs dropped by subagents during the scan:** petitions.createCaseWithCriteria (live via adapter), forecast/critique fns (live), categorize-route preamble (already on orchestrator), full orchestrator adoption (now complete - 0 hand-rolled routes).
- **Context-map drift noted:** several context file_paths point at moved/renamed files (questionnaire.ts, documents.ts, subscribers/analytics.ts absent; CitationNote/DisclaimerStamp now in src/components/legal/; landing components now under src/components/landing/). Refresh contexts post-fix.
