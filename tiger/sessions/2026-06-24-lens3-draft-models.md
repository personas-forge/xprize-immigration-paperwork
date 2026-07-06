---
type: tiger/session
date: 2026-06-24
mode: benchmark (Lens 3) — draft op model × thinking matrix
finding: #2 premium-op-on-Flash (GEMINI_DRAFT_MODEL unset → the xl/long op runs on Flash)
engine_under_test: {haiku, sonnet, opus} × {low, high} effort · k=2 · judge: claude-sonnet
proxy_caveat: Claude tiers PROXY the Gemini Flash-vs-Pro decision (capability SHAPE, not Gemini cost). A
  precise Gemini Flash-vs-Pro delta needs a real GEMINI_API_KEY A/B (absent in this checkout).
judge_note: first run used Fable (unavailable) → re-judged with Sonnet on the cached drafts. Sonnet CELLS
  are therefore self-judged (caveat); haiku & opus are the clean independent brackets and bracket the call.
---

# Tiger Lens-3 2026-06-24 — does the draft op need a stronger model? (#2)

`config.ts`: `tier:"long"` → `GEMINI_DRAFT_MODEL ?? fast`; `GEMINI_DRAFT_MODEL` is unset here, so the
`xl`/12-token draft (and the `heavy` RFE) run on the same `gemini-3-flash-preview` as the 1-token ops.
This matrix runs the **production-current** draft prompt (market-bar framing shipped) across Claude
capability tiers to measure the quality-vs-capability shape and decide **upgrade vs document/reprice**.

## The curve
| model | effort | market mean (range) | rework | value/petition |
|---|---|---|---|---|
| haiku | low | 70.5 (68–73) | moderate | $2,120 |
| haiku | high | 73.0 (70–76) | substantial/moderate | $2,305 |
| sonnet | low | **87.5** (87–88) | **light** | **$3,583** |
| sonnet | high | 86.0 (85–87) | moderate/light | $3,482 |
| opus | low | **89.0** (87–91) | light | $3,683 |
| opus | high | 87.0 (86–88) | light | $3,549 |

Dim means show WHERE the cheap tier loses: kazarian_step_two **haiku 11.5–12.5 vs sonnet/opus 17–18** and
specificity **13.5 vs 16–17** — i.e. a weaker model argues the final-merits totality less and is less
specific, exactly the market-bar dimensions. Integrity 19–20 at every tier (zero fabrication, even haiku).

## What it shows
1. **Capability matters — materially.** Cheap tier (haiku-class ≈ Flash) ≈ **71–73 / moderate rework /
   ~$2,200**; mid tier (sonnet-class) ≈ **86–88 / light rework / ~$3,500**. A **~16-point / ~$1,400/petition**
   gap on the highest-value op. So leaving the premium op on the fast model likely leaves real value on
   the table — #2 is NOT a false alarm.
2. **Quality SATURATES at the mid tier.** opus (89) ≈ sonnet (87.5) within k=2 noise (+1.5). The cost/quality
   frontier is the **mid tier**, not the top — no need to pay for the strongest model.
3. **Thinking level barely moves it.** low ≈ high in every model (low even slightly ahead). Standard
   effort is the right default; high thinking is not worth the latency here.

## Decision (resolves the config.md open question)
**Recommend UPGRADE: set `GEMINI_DRAFT_MODEL` to a Pro-class long-context Gemini model** (mid tier,
standard thinking — the frontier the matrix found), so the `long` tier stops silently degrading to Flash.
The proxy estimates this moves the draft from ~moderate rework (~$2,100 delivered) to ~light (~$3,500) —
**~+$1,400/petition** on the highest-$ op. Do NOT jump to the top tier or high thinking (no measured gain).
- **Confirm before committing:** a real **Gemini Flash-vs-Pro A/B** with a `GEMINI_API_KEY` (this checkout
  has none). `gemini-3-flash-preview` may be more capable than Claude Haiku, so the proxy is directional,
  not exact — but the *shape* (capability drives draft quality; it saturates mid-tier) is robust.
- **Reprice check:** if Flash is kept for cost reasons, the `xl` 12-token price is buying fast-tier output —
  reconcile the tier price with the actual model (registry.ts), and document the choice.
- **✅ SHIPPED (PR #118) — observability:** a one-time `console.warn` when the `long` tier falls back to
  the fast model (`GEMINI_DRAFT_MODEL` unset), fired from `callGemini` (the real generation path) via the
  pure predicate `isLongTierOnFastFallback` in config.ts. The silent degradation is now visible in prod
  logs until the env is set. (The L1 finding's option (b).) The remaining action — actually SET the env to
  a Pro-class model + A/B — stays a deployment decision.

## Honest ceilings
- Claude-tier proxy, not Gemini; k=2; sonnet cells self-judged. The haiku↔opus brackets (independent) carry
  the decision; the precise Gemini delta + the exact Pro model id/cost are a real-key A/B follow-up.
- This benchmark used the draft op; the RFE (`heavy`, also `tier:"long"`) inherits the same model choice —
  the upgrade covers both. (RFE is shorter; `tier:"fast"` for RFE is a separate cost question, see L1.)
