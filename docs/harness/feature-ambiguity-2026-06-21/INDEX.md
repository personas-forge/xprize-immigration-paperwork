# Feature Scout + Ambiguity Guardian — immigration-paperwork, 2026-06-21

> Dual-lens Vibeman scan (🔍 **feature-scout** = product/capability gaps, 🌀 **ambiguity-guardian** = unclear intent / risky assumptions).
> 20 parallel subagent runs (one per context), batched in waves of 8. 5 combined findings per context.
> Baseline at scan time: **tsc 0 · tests 409/409 · next build PASS** (branch `main`).

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Across 20 contexts | 6 | 49 | 44 | 1 | **100** |
| Share | 6% | 49% | 44% | 1% | 100% |

Lens split: **45 feature-scout / 55 ambiguity-guardian.** Count-verified three ways (Total-header sum = Lens-bullet count = `## N.` heading count = 100).

---

## Per-context breakdown

(Sorted by criticals desc, then total severity weight)

| # | Context | Group | C | H | M | L | F | A | Report |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Validation & Jurisdiction | Eligibility | 1 | 3 | 1 | 0 | 2 | 3 | [validation-jurisdiction.md](validation-jurisdiction.md) |
| 10 | Consent & Onboarding | Identity | 1 | 3 | 1 | 0 | 3 | 2 | [consent-onboarding.md](consent-onboarding.md) |
| 11 | Authentication & Session | Identity | 1 | 2 | 2 | 0 | 2 | 3 | [auth-session.md](auth-session.md) |
| 3 | USCIS Form-Field Guidance | Drafting | 1 | 1 | 2 | 1 | 2 | 3 | [form-field-guidance.md](form-field-guidance.md) |
| 15 | Domain Event Bus | AI Infra | 1 | 2 | 2 | 0 | 2 | 3 | [event-bus.md](event-bus.md) |
| 20 | Marketing Site | Marketing | 1 | 2 | 2 | 0 | 2 | 3 | [marketing-site.md](marketing-site.md) |
| 7 | Attorney Review & Filing | Evidence | 0 | 4 | 1 | 0 | 3 | 2 | [attorney-review.md](attorney-review.md) |
| 12 | Checkout & Token Bundles | Billing | 0 | 3 | 2 | 0 | 2 | 3 | [checkout-bundles.md](checkout-bundles.md) |
| 6 | Data Adapter Layer | Evidence | 0 | 3 | 2 | 0 | 2 | 3 | [data-adapter.md](data-adapter.md) |
| 5 | Petition Drafting Studio | Drafting | 0 | 3 | 2 | 0 | 2 | 3 | [petition-drafting.md](petition-drafting.md) |
| 13 | Token Economy & Ledger | Billing | 0 | 3 | 2 | 0 | 2 | 3 | [token-economy.md](token-economy.md) |
| 18 | LLM Engine & Observability | AI Infra | 0 | 3 | 2 | 0 | 2 | 3 | [llm-engine.md](llm-engine.md) |
| 19 | Brand & Design System | Marketing | 0 | 3 | 2 | 0 | 2 | 3 | [brand-design.md](brand-design.md) |
| 16 | AI Operation Orchestrator | AI Infra | 0 | 2 | 3 | 0 | 3 | 2 | [ai-orchestrator.md](ai-orchestrator.md) |
| 2 | O-1A Eligibility Screening | Eligibility | 0 | 2 | 3 | 0 | 2 | 3 | [eligibility-screening.md](eligibility-screening.md) |
| 8 | Case File Dashboard | Evidence | 0 | 2 | 3 | 0 | 2 | 3 | [case-file-dashboard.md](case-file-dashboard.md) |
| 9 | Evidence Vault & Categorization | Evidence | 0 | 2 | 3 | 0 | 2 | 3 | [evidence-vault.md](evidence-vault.md) |
| 4 | RFE Response Drafting | Drafting | 0 | 2 | 3 | 0 | 2 | 3 | [rfe-drafting.md](rfe-drafting.md) |
| 14 | Rate Limiting | AI Infra | 0 | 2 | 3 | 0 | 3 | 2 | [rate-limiting.md](rate-limiting.md) |
| 17 | LLM Evaluation Harness | AI Infra | 0 | 2 | 3 | 0 | 3 | 2 | [llm-eval.md](llm-eval.md) |

---

## All 6 critical findings

1. 🌀 **auth-session** — `isAttorney` (roles.ts:20-27) returns **true for every signed-in user** when `ATTORNEY_EMAILS` is unset. The cross-tenant *data* gates correctly use the strict `isConfiguredAttorney` twin, but the permissive `isAttorney` survives one autocomplete away from reopening the closed IDOR/fail-open class. `src/lib/auth/roles.ts:20`
2. 🌀 **consent-onboarding** — `CONSENT_VERSION` is a build-baked `NEXT_PUBLIC_*` env string with no recorded version history or release-coupling. A missed bump (or instance drift) silently leaves users operating under terms they never re-accepted — the UPL/compliance keystone failing invisibly. `src/lib/auth/consent.ts:7`
3. 🌀 **form-field-guidance** — The live UPL adjudication gate returns `blocked` when it detects legal-advice language, **but `FieldGuidancePanel` renders `result.guidance` verbatim anyway** (only adding a badge). The exact unauthorized-practice text the safeguard exists to catch is still shown. `src/features/guidance/components/FieldGuidancePanel.tsx:270`
4. 🌀 **marketing-site** — The "Live" `PetitionStepper` depicts a *managed full-service* flow ("Voice interview booked — discovery in 24h", a built-in "Attorney Review" stage, "I-129 e-filed with USCIS") contradicting the reconciled self-serve positioning ("we don't supply the attorney or file on your behalf"). Strongest residual full-service/UPL truthfulness risk on the site. `src/components/PetitionStepper.tsx:21`
5. 🌀 **validation-jurisdiction** — `counselApproved` is documented in three places as "the bar for filing," yet it is read **only by a display badge** — no draft/sign/deliver/filing path ever checks it. The product's central "attorney of record signs before filing" claim is enforced nowhere. `src/features/qualification/validation.ts:41`
6. 🔍 **event-bus** — Attorney notification is a pure `console.info` stub; a grep of `src/` confirms **no email/SMS/queue infrastructure exists anywhere**. An RFE/Decision milestone is "notified" only to a server log — a missed-legal-deadline failure mode. `src/lib/events/subscribers/attorney-notify.ts:35`

---

## Triage themes (suggested fix-wave split)

These cluster the 100 findings into sessionable waves (each ~5-7 fixes, one mental model). Waves 1-4 are **correctness/clarity hardening** (mostly ambiguity-guardian + the 6 criticals); Waves 5-8 are **product-capability builds** (mostly feature-scout). Earlier waves carry the legal/money/security risk.

### Wave 1 — Legal truthfulness & UPL guardrails (the compliance spine) — 7 findings
The product's core liability surface: stop showing UPL-flagged text, reconcile full-service marketing claims, and wire the "counsel-approved / verified-fresh" gates that are documented but enforce nothing.
- C form-field-guidance #1 — gate guidance display on `attorneyReady !== false`, fall back to advice-free `mockGuidance` when blocked
- C marketing-site #1 — reconcile the "Live" stepper copy with self-serve reality
- C validation-jurisdiction #1 — make `counselApproved` gate the filing path (or document it's display-only with recorded reasoning)
- A validation-jurisdiction — runtime staleness should warn/block a program, not only the CI test
- A validation-jurisdiction — `jurisdictionFor` unknown code → explicit, not silent US default
- A marketing-site — source or soften the "$8,000–$15,000" firm-fee stat repeated across 3 pages
- A petition-drafting — hallucinated `(Exhibit N)` citations should block/hard-warn at save/file, not advisory-only

### Wave 2 — Money & metering integrity — 6 findings
Every finding here can mis-bill a real user or let a paid op be double-charged.
- A checkout-bundles — partial/amount-mismatched refund must claw back the *refunded amount*, not the full bundle
- A token-economy — collapse the 3 "is metering on?" predicates onto `isStoreConfigured()` (Firestore prod shows "∞" while billing)
- A token-economy — document + enforce the `charge` idempotency key (`reason='debit'`) with a unique index
- F ai-orchestrator — accept a client request-idempotency key so a retry on `draft`/`rfe` doesn't double-charge + re-call the model
- A rfe-drafting — derive the "5 tokens" button label from `costOf("rfe")`, not a hardcoded literal
- A rate-limiting — source `PREVIEW_LIMIT` from the registry instead of a hardcoded 30

### Wave 3 — Access control & consent integrity — 6 findings
- C auth-session — fail-close / unify `isAttorney` so the permissive twin can't reopen the IDOR class
- C consent-onboarding — give `CONSENT_VERSION` recorded semantics + release coupling
- A evidence-vault — categorize must re-derive `classification` server-side from the resolved case (don't trust the client body)
- F data-adapter — route case-LIST reads (`getCasesForUser`/`getCasesInReview`) through the adapter seam (review-queue cross-tenant read gated only at the page)
- A consent-onboarding — re-consent must honor a CHANGED marketing choice, not only a version bump
- F consent-onboarding — add an identity/abuse gate to the one-time free token grant

### Wave 4 — Reliability & durability — 6 findings
- A llm-engine — add a timeout/AbortSignal to the production Gemini call (+ reclaim on timeout)
- F llm-engine — retry/backoff on transient model errors before degrading to mock
- A llm-engine — make the output guard blocking for JSON routes (or document non-blocking by design)
- A event-bus — fire-after-commit has no outbox: a crash between write and `publish()` loses the event — add an outbox seam or document the at-most-once contract
- F data-adapter — evidence removal is a permanent hard-DELETE → soft-delete + audit trail for a legal vault
- A data-adapter — document/tighten `resolveCase`'s mid-call "store dropped" re-probe (can mask a real `forbidden`)

### Wave 5 — Attorney workflow & filing safety (feature) — 6 findings
- 🔴 event-bus #1 (Critical) — real attorney notification channel (email) — biggest legal-deadline risk
- F attorney-review — sign-and-file must confirm a draft + exhibits exist before minting a receipt
- F attorney-review — RFE/Denied decisions need a next-step + deadline tracker (don't leave the case stuck in "Filed")
- A attorney-review — queue "age" SLA clock should key off submit time, not `updated_at` (any note resets it)
- F attorney-review — real e-signature + USCIS receipt capture (currently stubs)
- F event-bus — durable event log + dead-letter + replay

### Wave 6 — Drafting & screening deliverables (feature) — 6 findings
- F petition-drafting — Copy/Download/Print the finished letter on the happy path (serializer already exists)
- F rfe-drafting — surface/restore prior RFE response versions (storage is versioned, UI is unreachable)
- F evidence-vault — PDF/image upload (vault is paste-text-only while UI promises OCR)
- F eligibility-screening — persist/resume anonymous & best-path screenings (no CV re-paste)
- A eligibility-screening — surface EB-1A's higher final-merits/green-card bar in the single-classification verdict
- F form-field-guidance — saved history of generated guidance (each charged answer is currently discarded)

### Wave 7 — Case-file honesty & design-system primitives — 6 findings
- F case-file-dashboard — real case-detail view needs the eligibility read-out (only the mock dashboard has it)
- A case-file-dashboard — detail "{classification} criteria" badge hardcodes O-1A threshold out of view
- F brand-design — shared Toast/notification primitive (3 ad-hoc copies exist)
- F brand-design — Modal/Dialog primitive (focus-trap/Escape/z-index re-implemented per popover)
- A brand-design — documented z-index scale (scattered magic numbers today)
- A ai-orchestrator — record the `adjudicate`-skip-on-mock vs `persist`-always contract (saved doc may lack a risk assessment)

### Wave 8 — Billing/account UX + observability + eval (feature/tail) — the rest
Token-ledger history view, billing receipts page, recurring-bundle subscription affordances, marketing social-proof/testimonials, consent/marketing-preference management, account deletion + GDPR export, in-app role/org management, limiter abuse alerting, eval regression baseline + qualify-temperature parity, validation re-verification changelog, and the remaining mediums/lows per each report.

---

## How this scan was run

- **Scanners**: `feature_scout` (🔍, business/discovery lens) + `ambiguity_guardian` (🌀, clarity/intent lens) from Vibeman's agent registry, run COMBINED — each context subagent produced 5 findings spanning both lenses (target ~50/50).
- **Scope**: all 20 contexts (7 groups), full-stack (no `src-tauri/` — this is a Next.js app).
- **Method**: 20 isolated `general-purpose` subagents, each read-only over one context's files (plus thread-following), wrote one markdown report; orchestrator read only the terse replies.
- **Files read (scan)**: ~220 across all subagents (avg ~11/context).
- **Verification**: findings counted three independent ways, all = 100.
- **Context-map drift noted** (does NOT affect findings): a few listed paths no longer exist or moved — `qualification/questionnaire.ts`, `lib/data/documents.ts`, `events/subscribers/analytics.ts`, brand `StatCard.tsx`/`SectionHeader.tsx`/`lib/format.ts`; guidance `CitationNote.tsx`/`DisclaimerStamp.tsx` live under `src/components/legal/`. Worth a `refresh_context` pass for contexts 2, 9, 15, 19.
- **Prior-scan dedup**: the rate-limiting subagent confirmed the 2026-06-20 IP-spoof/leftmost-XFF/unbounded-Map criticals are ALREADY FIXED and did not re-flag them; the llm-eval subagent confirmed the `sentenceCount` NUL-byte/abbreviation issue is RESOLVED (`maskNonTerminalPeriods`).
