---
name: evaluate-as-prospect
title: Decide, fast and cold, whether this product is credible, compliant, and worth adopting
promotion: discovery
surfaces: ["/", "/pricing", "/billing", "/faq", "/validation", "/landing-claude"]
ai_surface: false
characters: [karen-whitfield-prospect, sam-reyes-founder, priya-nair-researcher]
---

## Goal (not a script)

I arrive cold from a link and, in a couple of minutes, decide whether to trust this enough to start:
what is it (and what is it *not*), who signs and where the legal-advice line sits, whether the
output/correctness story is credible, and what it costs — without a sales call.

## User-POV definition of done

- Within ~2 minutes the positioning is unmistakable: a **drafting tool, not a law firm**; *your/the
  client's* attorney reviews and signs; **not legal advice** — consistent across landing/FAQ/pricing.
- Pricing/model is transparent and self-serve (tokens, the free signup grant) — no "contact us to
  learn the price" wall for the core offer; the bundle prices don't drift between landing and
  `/billing`.
- The FAQ credibly answers the real objections: form compatibility, RFE handling, refunds, data
  security.
- The validation/correctness page shows **evidence**, not adjectives.
- Nothing overclaims ("file your visa in minutes!") and there are no dark-pattern funnels — nothing
  I'd be embarrassed to have a client see.

## L1 grounding focus

Read the marketing surfaces (`page.tsx`, `pricing`, `billing`, `faq`, `validation`,
`landing-claude`) and confirm: the UPL/disclaimer line is present and consistent; pricing is sourced
from the canonical `economy.ts` BUNDLES (can't drift); the validation page references real
validation artifacts (per the validation framework). This journey is non-AI but trust-critical.
