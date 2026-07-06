---
id: rfe-forecast
type: tiger/call-site
modality: text
file: src/app/api/rfe/forecast/route.ts:15
wrapper: executeAiOperation + forecastSpec (src/features/rfe/forecastOperation.ts)
provider: gemini (prod) | claude (dev)
model: tier "long" → GEMINI_DRAFT_MODEL ?? gemini-3-flash-preview | claude sonnet
operation: rfe (bills as rfe)
tier: heavy (5 tokens)
schema: yes — tryParseRfeForecast (rfe.ts:374); criterion names remapped to known, ranked by likelihood
grounding: 3/5 (provisional)
quality_score: —
code_score: —
recommended_model: —
status: discovered
last_scanned: 2026-06-23
characters: ["[[gloria-paralegal]]", "[[priya-researcher]]"]
---
## What it does
Predicts which criteria USCIS is most likely to challenge **before** an RFE arrives: per relied-on
criterion a likelihood (0–100), why, and suggested evidence to shore it up. `POST /api/rfe/forecast`;
never persists. A proactive "harden the weak spots" pass.

## Prompt & grounding
`buildRfeForecastPrompt` (rfe.ts:337). `rfeText` is empty (pre-RFE). Generate opts:
`json:true, tier:"long"` (forecastOperation.ts:109).
- **Reaches the prompt:** petitioner, classification, criteria filtered to relied-on (Met/Strong/
  Partial). ✓✓✓
- **MISSING:** the as-filed petition prose (n/a pre-file) and raw evidence — predicts off the criteria
  digest only. → **grounding ≈ 3/5.**

## Code quality (wrapping · logging · caching)
- Chokepoint ✓; schema + name-remap + rank ✓. Telemetry ✓.
- **No adjudicate gate** (forecastOperation.ts) — acceptable (advisory, not filed; no fabricated
  specifics to gate, predictions only). **No output cache.**
- Mock uses a STATUS_RISK map (Partial=80/Met=40/Strong=25) — useful as a sanity baseline to judge
  whether the model adds signal over the heuristic.

## Findings
_None yet — discovered. Value question for `run`: does the model meaningfully beat the deterministic
STATUS_RISK heuristic, or is the 5-token charge buying a dressed-up table lookup?_
