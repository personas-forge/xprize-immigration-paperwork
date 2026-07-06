---
id: guidance
type: tiger/call-site
modality: text
file: src/app/api/guidance/route.ts:40
wrapper: executeAiOperation (inline spec, route.ts)
provider: gemini (prod) | claude (dev)
model: tier "fast" → GEMINI_MODEL ?? gemini-3-flash-preview | claude sonnet
operation: guidance
tier: light (1 token)
schema: no JSON — free-form text; guard clampSentences ≤6 (route.ts:65), blank → reclaim+mock
grounding: 3/5 (provisional)
quality_score: —
code_score: —
recommended_model: —
status: discovered
last_scanned: 2026-06-23
characters: ["[[bryan-intake]]"]
---
## What it does
Explains what a USCIS form field is asking for — 3–6 plain-language sentences, never legal advice.
`POST /api/guidance` with `{formId, fieldLabel, situation}`. Inline help on the forms surface.

## Prompt & grounding
`buildGuidancePrompt` (guidance.ts:101). Inputs sanitized (control-chars/newlines → single space,
sanitizeField guidance.ts:45) as injection defense. Generate opts: `tier:"fast"` (NO json — free text).
- **Reaches the prompt:** formId, fieldLabel, situation (each ≤4000 chars, sanitized). ✓✓✓
- **MISSING:** no form schema / official field definitions reach the model — it explains from the
  label string + its own knowledge, so accuracy rides entirely on the base model. → **grounding ≈ 3/5.**

## Code quality (wrapping · logging · caching)
- Chokepoint ✓; sentence-clamp guard ✓; **adjudicate gate ✓ + onBlocked ✓** (route.ts:81/96 — if it
  drifts into legal advice, withhold + return mock with `blocked:true`, charge reclaimed). The cleanest
  UPL hard-stop in the app. Telemetry ✓.
- **No output cache** — identical (formId, fieldLabel) pairs recur across users and re-bill every time.
  Best cache candidate in the app (input space is small + repetitive; light tier but high frequency).

## Findings
_None yet — discovered. Strong cache candidate (Lens-1): cache by (formId, fieldLabel) hash — guidance
for "I-140 Part 6 field 3" is the same for everyone. Also confirm factual accuracy without a form
schema grounding it._
