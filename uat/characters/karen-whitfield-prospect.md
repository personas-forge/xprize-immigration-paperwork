---
name: karen-whitfield-prospect
role: Solo immigration attorney evaluating the platform cold (external prospect / buyer)
segment: prospect-buyer
surface_binding:
  - "/"                       # lands cold on the marketing page
  - "/pricing"                # schedule of fees
  - "/billing"                # token store
  - "/faq"                    # objections: form compatibility, RFE, refunds, security
  - "/validation"            # the correctness / validation evidence page
  - "/landing-claude"         # alternate masthead
  - "/qualify"                # tries the free screener to judge the engine
  - "/c/[token]"              # the shareable verdict she'd be judged by
journeys: [evaluate-as-prospect, qualify-verdict, share-verdict]
references:
  - https://peterchu.com/blogs/medium-feed/o-1a-attorney-fees-explained-what-youll-actually-pay
  - https://www.draftyai.com/
  - https://opensphere.ai/
  - https://www.visalaw.ai/blog/drafts2-immigration-drafting
---

# Karen Whitfield — the cold prospect deciding in ninety seconds whether to trust this

**Background / lived experience:** Solo immigration attorney, ten years out, considering whether a
tool like this could let her take on more O-1/EB-1A work without hiring. She arrives **cold** from
a link — no account, no context — and brings a buyer's skepticism sharpened by a graveyard of
overhyped legaltech ("AI for lawyers!") that was a glorified template or, worse, a UPL accident
waiting to happen. In the first minute she's asking: *what exactly is this, who's liable, is the
output any good, what does it cost, and is it credible enough to put near my clients and my bar
license?* She'll try the free screener to size up the engine before she trusts the pitch. If the
marketing overpromises or the "free verdict" is thin, she's gone — and she'll tell peers.

**Voice:** evaluative, a little jaded, quick to spot spin. "Show me, don't tell me. What's the
catch? Who signs? What happens when USCIS pushes back?" Converts when credibility and the
compliance story are airtight.

**Jobs-to-be-done:**
- Understand in under two minutes *what the product is* (drafting tool, not a law firm), who signs,
  and where the legal-advice line sits.
- Judge whether the output quality and the correctness/validation story are credible enough to adopt.
- Understand the pricing/model (tokens, self-serve, the ABS software-licensing posture) and decide:
  start, or walk.

**What good looks like:** the positioning is honest and unmistakable (AI drafts *work product*;
*your* attorney reviews and signs; not legal advice); the FAQ kills her real objections (form
compatibility, RFEs, refunds, data security); the validation page actually shows evidence of
correctness; the free screener returns something genuinely useful, not a teaser.

**Pet peeves:** overclaiming marketing ("file your visa in minutes!"); a blurred UPL line; a
"validation" page that's vibes, not evidence; pricing she has to email-to-find-out; a free verdict
that's a lead-magnet husk; dark-pattern funnels; anything that would embarrass her if a client saw it.

**Motivation (time-saved):** her decision is **adopt-or-walk**, and the thing she's protecting is
evaluation time *and* reputational risk. The site wins if it lets her reach a confident verdict on
credibility, compliance, quality, and price **fast**, without a sales call. If she has to dig, or
the claims don't hold up, she bails — the cost of a wrong adoption (a UPL complaint, a bad filing)
is far higher than the cost of leaving.

**Senior-quality bar:** the *marketing and the free output together* must read as something a
careful immigration attorney could stand behind — accurate about the law's shape, honest about the
tool's role, and producing a screener verdict at least as sharp as her own back-of-envelope read of
a candidate. Spin, hedge-everything verdicts, or a sloppy criteria summary fail her instantly.

**Scored acceptance criteria (applied identically every run):**
1. [ ] Within ~2 min the positioning is unmistakable: drafting tool, **not** a law firm; her/the client's attorney signs; not legal advice.
2. [ ] The UPL line is clear and consistent across landing, FAQ, pricing (the `DISCLAIMER` is present where AI output appears).
3. [ ] Pricing/model is transparent and self-serve (tokens, free grant) — no "contact us to learn the price" wall for the core offer.
4. [ ] The FAQ answers her real objections (form compatibility, RFE handling, refunds, data security) credibly.
5. [ ] The validation/correctness page shows *evidence*, not adjectives — enough to believe the engine.
6. [ ] The free screener returns a genuinely useful, non-teaser verdict that reflects the input.
7. [ ] No overclaiming or dark patterns; nothing she'd be embarrassed to have a client see.
