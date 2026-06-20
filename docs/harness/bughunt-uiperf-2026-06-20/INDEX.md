# Bug Hunter + UI Perfectionist (dual-lens) Scan — immigration-paperwork, 2026-06-20

> Combined 🐛 Bug Hunter + 🎨 UI Perfectionist audit, 5 findings per context (combined lens).
> 20 parallel subagent runs, batched in waves of 7/7/6. Vibeman API was offline; project
> path + context map were recovered from Vibeman's SQLite (`database/goals.db`) and the scan
> ran fully offline. Baseline: tsc 0 errors, 378/378 tests passing.

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Across 20 contexts | 7 | 35 | 42 | 16 | **100** |
| Share | 7% | 35% | 42% | 16% | 100% |
| Lens | bug-hunter 67 | ui-perfectionist 33 | | | |

Verified two ways: `> Total:` header sum = 100; `- **Severity**:` bullet count = 100.

---

## Per-context breakdown

(Sorted by criticals desc, then total)

| # | Context | Group | C | H | M | L | Report |
|---|---|---|--:|--:|--:|--:|---|
| 1 | LLM Evaluation Harness | AI Infra & Eval | 2 | 2 | 1 | 0 | `llm-evaluation-harness.md` |
| 2 | Consent & Onboarding | Identity & Access | 1 | 2 | 1 | 1 | `consent-onboarding.md` |
| 3 | O-1A Eligibility Screening | Eligibility & Qual | 1 | 2 | 1 | 1 | `o1a-eligibility-screening.md` |
| 4 | Petition Drafting Studio | Petition Drafting | 1 | 2 | 1 | 1 | `petition-drafting-studio.md` |
| 5 | Rate Limiting | AI Infra & Eval | 1 | 2 | 2 | 0 | `rate-limiting.md` |
| 6 | Validation & Jurisdiction | Eligibility & Qual | 1 | 2 | 1 | 1 | `validation-jurisdiction.md` |
| 7 | Authentication & Session | Identity & Access | 0 | 3 | 1 | 1 | `authentication-session.md` |
| 8 | AI Operation Orchestrator | AI Infra & Eval | 0 | 2 | 3 | 0 | `ai-operation-orchestrator.md` |
| 9 | Checkout & Token Bundles | Billing | 0 | 2 | 2 | 1 | `checkout-token-bundles.md` |
| 10 | Token Economy & Ledger | Billing | 0 | 2 | 2 | 1 | `token-economy-ledger.md` |
| 11 | Domain Event Bus | AI Infra & Eval | 0 | 2 | 2 | 1 | `domain-event-bus.md` |
| 12 | Data Adapter Layer | Evidence & Case | 0 | 2 | 2 | 1 | `data-adapter-layer.md` |
| 13 | Case File Dashboard | Evidence & Case | 0 | 2 | 2 | 1 | `case-file-dashboard.md` |
| 14 | Marketing Site | Marketing | 0 | 2 | 2 | 1 | `marketing-site.md` |
| 15 | LLM Engine & Observability | AI Infra & Eval | 0 | 1 | 4 | 0 | `llm-engine-observability.md` |
| 16 | Attorney Review & Filing | Evidence & Case | 0 | 1 | 3 | 1 | `attorney-review-filing.md` |
| 17 | Evidence Vault & Categorization | Evidence & Case | 0 | 1 | 3 | 1 | `evidence-vault-categorization.md` |
| 18 | USCIS Form-Field Guidance | Petition Drafting | 0 | 1 | 3 | 1 | `uscis-form-field-guidance.md` |
| 19 | Brand & Design System | Marketing | 0 | 1 | 3 | 1 | `brand-design-system.md` |
| 20 | RFE Response Drafting | Petition Drafting | 0 | 1 | 3 | 1 | `rfe-response-drafting.md` |

---

## All 7 critical findings — one-line summary

1. **Consent & Onboarding** — stored `consent_version` is never compared to current `CONSENT_VERSION`; the gate keys only on `onboarded_at`, so users are **never re-prompted after a terms change** and keep access under stale consent. `consent.ts` / `welcome` gate
2. **O-1A Eligibility** — the verdict threshold/denominator is read from **live `<select>` form state**, not the classification the result was scored against; flipping the dropdown post-submit renders a Meets/Below verdict against the wrong program's rule. `CriteriaReport.tsx`
3. **Petition Drafting Studio** — a keyless/no-store build returns `200 {version:null}` which `retrySaveDraft` treats as success, so **"Saved ✓" shows while nothing persists** — false success on the very rescue path meant to prevent lost work. `/api/draft/save` + `DraftStudio`
4. **Rate Limiting** — IP-keyed anonymous routes are **fully bypassable**: rotating valid `x-forwarded-for` literals mints a fresh bucket each request, running up real model cost on `guidance`/`categorize`. `rate-limit.ts` + callers
5. **Validation & Jurisdiction** — an unparseable `lastVerified` date makes `daysBetween` → `NaN`, and `freshnessOf` falls through to **"fresh"**, so a corrupt-dated legal rule shows as current and the weekly CI check exits 0. `validation.ts`
6. **LLM Eval Harness** — hard gate FAILs don't set a non-zero exit (only thrown pipelines do): a run with every disclaimer stripped still **exits 0 / reports green**. `scripts/llm-eval/run.ts`
7. **LLM Eval Harness** — zero scenarios after filtering reports a **clean pass** (empty-set boundary), so a bad `--filter` greenlights a no-op run. `scripts/llm-eval/run.ts`

---

## Triage themes (suggested fix-wave split)

Themes detected by clustering category + scenario across the 20 reports.

| Theme | Findings | Why it's a wave, not scattered fixes |
|---|---:|---|
| **A. Legal correctness & integrity** | ~10 | Wrong verdict / stale rule shown as current / consent version drift / UPL gate not wired — one mental model: *the legal output must not lie*. Holds 3 of 7 criticals. |
| **B. Money & metering integrity** | ~11 | Token charged with no output, unvalidated ledger amounts, driver-divergent NaN balance, webhook bundle authority — *every paid path must charge correctly or not at all*. |
| **C. Security boundary** | ~12 | Rate-limit bypass, signout non-revocation, latent open-redirect, shell-interpolation — *trust boundaries fail closed*. Holds the rate-limit critical. |
| **D. False-success / silent-failure** | ~10 | "Saved ✓" with no write, swallowed `catch {}`, no-op reported `ok`, dropped error state → infinite skeleton — *a failure must look like a failure*. Holds the drafting critical. |
| **E. Eval-harness false-green** | 5 | The CI safety net reports green while real regressions slip through — *the gate that guards everything else*. Holds 2 criticals. |
| **F. Accessibility** | ~12 | Focus-visible stripped on shared Button, table-without-semantics, verdict not announced, missing live regions — *keyboard + SR users can use the product*. |
| **G. Reliability / resource / observability** | ~13 | Unbounded provenance ledger, permanent stale caches, orphaned grandchild processes, error-kind drift — *long-running correctness*. |
| **H. UI consistency / drift / missing states** | ~17 | Duplicated headers/tables that have drifted, stale manifest price, missing pending/empty/confirm states — *visual + interaction coherence*. |

---

## Suggested next-phase split (8 waves)

Front-loaded so every critical is closed in Waves 1–5.

- **Wave 1 — Legal correctness & integrity** (3C/4H): consent-version re-prompt, verdict-threshold desync, unparseable-date→fresh, stale-green-badge, isStale doc/code drift, mock-likelihood decoupled, UPL gate unwired.
- **Wave 2 — Money & metering** (7H): Firestore NaN backstop, unvalidated ledger amounts, webhook bundle/productId reconcile, subscription-renewal userId, evidence charge-without-save, RFE forecast charge-without-output, orchestrator guard-throw silent-mock.
- **Wave 3 — Security boundary** (1C/6H): XFF bypass + leftmost-hop + unbounded Map, signout cookie revocation, `next` open-redirect guard, firebase-admin 503-vs-401, claudeBin shell-interpolation.
- **Wave 4 — False-success / silent-failure** (1C/6H): drafting "Saved ✓" false-success, merge-clobbers-section, regenerate-charges-no-save, attorney action silent fail, consent grant-before-write ordering, consent catch{} logging, adapter no-op-reported-ok, dashboard dropped-error-state.
- **Wave 5 — Eval-harness false-green** (2C/2H/1M): exit-code on hard fails, zero-scenario pass, no-engine exit-0, --repeat id collision, sentence-gate heuristic.
- **Wave 6 — Accessibility** (4H + a11y mediums): Button/landing focus-visible, criteria-table semantics, verdict aria-live, guidance/evidence live-regions, Sign&file focus ring, focus-ring color.
- **Wave 7 — Reliability / resource / observability**: provenance unbounded + ordering, adapter error-kind mismatch, extractJson fence, claude orphan, cachedDefaults memo, module cache staleness.
- **Wave 8 — UI consistency / drift / missing states**: manifest price, header/footer drift, dead Card hover, destructive-remove confirm, in-flight disabled states, empty-state guidance, remaining polish.

---

## How this scan was run

- **Scanners:** `bug-hunter` + `ui-perfectionist` role-prompts (`src/lib/prompts/registry/agents/`), combined into one dual-lens prompt per context, 5 findings/context combined.
- **Scope:** all 20 contexts (8 groups), full-stack TS (no native side). Per-context subagents read the context's file list + grepped callers where a finding hinged on them.
- **Method:** 20 isolated `general-purpose` subagents, each writing one `<context-slug>.md`; orchestrator read only terse replies (Pipeline B discipline). ~1,400+ files read across subagents.
- **Verification:** header-sum (100) and severity-bullet count (100) agree.
- **Provenance note:** the DB context list named a few files that no longer exist (`subscribers/analytics.ts`, `documents.ts`, `questionnaire.ts`, `SectionHeader.tsx`, `StatCard.tsx`) — subagents noted these and scanned the real surface; context map is mildly drifted and worth a `refresh_context` next time Vibeman is up.
