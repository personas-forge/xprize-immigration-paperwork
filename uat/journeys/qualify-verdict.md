---
name: qualify-verdict
title: Find out, honestly, whether I qualify — and which visa is my strongest path
promotion: discovery
surfaces: ["/", "/qualify", "/api/qualify", "/api/qualify/preview", "/api/qualify/preview/best-path"]
ai_surface: true
characters: [priya-nair-researcher, sam-reyes-founder, karen-whitfield-prospect, devin-cruz-paralegal]
---

## Goal (not a script)

I paste my background once and learn whether I plausibly qualify for an extraordinary-ability visa
— with a yes/no/maybe, honest reasoning, the eight criteria scored against *my* record, and (if I'm
unsure which to pursue) a "find my best path" comparison across **O-1A / O-1B / EB-1A** that names
the strongest, fastest route and the gaps worth closing.

## User-POV definition of done

- I reach a verdict in well under five minutes, with no signup required for the free read.
- The verdict reflects **what I actually pasted** — it names my real evidence, not placeholders.
- The eight criteria (8 CFR §214.2(o)(3)(iii)) are represented correctly, with the ≥3 threshold
  honoured; nothing I didn't claim is shown as "Met", and unscored criteria never render green.
- If I asked for the best-path comparison, the recommendation is reasoned, not a coin-flip.
- The not-legal-advice `DISCLAIMER` is present, and I understand an attorney must review/sign.
- I'm told, clearly, what happens next (start a case / open the studio).

## L1 grounding focus

Follow `/` InstantVerdict + `/qualify` QualifyEntry → `/api/qualify(/preview/best-path)` →
`features/qualification/*` (the prompt builder, the pack/criteria model, the tolerant parser, the
keyword mock). Does the prompt receive the user's *real* pasted background, or thin inputs? Is the
criteria/threshold model correct per the live program packs? Is the mock honest when keyless?
