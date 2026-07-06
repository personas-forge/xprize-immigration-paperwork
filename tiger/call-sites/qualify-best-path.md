---
id: qualify-best-path
type: tiger/call-site
modality: text
file: src/app/api/qualify/best-path/route.ts:26
wrapper: executeAiOperation (inline spec, route.ts)
provider: gemini (prod) | claude (dev)
model: tier "fast" → GEMINI_MODEL ?? gemini-3-flash-preview | claude sonnet
operation: qualify (bills as qualify)
tier: medium (3 tokens)
schema: yes — parseBestPathResponse (best-path.ts:235); sliceJson tolerates surrounding prose; rankPrograms math
grounding: 4/5 (provisional)
quality_score: —
code_score: —
recommended_model: —
status: discovered
last_scanned: 2026-06-23
characters: ["[[sam-founder]]", "[[kenji-oss-engineer]]", "[[ingrid-architect]]"]
---
## What it does
Scores a profile against **every** live program (all packs, all criteria) and recommends the best
path with cross-classification reasoning (e.g. the EB-1A green-card / higher-bar trade-off vs O-1A).
`POST /api/qualify/best-path`. Helps the "which visa is even right for me?" decision before screening.

## Prompt & grounding
`buildBestPathPrompt` (best-path.ts:166) — injects all live programs' criteria (best-path.ts:186).
Generate opts: `json:true, tier:"fast", temperature:0` (route.ts:48).
- **Reaches the prompt:** free-text profile, name, every live program's criteria. ✓✓✓✓
- **MISSING:** nothing notable beyond the profile's inherent thinness. → **grounding ≈ 4/5.**

## Code quality (wrapping · logging · caching)
- Chokepoint ✓; tolerant JSON slice + per-program ProgramScore + deterministic rank ✓. `temperature:0` ✓.
  Telemetry ✓. **No output cache.**
- **No adjudicate gate** (route.ts:27) — a recommendation across classifications edges toward "which
  visa should you file" (advice-adjacent). Worth a Lens-2 UPL check that the output stays informational
  ("how your background maps") and never prescriptive ("you should file EB-1A").

## Findings
_None yet — discovered. UPL-adjacency check + does the cross-program reasoning actually help vs just
running `qualify` on the obvious pack._
