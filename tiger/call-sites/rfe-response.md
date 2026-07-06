---
id: rfe-response
type: tiger/call-site
modality: text
file: src/app/api/rfe/route.ts:47
wrapper: executeAiOperation (inline spec, route.ts)
provider: gemini (prod) | claude (dev)
model: tier "long" → GEMINI_DRAFT_MODEL ?? gemini-3-flash-preview | claude sonnet
operation: rfe
tier: heavy (5 tokens)
schema: yes — tryParseRfeResponse (rfe.ts:227) via extractJson + tryParseSections (shared with draft)
grounding: 3.5/5 (L1+L2; trim FIXED #115 — drill confirms the evidence now reaches the model)
quality_score: v0 pre-fix 38.5/FAIL → v1 shipped #115 75.3 → v2 +market-framing 93.3 (drill k=4)
code_score: strong (adjudicate, retry, citation discipline); 1 open gap (inputText omits filed prose #9)
value_ceiling: $3,000 RFE labor + denial-avoidance (gates a ~$13k filing) — [[value-model]]
recommended_model: — (single Opus-low engine; needs a matrix)
status: drilled (L2 + drill k=4)
last_scanned: 2026-06-23
characters: ["[[priya-researcher]]", "[[gloria-paralegal]]", "[[maya-attorney]]"]
---
## What it does
Drafts a structured response to a USCIS Request for Evidence — addresses each challenged point,
reinforcing the criteria with on-record evidence. `POST /api/rfe`, owner-or-attorney gated. The
existential, deadline-driven save: a weak response loses the whole filing (and the fee already spent).

## Prompt & grounding
`buildRfePrompt` (rfe.ts:157). Citation discipline + injection defense. Generate opts:
`json:true, tier:"long"` (route.ts:95).
- **Reaches the prompt:** petitioner, classification, scored criteria (name/status/evidence/rationale),
  **the RFE notice text** (required, 20–12000 chars), **the as-filed petition sections** (read-only,
  trimmed to `FILED_SECTION_CHARS=800`/section, rfe.ts:137), exhibits (attachRfeExhibits, route.ts:80).
  ✓✓✓✓ — the only site that grounds on the *as-filed prose* (G1.2 shipped).
- **MISSING:** raw evidence beyond the criteria digest (same ceiling as draft). → **grounding ≈ 4/5.**

## Code quality (wrapping · logging · caching)
- Chokepoint ✓; schema ✓; **adjudicate gate ✓** (route.ts:108 — RFE notice folded into inputText so
  legitimate quotes from the notice don't false-flag as fabrication — a careful detail). Telemetry ✓.
- **No output cache.**
- Prompt-bloat watch: RFE notice (≤12k) + multiple filed sections (≤800 each) → largest non-draft
  prompt; verify the 800-char trim doesn't starve the model of what it's rebutting.

## Findings (L1 — [[2026-06-23-l1]])
- **[value · H/H/H] 800-char filed-section trim severs the challenged passage** (backlog #4). The
  as-filed prose is sliced at `FILED_SECTION_CHARS=800` mid-sentence, no relevance ordering (rfe.ts:137).
  When USCIS challenges a specific argument that straddles the boundary, the model never sees it → the
  4/5 grounding advantage over draft is partly **notional** (gloria + priya both CONDITIONAL). Fix:
  raise to ~1500–2000, or sentence-boundary / RFE-keyword-relevance trimming.
- **[code · M/H/M] Adjudication inputText omits the filed petition** (backlog #9). route.ts:110-113
  passes criteria + notice but not `filedPetition`, so a legit quote from the filed letter can
  false-flag as fabrication. Fix: add filedPetition bodies to inputText.
- **[model · H/H/H] Premium op on Flash** (backlog #2, shared with draft) — RFE also `tier:"long"` →
  Flash when GEMINI_DRAFT_MODEL unset; and RFE is shorter structured output → consider `tier:"fast"`.
- **[code · shared]** no output cache (#5), no maxOutputTokens (#11).
- _Protect:_ adjudicate folds the RFE notice into inputText (notice quotes don't false-flag);
  transient-error retry/backoff; exhibit cites locked to real vault numbers.

## L2 live (Opus-low — [[2026-06-23-l2]])
**[CONFIRMED-FAIL, top fix]** The 800-char trim (rfe.ts:199) is **denial-grade**. Priya's RFE demanded
*independent-adoption* evidence; the real facts (Broad Institute, GATK 2022, ACMG 2023 "PNAlign") sat
past char 800 → trimmed → Opus-low produced a confident **circular non-answer** (*"independent adoption
is precisely the showing the RFE requests … as set forth in the record"*) naming nothing. Judge:
"submitted as written, this would invite a second RFE or denial." It did NOT fabricate (protect that) —
but on the highest-stakes op the trim makes the model actively harm the case.

**FIXED 2026-06-23** (rfe.ts): `FILED_SECTION_CHARS` 800 → 2200, and the head-slice is replaced by
`trimFiledSection(body, rfeText)` — keeps the opening sentence (context) + the sentences most relevant
to the RFE notice (keyword overlap), in original order with `[…]` elisions, so a deficiency buried late
in a long section still reaches the model. Pure + unit-tested; MERGED in PR #115.

## DRILL (v2, hardened k=4, [[2026-06-23-drill-rfe]])
v0 pre-fix head-slice **38.5** (names evidence 0/4, survives 0/4, $150) → **v1 shipped #115** **75.3**
(names 4/4, survives 4/4, **$4,007 — +$3,857/RFE, the trim fix VALIDATED live**) → **v2 +market-bar
framing** **93.3** (all light, $6,422, **+$2,415/RFE, non-overlapping**). Zero fabrication all 12.
**The market-bar framing TRANSFERS from [[draft]] — ✅ SHIPPED PR #116** into `buildRfePrompt` via the
single-sourced `marketBarFraming("rfe")` (Kazarian step-two + field-norm + point-by-point; kazarian dim
3.3→8.0→17.3). **#9 FIXED (PR #117):** `rfeGroundingText(req)` now grounds the adjudication gate in the
as-filed petition prose (+ criteria + notice) so a legit quote from the filed letter no longer false-flags
as fabrication. Model choice: inherits the draft `tier:"long"` upgrade (set GEMINI_DRAFT_MODEL — Lens-3
[[2026-06-24-lens3-draft-models]]).
