---
id: evidence-categorize
type: tiger/call-site
modality: text (future: requiresImages when OCR lands)
file: src/app/api/evidence/categorize/route.ts:44
wrapper: executeAiOperation (inline spec, route.ts)
provider: gemini (prod) | claude (dev)
model: tier "fast" → GEMINI_MODEL ?? gemini-3-flash-preview | claude sonnet
operation: categorize
tier: light (1 token)
schema: yes — tryParseCategorizeResponse (evidence.ts:163); coerces to valid bucket or "Unsorted"; ≤6 facts
grounding: 4/5 (provisional)
quality_score: —
code_score: —
recommended_model: —
status: discovered
last_scanned: 2026-06-23
characters: ["[[gloria-paralegal]]", "[[bryan-intake]]"]
---
## What it does
Classifies a vault document into one of the classification's criteria (or "Unsorted") and extracts
key facts. `POST /api/evidence/categorize`. Powers the evidence vault → exhibit organization (the
"half a day → an hour per intake" save for the paralegal/intake operator).

## Prompt & grounding
`buildCategorizePrompt` (evidence.ts:113). Generate opts: `json:true, tier:"fast"`.
- **Reaches the prompt:** document name (≤200), content (20–12000 chars), classification (server-
  authoritative from case), pack criteria names, **and an existing vault summary** (which docs are
  already filed per criterion, ≤6 sibling names/criterion — read-only, for consistency; G2.1). ✓✓✓✓
- **MISSING:** little — text-only today; the named OCR/vision gap is the future image modality.
  → **grounding ≈ 4/5.**

## Code quality (wrapping · logging · caching)
- Chokepoint ✓; bucket-coercion + fact-bounding (≤6 facts, ≤240 chars) ✓. Telemetry ✓.
- **No adjudicate gate** — fine (a category label is not filed prose / legal advice).
- **No output cache** — but the same document re-categorized (e.g. after a re-upload) re-bills;
  cache by content-hash is a candidate (light tier, lower priority than guidance).

## Findings
_None yet — discovered. Check the vault-summary context actually drives consistency (a doc isn't
filed under a criterion that already has the right sibling); confirm "Unsorted" is used honestly
rather than force-fitting a weak match._
