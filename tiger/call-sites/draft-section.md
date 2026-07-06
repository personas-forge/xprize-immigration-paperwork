---
id: draft-section
type: tiger/call-site
modality: text
file: src/app/api/draft/route.ts:24 (discriminated by `focus`)
wrapper: executeAiOperation + draftSpec (src/features/drafting/draftOperation.ts)
provider: gemini (prod) | claude (dev)
model: tier "long" → GEMINI_DRAFT_MODEL ?? gemini-3-flash-preview | claude sonnet
operation: draft_section
tier: heavy (5 tokens)
schema: yes — tryParseSectionResponse (drafting.ts:372); heading pinned to `focus` for merge
grounding: 3/5 (provisional)
quality_score: —
code_score: —
recommended_model: —
status: discovered
last_scanned: 2026-06-23
characters: ["[[sam-founder]]", "[[lucia-filmmaker]]", "[[gloria-paralegal]]"]
---
## What it does
Regenerates ONE section of an existing letter for a single criterion (cheaper than a full redraft).
`POST /api/draft` with `{focus: "<criterion name>"}`; the new section is merged by heading into the
latest stored draft (mergeRegeneratedSection, drafting.ts:637). The studio's per-section "Regenerate".

## Prompt & grounding
`buildSectionPrompt` (drafting.ts:268). Same injection defense + citation discipline as `draft`.
Passes the letter's OTHER current sections as **read-only continuity context** (fenced, trimmed to
`SECTION_CONTEXT_CHARS=600`, drafting.ts:304) so the regen stays consistent (no duplicated intro).
Generate opts: `json:true, tier:"long"`.
- **Reaches the prompt:** petitioner, classification, the focused criterion's evidence/rationale/
  exhibits, sibling sections (trimmed). ✓✓✓
- **MISSING:** same raw-evidence gap as `draft`; only the one criterion's digest is in scope.
  → **grounding ≈ 3/5.**

## Code quality (wrapping · logging · caching)
- Chokepoint ✓; schema + pinned-heading merge ✓; **adjudicate gate ✓** (shared with `draft`).
- Merge-base validation ✓ (pickMergeBase, draftOperation.ts:78). Telemetry ✓.
- **No output cache** — re-regenerating an unchanged criterion re-bills 5.
- Continuity context is bounded (600/section) — good; watch total prompt on very long letters.

## Findings
_None yet — discovered. Test in `run`: does continuity context actually prevent contradiction/
duplication vs the rest of the letter (the senior-bar miss to probe)._
