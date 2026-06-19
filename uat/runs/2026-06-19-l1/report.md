# UAT run scorecard — 2026-06-19-l1

- **Run id:** 2026-06-19-l1
- **Date:** 2026-06-19
- **cert_level:** **L1** (theoretical, code-grounded — no browser)
- **Engine note:** A real Claude CLI is available and reserved for L2 (live-browser, real model output). L1 is **code-only**: it audits grounding, reachability, and structure from file:line, but cannot see the model's actual draft/qualify prose. Every "is the live prose senior-grade?" question is deferred to L2 (see SUMMARY.md).
- **Reviewers:** 5 Characters — Priya Nair (researcher/beneficiary), Sam Reyes (founder/beneficiary), Devin Cruz (paralegal/operator), Maya Okonkwo (attorney/operator), Karen Whitfield (cold prospect/buyer).
- **Findings:** 43 total = **0 blocker · 6 major · 17 minor · 20 polish**; 19 are STRENGTHS. By dimension: trust 23, clarity 10, senior-quality 5, completion 2, missing 2. Verdicts: 37 confirmed · 4 uncertain · 2 refuted.

---

## Per-journey verdicts

| Journey | Characters who walked it | L1 verdict | Top finding |
|---|---|---|---|
| qualify-verdict | Priya, Sam, Devin, Karen | **L1-pass** | Grounded on real pasted profile; 8 canonical criteria, ≥3 threshold from pack, "None" never green (dc-qualify-01 / kw-qual-02). Nits: free hero is keyword-mock (SR-QV-01, kw-qual-01). |
| draft-petition-letter | Priya, Sam, Devin, Maya | **L1-conditional** | dc-draft-01 (major): single-section regenerate merges into the last STORED draft, silently dropping unsaved edits to other sections. |
| organize-evidence | Priya, Devin | **L1-pass** | Monotonic never-reused exhibits; misfits → Unsorted, not a fabricated bucket (dc-evidence-01). Minor: single-doc categorization context (PN-EVID-01). |
| attorney-review-and-file | Maya | **L1-conditional** | mo-review-02 (major): "Sign & file with USCIS" is a bare one-click submit — no confirm / no statement of effect. Plus mo-review-01 (overlay-fixture gap, now fixed — see Appendix). |
| respond-to-rfe | Devin, Maya | **L1-pass** | Properly grounded on original petition criteria + vault exhibits + RFE text, gated to Filed cases. Minor parity gap: no live adjudication gate on RFE output (dc-rfe-01 / mo-rfe-01). |
| evaluate-as-prospect | Priya, Sam, Karen | **L1-conditional** | **FAQ↔positioning contradiction** (kw-eval-01 = PN-PROS-01, major, dedup) + /validation unreachable from cold marketing (kw-eval-02, major). |
| track-case-progress | Priya, Sam, Devin, Maya | **L1-pass** | Roadmap + dashboard derive from real case state; IDOR-closed hydration; atomic CAS transitions (dc-track-01 / mo-track-01). Sam flags env-mode list suppression (SR-TP-01, uncertain). |
| share-verdict | Sam, Karen | **L1-pass** | Stateless, privacy-safe, tamper-rejecting certificate; encodes only postable facts, never profile text (SR-SV-01 / kw-share-01). |

**Tally:** 5 L1-pass · 3 L1-conditional · 0 L1-fail.

---

## Confirmed findings by severity

### MAJOR (6 raised → **5 distinct** after dedup)

The two FAQ findings (kw-eval-01, PN-PROS-01) are the **same defect raised independently by Karen and Priya** — counted once, the run's strongest cross-cutting theme.

| id(s) | character(s) | journey | dimension | title | evidence | suggested acceptance |
|---|---|---|---|---|---|---|
| **kw-eval-01 + PN-PROS-01** (dedup) | Karen + Priya | evaluate-as-prospect | trust | **FAQ reads as a full-service flat-fee LAW FIRM** ("same attorney listed as counsel of record" signs the I-129, biometrics coordination, "attorney portion of the flat fee is non-refundable") — the opposite of the site-wide "drafting tool, NOT a law firm; your own attorney signs" + token-economy model | `src/app/faq/page.tsx:22,26,30,38,46,50,68`; contradicts `src/app/page.tsx:254` | Rewrite FAQ to describe the actual product: AI drafts work product, the user's **own** attorney of record reviews/signs (platform supplies no counsel), price is **prepaid tokens** not a flat legal fee, RFE responses are a drafting feature; drop biometrics/translator/privilege claims. Add shared positioning copy / CI lint so FAQ can't drift from the landing UPL line. |
| **kw-eval-02** | Karen | evaluate-as-prospect | missing | The strong `/validation` evidence page is **unreachable from any cold-prospect marketing surface** — linked only inside the authenticated /qualify panel, downstream of the adoption decision | link only at `src/features/qualification/components/QualifyPanel.tsx:165`; absent from `src/app/page.tsx`, /billing, /faq footers | Add a /validation link to the shared marketing footer (and the FAQ "correctness/security" answer). The page content is a strength; only the gating is the defect. |
| **dc-draft-01** | Devin | draft-petition-letter | trust | **Single-section regenerate persists by merging into the last STORED draft**, not the client's current sections; plain textarea edits are local-only (no autosave, no Save button) → edit Section A, regenerate Section B, reload → A's edit is **silently lost** on a paid path | `src/features/drafting/draftOperation.ts:205,217`; `src/features/drafting/components/DraftStudio.tsx:218,325`; `src/app/dashboard/cases/[id]/page.tsx:89` | Send the client's full current sections with the focus regenerate and merge server-side against THOSE; or auto-persist (debounced no-charge) before regenerate; or add a Save-edits button + block regenerate on unsaved edits. The saved version must never silently lose a section edit. |
| **mo-review-02** | Maya | attorney-review-and-file | clarity/trust | **"Sign & file with USCIS" is a bare one-click submit** — no confirmation, no statement of effect — for the single most consequential, signature-bearing action under the attorney's bar license (the adjacent applicant "Submit for review" even has microprint; this has none) | `src/features/review/components/ReviewPanel.tsx:130,131`; `src/features/review/actions.ts:144` | Add a confirm affordance / inline "This signs the petition and files it with USCIS — case moves to Filed and receives a receipt number" before `attorneySignAndFile`. (Mitigant: idempotent at the data layer + a recorded stub, so irreversibility risk is low — but the intentionality UX still falls short.) |
| **mo-review-01** | Maya | attorney-review-and-file | completion | **REFRAMED — surface-model/overlay gap, NOT an app bug.** Empty `ATTORNEY_EMAILS` denied developer@localhost the whole attorney workflow. The **code is correct and a security strength** (fail-closed `isConfiguredAttorney`: empty allowlist denies everyone, blocking cross-tenant PII enumeration). The real defect was the **UAT overlay's env premise** ("empty = demo-unlock"), now **FIXED** | `src/lib/auth/roles.ts:40,45`; `src/features/review/actions.ts:51`; overlay `uat/env.md`, `uat/accepted-gaps.md` (corrected) | **Resolved at the overlay layer:** env.md + accepted-gaps.md corrected; `.env.local` now sets `ATTORNEY_EMAILS=developer@localhost`. Record as (a) a surface-model gap L1 caught + corrected, and (b) a fail-closed RBAC **strength to protect** (`roles.ts:40`, `owner-only-gate.test.ts`). Do NOT touch the fail-closed default. |

### MINOR (confirmed)

| id | character | journey | dimension | title | evidence | suggested acceptance |
|---|---|---|---|---|---|---|
| PN-DRAFT-01 | Priya | draft-petition-letter | senior-quality | Draft grounded on qualify-time per-criterion paraphrases + vault exhibit facts, **not the full pasted CV** — a rich CV never re-entered into the Evidence Vault yields a thin grounding payload | `draftOperation.ts:106,119`; `drafting.ts:195`; `api/qualify/route.ts:98` | Prompt the user to populate the vault before drafting, or persist/optionally pass the original profile text as added grounding. |
| dc-draft-02 | Devin | draft-petition-letter | senior-quality | Section-regenerate prompt sees only the focus criterion, not the rest of the letter → can't keep narrative continuity (persistence keeps other sections; prose-continuity gap, not structural loss) | `drafting.ts:211,230`; `draftOperation.ts:132` | Optionally include other sections' headings (+ trimmed bodies) as read-only context. |
| dc-rfe-01 / mo-rfe-01 | Devin + Maya | respond-to-rfe | trust | **RFE response generation has no live adjudication gate** the draft route runs — a hallucinated number / leaked case-law cite / wrong code in an RFE isn't flagged the way it is on a draft | `api/rfe/route.ts:44,45`; `draftOperation.ts:167`; `adjudication-gates.ts:294,296,299` | Add an `adjudicate` hook to the RFE spec wiring `runAdjudication({ operation: 'rfe' })` — gate already has an `rfe` branch; a few lines for parity. |
| dc-rfe-02 | Devin | respond-to-rfe | senior-quality | RFE prompt grounds on scored criteria + evidence + exhibits, but NOT on the actual drafted petition-letter prose (right for most RFEs; one rung short of full fidelity) | `rfe.ts:147,176`; `api/rfe/route.ts:86,99` | Optionally fuse the latest stored draft sections into the RFE prompt as "as-filed petition" context. |
| PN-EVID-01 | Priya | organize-evidence | missing | Categorization sees one document at a time, no cross-vault context (no de-dupe / sibling grouping) | `evidence.ts:98`; `api/evidence/categorize/route.ts:62` | Acceptable for MVP; if hardened, pass a compact summary of existing buckets. |
| SR-QV-01 | Sam | qualify-verdict | clarity | Landing hero + best-path run the **keyword mock**, not the model; a pure GitHub/product founder (no press/patent) is under-scored on the free read until the authenticated model path runs | `api/qualify/preview/route.ts:18`; `preview/best-path/route.ts:11`; `packs.ts:62,74` | Widen keyless ORIGINAL/CRITICAL_ROLE heuristics for GitHub/open-source/product signals, or make the keyword-preview-vs-model distinction explicit on the hero/soft-gate. |
| kw-qual-01 | Karen | qualify-verdict | senior-quality | Free hero verdict is keyword/regex-only — can under-score a strong record phrased off-keyword. By-design + disclosed; caps the free read's senior ceiling | `api/qualify/preview/route.ts:69`; `qualification.ts:225`; `InstantVerdict.tsx:255` | Keep the keyless preview as the cost/abuse-safe floor; ensure SoftGate copy makes the keyword-floor nature legible. No structural change required. |
| kw-eval-03 | Karen | evaluate-as-prospect | trust | FAQ names **"Gemini"** as the drafter; engine attribution inconsistent/stale vs the multi-engine wrapper (UAT engine = Claude) | `faq/page.tsx:26`; `api/qualify/route.ts:53` | Make the FAQ engine-agnostic ("our AI drafts…") or align the named engine with actual config. |
| PN-PROS-02 / SR-EV-01 | Priya + Sam | evaluate-as-prospect | clarity | `/billing` "one token = one AI form-field guidance answer" **understates the real per-op cost** (qualify 3, draft 12, section/RFE 5) — legacy form-field copy; landing footnote already self-corrects | `billing/page.tsx:56,130`; `tokens/registry.ts:37`; `page.tsx:369` | Align /billing "what a token buys" copy with the registry — a small per-op price list from the OperationRegistry. |

*(Carried as uncertain — dc-evidence-02, kw-eval-04, SR-TP-01 — in the Appendix.)*

### POLISH

20 polish findings total. **19 are STRENGTHS** (type=strength), deduped + grouped in "What passed" below. The one non-strength polish item is PN-QUAL-01 (certificate/"Approved" framing skirts the "horoscope" line) — **verdict uncertain**, see Appendix.

---

## What passed — strengths to protect (deduped, grouped by theme)

**1. Citation discipline + fabrication defense (the trust spine).** Real-vault exhibit binding (`attachExhibits`, never from inline free text); inline `(Exhibit N)` audit quarantining hallucinated cites as `unresolved`; a **live adjudication gate** scanning every paid draft for fabricated specifics ($/%/years/big-ints), leaked case-law cites, wrong visa codes, surfaced as a visible "verify:" badge; orchestrator reclaims the charge and labels `source:"mock"` so boilerplate is never billed as model output. *(dc-cross-01, PN-DRAFT-S1, SR-DP-01, mo-draft-01, mo-draft-02 — `drafting.ts:174,472,556`; `adjudication-gates.ts:122`; `draftOperation.ts:167`; `operation.ts:312`.)* **Do not weaken the exhibit binding, citation audit, or the live gate.**

**2. The UPL line is load-bearing + single-sourced.** One `DISCLAIMER` constant via one `wrapResult`/`buildXResult` chokepoint, rendered first + non-dismissibly on every success AND every error body (402/429/500), byte-asserted by the disclaimer gate. *(SR-QV-02, kw-qual-02, mo-draft-01 — `result.ts:37`; `operation.ts:255/278/341`; `CriteriaReport.tsx:47`; `DisclaimerStamp.tsx:8`.)* **Do not fork or weaken this string or the chokepoint.**

**3. Qualify grounding + criteria honesty.** Real profile injected verbatim with hard anti-fabrication + per-criterion isolation rules; parser always returns the full canonical 8 criteria, fills omissions with "None"; "None" → neutral, never green, never counts toward the ≥3 threshold (single-sourced, ADR-0002); live qualify gate re-checks it all. *(dc-qualify-01, PN-QUAL-S1, SR-QV-02 — `qualification.ts:120,131,202`; `criteria.ts:27,74`.)*

**4. `/validation` is real evidence, not adjectives.** Primary-law citations (8 CFR 214.2(o)(3)(iii), 204.5(h)(3)), USCIS Policy Manual + Arizona ABS order links, review dates + freshness countdown, an honest verified-vs-counsel-approved two-layer model, self-flagged UK "MODEL MISMATCH," CI-gated so no live program ships unverified. *(kw-eval-06, PN-PROS-S1 — `validation.ts:54,127,141,152`.)* **Protect — and surface it from the marketing footer (kw-eval-02).**

**5. Pricing can't drift.** Landing + /billing both render from canonical `BUNDLES` / `FREE_SIGNUP_GRANT` in `economy.ts`; /pricing 301s to /billing; enterprise contact-wall scoped to the enterprise tier only; no dark patterns ("no" costs nothing). *(kw-eval-05 — `economy.ts:43`; `page.tsx:13`; `billing/page.tsx:10`.)*

**6. Stateless, privacy-safe share certificate.** Token encodes only name/classification/likelihood/per-criterion status — never the profile text; /c/[token] + OG card render from the token alone (no DB); tamper-rejecting decode (non-live program / mismatched count → 404); honest "informational only" framing. *(SR-SV-01, kw-share-01 — `letters-patent.ts:69,84,93`; `c/[token]/page.tsx:43,118`.)*

**7. Evidence integrity.** Monotonic, never-reused exhibit numbers from a transactional high-water mark (deletes don't renumber survivors); misfits coerced to **Unsorted**, never a fabricated bucket; gap read from real per-criterion coverage; live bucket gate fails any out-of-pack label. *(dc-evidence-01 — `pglite-store.ts:646`; `evidence.ts:80,107,188`.)*

**8. Airtight state machine + honest queue + fail-closed RBAC.** Atomic compare-and-set status transitions (no double-file / no second receipt), append-only review log in the same transaction, "Approved" terminal + server-allowlisted; queue oldest-first at DB **and** view with truthful fresh/warning/overdue age badges (future-timestamp-safe); cross-tenant reads + all sign/file actions gate on `isConfiguredAttorney` (**fail-closed** — empty allowlist denies everyone, preventing cross-tenant PII enumeration). *(mo-track-01, mo-review-03, dc-track-01 — `pglite-store.ts:433,480`; `queue-age.ts:26`; `roles.ts:40`.)* **Do not relax the fail-closed default.**

**9. RFE prompt is properly grounded + correctly gated.** Receives original petition criteria + evidence + rationale + fused vault exhibits + the pasted RFE text (not the RFE alone); structured point-by-point; gated to Filed cases only; owner-or-attorney resolved before charge. *(dc-rfe-03 — `rfe.ts:176`; `api/rfe/route.ts:60`; `CaseDetailView.tsx:224`.)*

---

## Appendix — refuted + uncertain findings (verdict ≠ confirmed)

**Refuted (2):**
- **PN-QUAL-02** (Priya, qualify) — "anonymous hero + best-path are keyword-mock, not the model." Refuted as a defect: by-design and clearly labelled (`source:"mock"`, "instant read", SoftGate invites the real screening). Recorded only so L2 confirms she lands on the model path. (`preview/route.ts:18`.)
- **dc-track-02** (Devin, track) — "fixed mock 'Dr. Anya Krishnan / O1-241' case is the dashboard visual hero." Refuted — accepted gap (illustrative demo portfolio); real cases already list above it. (`CaseFileDashboard.tsx:34`.)

**Uncertain (4):**
- **dc-evidence-02** (Devin, evidence) — unvalidated refile can silently inflate coverage. Legitimate manual override; acceptable for MVP. Uncertain pending a decision on coverage = "documents present" vs "criterion proven." (`EvidenceVault.tsx:113`.)
- **kw-eval-04** (Karen, prospect) — /landing-claude alt masthead lacks FAQ/validation/pricing links + carries only an inline (not stamped) disclaimer. Uncertain — depends on whether /landing-claude is a real cold-entry route or an internal demo. L2 to confirm. (`landing-claude/page.tsx:63,69,199`.)
- **SR-TP-01** (Sam, track) — dashboard real-case list suppressed under `TOKENS_BYPASS=1` (the mode env.md recommends for quality journeys). Case is still created + reachable via the /qualify → Open case file deep-link; list works in real-economy mode. Uncertain — env-mode interaction, not a structural dead-end; L2 to run J5 in both modes. (`dashboard/page.tsx:15,28`.)
- **PN-QUAL-01** (Priya, qualify, polish) — "Certificate of Extraordinary Ability"/"Approved" framing skirts her horoscope pet peeve. Styling over honest data; uncertain / subjective — L2 to judge live whether the certificate theater aids or undermines credibility. (`InstantVerdict.tsx:220`; `page.tsx:214,228`.)
