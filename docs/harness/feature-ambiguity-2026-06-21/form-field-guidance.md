# USCIS Form-Field Guidance — Feature Scout + Ambiguity Guardian

> Context #3 · Group: Petition Drafting & Document Generation
> Total: 5 findings

## 1. Live UPL gate flags legal-advice language but the flagged text is still shown verbatim
- **Lens**: ambiguity-guardian
- **Priority**: Critical
- **Category**: edge_case
- **File**: `src/features/guidance/components/FieldGuidancePanel.tsx:270-296` (display) · `src/lib/llm/adjudication-gates.ts:370-375,415-420` (gate)
- **Observation**: For the `guidance` op the only domain gate is `legalAdviceGate`, which returns `verdict: "fail"` when `matchedAdvice()` hits an ADVICE_PATTERN (e.g. "you should file…", "you will qualify…"). A `fail` makes `summarize()` set `risk: "blocked"` and `attorneyReady: false`. But the panel renders `result.guidance` unconditionally — `{status === "done" && result ? (… <p>{result.guidance}</p> …)}` — and only renders `<AdjudicationBadge>` *alongside* it. So when the system itself detects unlawful-practice / outcome-prediction language, it shows that exact text to the applicant and merely badges it "blocked". There is no recorded decision on whether a `blocked` guidance answer should be suppressed, regenerated, or displayed.
- **Proposal**: Decide and encode the contract: on `risk === "blocked"` (or `legalAdviceGate` fail) for guidance, do NOT show the raw model text — fall back to the deterministic `mockGuidance` template (which is advice-free by construction) and surface the badge, or re-request. At minimum, gate the `<p>{result.guidance}</p>` render on `result.adjudication?.attorneyReady !== false`. Document the chosen behavior in the route's `adjudicate` comment.
- **Value / Risk-if-ignored**: This is the product's core UPL safeguard on its single most "tell-me-what-to-do"-prone surface. Today a model that says "you should file an O-1A" is flagged and then displayed anyway — the exact unauthorized-practice-of-law output the disclaimer is meant to prevent reaches the user. Wrong-legal-outcome and liability exposure.
- **Effort**: S

## 2. No saved history of generated guidance — each charged answer is discarded
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/app/api/guidance/route.ts:40-90` (no `persist`) · `src/features/guidance/components/FieldGuidancePanel.tsx:33,90-111`
- **Observation**: Guidance is a metered, charged op (`costOf("guidance")` token, `tier: "light"`), yet the route's `AiOperationSpec` defines no `persist` hook — unlike `qualify`/`draft`, which do. The panel keeps exactly one `result` in component state; changing the form (`onFormChange`) or submitting again replaces it, and a reload loses everything. A paying applicant assembling an I-129 with many fields must re-pay and re-read every answer they already generated.
- **Proposal**: Add a best-effort `persist` hook (the orchestrator already supports it and merges its fields onto the body) that records `{ formId, fieldLabel, situation, guidance, source, createdAt }` per user, and a simple "Previous guidance for this form" list in the panel. Reuse the same fixtures→DB seam used elsewhere in the app.
- **Value / Risk-if-ignored**: Turns a one-shot toy into a workflow tool for filling out a multi-field form; reduces duplicate charges (better perceived value) and gives the user a reviewable record to hand their attorney of record. Without it the feature feels disposable and silently bills for re-asks.
- **Effort**: M

## 3. Guidance can cite statutory sections but never shows the "verify citations" reminder that draft/RFE do
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: user_benefit
- **File**: `src/features/guidance/components/FieldGuidancePanel.tsx:270-296` · `src/components/legal/CitationNote.tsx:8` · `src/features/drafting/components/DraftStudio.tsx:489`
- **Observation**: `CitationNote` ("Confirm every statutory and regulatory citation… generated text can reference the wrong provision") is rendered on draft and RFE output (`DraftStudio.tsx:489`, `RfeStudio.tsx:281`) but NOT on guidance. Yet the guidance prompt explains "what kinds of information typically belong there," the adjudication layer ships `caseLawGate`/`stripLegal` precisely because immigration guidance text references INA / 8 C.F.R. sections, and field guidance for "Part 2 — Basis for Classification" will naturally mention regulatory provisions. The component is listed as part of this context but unused here.
- **Proposal**: Render `<CitationNote />` on the `status === "done"` guidance result (alongside the existing `DisclaimerStamp`), so any statutory section the model surfaces carries the same "attorney of record verifies all legal authorities" reminder as the letters do.
- **Value / Risk-if-ignored**: Closes a consistency gap auditors notice — the safeguard appears on long letters but vanishes on the field-by-field guidance an applicant reads while actually typing into the form. Low effort, real UPL/consistency value.
- **Effort**: S

## 4. Model output is silently truncated at 6 sentences mid-thought with no signal to the user
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: trade-off
- **File**: `src/app/api/guidance/route.ts:13-14,61-66` · `src/lib/llm/adjudication-gates.ts:235-248`
- **Observation**: `GUIDANCE_MAX_SENTENCES = 6` feeds `clampSentences(text, 6)` in the `guard`, which slices the text after the 6th terminal punctuation: `return trimmed.slice(0, m.index + 1).trim()`. The prompt asks for "3–6 short sentences," but a model that returns 7 has its 7th sentence dropped with no ellipsis, marker, or note — and the user is still charged the full token. The intent ("trim a runaway wall of text") is reasonable, but the boundary between "concise contract" and "lost the punchline" is undocumented, and there's no recorded reasoning for 6 vs. the prompt's stated max, nor for hard-cutting vs. flagging.
- **Proposal**: Either (a) raise the guard ceiling above the prompt's stated max (e.g. clamp at 8) so a compliant 6-sentence answer is never cut, and/or (b) when truncation actually occurs, append a visible marker or set a `truncated: true` field the panel can surface. Add a one-line comment recording why the cap is 6 and why silent vs. flagged.
- **Value / Risk-if-ignored**: A paid answer can end mid-instruction (e.g. cut off before "…flag anything you're unsure about for your attorney"), dropping the very attorney-review handoff the product depends on. Quiet data loss on a charged op.
- **Effort**: S

## 5. One MAX_FIELD = 4000 bound is applied to three semantically different fields with no rationale
- **Lens**: ambiguity-guardian
- **Priority**: Low
- **Category**: code_quality
- **File**: `src/features/guidance/guidance.ts:34-37,78-84`
- **Observation**: `MAX_FIELD = 4000` is enforced identically on `formId`, `fieldLabel`, and `situation` (`formId.length > MAX_FIELD || fieldLabel.length > MAX_FIELD || situation.length > MAX_FIELD`). A `formId` is a short token like "I-129" and a `fieldLabel` is a short phrase; only `situation` is genuinely free-form. The docstring justifies the value only for "each free-text guidance field," and the constant's origin/units (characters? why 4000?) aren't recorded. A 4000-char `formId` passes validation, then gets interpolated straight into the model prompt — wasting the light-tier budget and muddying the prompt — even though no legitimate form number is more than ~8 chars.
- **Proposal**: Either document why a single 4000-char cap is acceptable for all three, or split the bound (e.g. `MAX_FORM_ID`/`MAX_FIELD_LABEL` small, `MAX_SITUATION = 4000`) so the validation matches each field's real shape. Note the rationale for the number inline.
- **Value / Risk-if-ignored**: Cosmetic today but it lets absurd values reach the prompt and obscures intent for the next dev/auditor reasoning about input bounds on a billed AI path. Cheap to clarify; prevents a future "why is a form id allowed to be 4 KB?" bug.
- **Effort**: S
