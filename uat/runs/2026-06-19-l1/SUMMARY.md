# Cross-Character synthesis — run 2026-06-19-l1 (L1, code-grounded)

5 voices, 8 journeys, 43 findings (0 blocker · 6 major · 17 minor · 20 polish; 19 strengths). 5 L1-pass · 3 L1-conditional · 0 L1-fail. The product's engineering spine is unusually strong; the gaps that matter cluster on the **marketing/positioning surface** and on **two consequential, under-ceremonied actions** (regenerate-save, sign-and-file). L1 cannot see live model prose — the central quality question is reserved for L2.

---

## Cross-cutting themes (deduped across characters)

**1. The FAQ contradicts the entire positioning — raised independently by TWO reviewers (headline theme).** Karen (kw-eval-01) and Priya (PN-PROS-01) walked in cold/skeptical, went to the FAQ to kill their UPL objection, and found a **different company**: a full-service flat-fee immigration *firm* — "the same attorney listed as counsel of record" signs the I-129, biometrics coordination, non-refundable attorney fee, ATA translator bench, "we comply with attorney–client privilege." This is the exact opposite of the landing/billing/validation story (drafting tool, NOT a law firm; **your own** attorney signs; price is prepaid tokens). Two careful buyers independently named it the one thing between "interesting" and "yes." It is the single most leveraged fix in the run: a copy rewrite that converts the run's biggest trust hit into alignment. (`src/app/faq/page.tsx:22-68` vs `src/app/page.tsx:254`.) Karen also caught the FAQ naming "Gemini" as the drafter (kw-eval-03) — same surface, same drift.

**2. The trust dimension dominates — 23 of 43 findings, and it's mostly EARNED.** The trust cluster is lopsided toward strengths: citation discipline, the single-sourced UPL disclaimer, the live fabrication adjudication gate, never-billing-mock-as-model, fail-closed RBAC, monotonic exhibits, the privacy-safe share token. Every operator (Priya, Devin, Maya) independently flagged the same spine — *citation discipline baked into the code, not the marketing* — as the reason they'd trust it. The trust **gaps** are narrow and surgical: FAQ drift (theme 1), the silent edit-loss on regenerate, the unceremonious sign-and-file, and the RFE-route adjudication-gate omission. The trust posture is the product's moat; the gaps are edges on an otherwise-sharp blade.

**3. "Good machinery, thin context" — grounding depth depends on what the user feeds it.** Priya (PN-DRAFT-01) and the L2 priorities across all five reports converge here: the draft prompt argues from qualify-time per-criterion *paraphrases* + vault exhibit facts, **not** the full pasted CV. The pipe is grounded and anti-fabrication; the richness is only as good as a populated Evidence Vault. Adjacent: single-doc categorization (PN-EVID-01), section-regen lacking letter context (dc-draft-02), RFE grounding on criteria not the filed prose (dc-rfe-02). None are structural defects — all are "feed it well / L2 must verify the live output actually uses the inputs."

**4. The free keyword-floor vs the model ceiling — a managed-expectation gap.** Sam (SR-QV-01) and Karen (kw-qual-01) both noted the anonymous hero + best-path run the deterministic keyword mock, so an off-keyword strong record (a GitHub/product founder; "chaired a standards committee") gets under-scored on the free read. By-design, cost/abuse-safe, and disclosed — but it caps the free read's senior ceiling, and L2 must confirm the authenticated model path is meaningfully sharper.

**5. Consequential actions lack ceremony — the two paid/signature moments.** Devin (dc-draft-01) and Maya (mo-review-02) independently flagged that the app's two heaviest actions are under-protected: regenerating a section **silently drops** unsaved edits to others (paid path, no autosave/Save button), and "Sign & file with USCIS" is a **naked one-click submit** under the attorney's bar license. Both are "make the gesture as weighty as the act" fixes.

**6. Best evidence is buried — discoverability gap.** Karen (kw-eval-02): the `/validation` page — the single strongest credibility artifact, and a confirmed strength — is reachable only from inside authenticated /qualify, never from any cold marketing surface. The page that most moves a skeptic's verdict is the one she'd never find.

---

## Prioritized backlog

There are **0 blockers**, so P0 = the majors that most threaten the **core promise** (credible, compliant AI drafting that your own attorney signs).

### P0 — core-promise / job-blocking
- **[FAQ positioning rewrite]** (kw-eval-01 + PN-PROS-01, dedup; + kw-eval-03 Gemini name). Rewrite the FAQ to the actual product (your own attorney signs; prepaid tokens not flat fee; drop firm/biometrics/privilege claims); add shared positioning copy or a CI lint so FAQ can't drift from the landing UPL line. *Two reviewers, the run's #1 trust hit, a copy-only fix.*
- **[Stop silent edit loss on regenerate]** (dc-draft-01). Merge the focus regenerate against the client's *current* sections (or autosave before regenerate, or a Save-edits gate). A paid path must never silently drop a section edit.
- **[Sign & file confirmation]** (mo-review-02). Add a confirm step / statement-of-effect before `attorneySignAndFile`. The most consequential signature action under a bar license cannot be a bare one-click submit.

### P1 — trust + senior-quality
- **[RFE adjudication-gate parity]** (dc-rfe-01 / mo-rfe-01). Wire `runAdjudication({operation:'rfe'})` — the gate already has an `rfe` branch; a few lines so a signed RFE gets the same fabrication/case-law/wrong-code scan as a draft.
- **[Surface /validation from cold marketing]** (kw-eval-02). Add it to the shared footer + the FAQ correctness answer — one click from a cold landing.
- **[Draft grounding depth]** (PN-DRAFT-01). Prompt users to populate the vault before drafting, or pass the original profile text as added grounding, so the draft argues from the full record not one-line paraphrases.
- **[Keyword-floor vs model ceiling]** (SR-QV-01 / kw-qual-01). Widen keyless heuristics for GitHub/product signals or make the preview-vs-model distinction explicit on the hero/soft-gate.

### P2 — polish / clarity
- **[/billing per-op cost copy]** (PN-PROS-02 / SR-EV-01). Replace "1 token = 1 answer" with a per-op price list from the registry (qualify 3, draft 12, section/RFE 5).
- **[Section-regen narrative continuity]** (dc-draft-02) and **[RFE grounds on criteria not filed prose]** (dc-rfe-02) — optional prompt-context enrichments.
- **[Single-doc categorization context]** (PN-EVID-01) — optional whole-vault summary at categorize time.
- **Carry to L2 to resolve:** dc-evidence-02 (refile coverage), kw-eval-04 (/landing-claude entry status), SR-TP-01 (TOKENS_BYPASS dashboard suppression), PN-QUAL-01 (certificate theater — subjective).

---

## Strengths worth protecting (as decision-useful as the gaps — what NOT to touch)

- **Fail-closed cross-tenant RBAC** (`isConfiguredAttorney`, `roles.ts:40`, `owner-only-gate.test.ts`). Empty `ATTORNEY_EMAILS` denies everyone — preventing cross-tenant PII enumeration. The mo-review-01 "developer@localhost denied" finding was a **UAT-overlay env-premise bug (now fixed)**, NOT an app bug: the app behavior is correct and a security strength. **Do not add a default-unlock.**
- **Canonical BUNDLES pricing** (`economy.ts:43`) — landing + billing render from one source; prices and the free grant **cannot drift**. Don't hardcode prices in copy.
- **The single non-dismissible DISCLAIMER** via one `wrapResult` chokepoint on every success AND error body (`result.ts:37`). The UPL line is load-bearing — don't fork or weaken the string or the chokepoint.
- **Honest mock/keyless behavior** — the orchestrator reclaims the charge and labels `source:"mock"`; "Placeholder output" banner; you never pay for boilerplate stamped as model output (`operation.ts:312`).
- **Real `/validation` evidence** — primary-source citations, freshness, self-flagged paraphrasing + UK model mismatch, CI-gated (`validation.ts:54`). Protect the content; only fix its discoverability.
- **Citation discipline end-to-end** — exhibit binding from the real vault, `(Exhibit N)` audit quarantine, live fabrication gate (`drafting.ts:174,556`; `adjudication-gates.ts:122`). The spine that earned every operator's trust.
- **Atomic CAS state machine + monotonic never-reused exhibits + privacy-safe share token** — no double-file, no renumbering, no profile leak.

---

## L2 priorities (consolidated — what live-browser L2 must verify)

The dominant L2 job is **real Claude draft/qualify OUTPUT QUALITY on the grounded path** — L1 certified the machinery is right but cannot see the model's prose.

1. **Live draft prose quality (the whole ballgame).** Feed a real rich CV + populated vault; assert the draft NAMES the supplied evidence, cites the right exhibits per section, crosswalks the correct criterion, and reads like a senior immigration drafter — not generic filler. Confirm the adjudication badge fires on an unsupported metric and does NOT false-positive on legitimately-supplied numbers. (SR-DP-02, PN-DRAFT-01, mo-draft-01, dc-cross-01.)
2. **Live qualify quality.** On authenticated /qualify, confirm the model output is meaningfully sharper than the keyword floor — names real evidence, maps founder GitHub/product → original contribution, round/ARR → remuneration, press → press; scoring calibrated not inflated. (SR-QV-01, kw-qual-01, dc-qualify-01, PN-QUAL-02.)
3. **Attorney round-trip** (now reachable, ATTORNEY_EMAILS set): queue oldest-first with truthful badges; request-changes → Drafting with the note in-thread; sign & file → Filed + receipt; record decision → Approved. Confirm there's still no sign-and-file interstitial (mo-review-02). (mo-review-01, mo-review-03, mo-track-01.)
4. **Regenerate edit-persistence (predicted broken):** edit Section A, regenerate Section B, reload — assert A's edit survives. (dc-draft-01.)
5. **RFE:** generate a response with a number not in the record — confirm nothing flags it (predicted: nothing does) until the gate is wired. (dc-rfe-01.)
6. **Prospect reachability:** confirm FAQ still contradicts the landing live; check /validation footer reachability without auth; resolve whether /landing-claude is a real cold-entry route. (kw-eval-01, kw-eval-02, kw-eval-04.)
7. **Dashboard in both modes:** real cases list in real-economy mode; confirm/decide on TOKENS_BYPASS suppression. (SR-TP-01.)
8. **Share + certificate:** /c/[token] and OG card render credibly (not cheesy); LinkedIn unfurl looks like a real certificate; judge whether the "Approved/Certificate" theater aids or undermines credibility. (SR-SV-01, PN-QUAL-01.)

---

## Panel verdict

This panel **would adopt — conditionally, today, for the qualify→draft loop** — and the conviction is shared across all five voices: the engineering earns trust where it counts (real grounding, citation discipline, a live fabrication gate, an airtight state machine, fail-closed security, a single load-bearing UPL line), and the honesty is real (a `/validation` page that cites the actual regulations and admits what's paraphrased). The **one thing standing between "interesting" and "yes" is the marketing/positioning surface, not the product** — fix the FAQ so it stops describing a flat-fee law firm, give the two heaviest actions (regenerate-save, sign-and-file) the ceremony they deserve, and surface the evidence page — and the conditional becomes unconditional, pending only L2's verdict on whether the live prose reads like a lawyer wrote it.

> **Priya (researcher):** *"I came in ready to catch the machine lying, and on the parts that matter it didn't… the FAQ reads like a different company — fix it and I'm in."*
> **Sam (founder):** *"This one actually respects my time… there's a literal scanner that flags any dollar figure or star count that isn't in what I gave it — that's the difference between this and ChatGPT."*
> **Devin (paralegal):** *"The first AI drafting tool I've seen that smells a hallucination the way I do — but I'd save-as-I-go until the edit-persistence bug is dead."*
> **Maya (attorney):** *"It respects the line between drafting and practicing law, and it treats my signature as the thing that matters… give the filing button the ceremony it deserves and I'd tell a peer to look at it."*
> **Karen (cold prospect):** *"The bones underneath are the most honest I've seen in this category — would I tell a peer? Yes, with the caveat 'ignore the FAQ, read the validation page.'"*
