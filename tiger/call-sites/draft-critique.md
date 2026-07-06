---
id: draft-critique
type: tiger/call-site
modality: text
file: src/app/api/draft/critique/route.ts:17
wrapper: executeAiOperation + critiqueSpec (src/features/drafting/critiqueOperation.ts)
provider: gemini (prod) | claude (dev)
model: tier "long" → GEMINI_DRAFT_MODEL ?? gemini-3-flash-preview | claude sonnet
operation: draft_section (bills as section; moonshot #19)
tier: heavy (5 tokens)
schema: yes — tryParseCritique (drafting.ts:499); maps critiques back to real headings (case-insensitive)
grounding: 2/5 (provisional — grades in isolation)
quality_score: —
code_score: —
recommended_model: —
status: discovered
last_scanned: 2026-06-23
characters: ["[[maya-attorney]]", "[[gloria-paralegal]]"]
---
## What it does
Grades the draft's sections against the classification standard: per-section score (0–100), the
weakness, and an improved rewrite. `POST /api/draft/critique`; never persists (the studio's "Apply"
saves an accepted rewrite). The attorney/paralegal QA pass before review.

## Prompt & grounding
`buildCritiquePrompt` (drafting.ts:424). Same citation discipline. Sections sliced to
`MAX_CRITIQUE_SECTIONS=24` (drafting.ts:426). Generate opts: `json:true, tier:"long"`.
- **Reaches the prompt:** classification + the section bodies to grade. ✓✓
- **MISSING (big):** the original **criteria/evidence** — it critiques prose *in isolation* from the
  case facts, so it can't catch "this section overclaims vs the evidence on file" or an
  unsubstantiated assertion. → **grounding ≈ 2/5 — the lever: feed the criteria/exhibits so the
  critique is grounded in what's provable, not just rhetoric.**

## Code quality (wrapping · logging · caching)
- Chokepoint ✓; schema + heading remap ✓ (unmapped headings dropped). Telemetry ✓.
- **No adjudicate gate** (critiqueOperation.ts) — acceptable (output is internal QA, not filed text),
  but its *rewrites* feed back into the draft, so a fabrication there is laundered into the letter →
  worth a Lens-1 finding.
- **No output cache.**

## Findings
_None yet — discovered. Hypothesis: ungrounded critique (2/5) + rewrites that bypass the adjudicate
gate = a path for fabricated specifics to enter the letter via "Apply". Verify in `run`._
