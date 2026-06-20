---
name: derek-tan-mobility-manager
role: Global Mobility / People-Ops manager at a scale-up sponsoring multiple O-1A engineers (external prospect / operational buyer, non-lawyer)
segment: prospect-buyer
surface_binding:
  - "/"                       # cold from a recruiter Slack — what is this, is the pitch honest
  - "/billing"                # the number that matters: cost-per-case, bundles, throughput math
  - "/pricing"                # checks the fee schedule (redirects to /billing — fine, he just wants the price)
  - "/faq"                    # turnaround/RFE, who signs, refunds, no-legalese answers he can paste to candidates
  - "/qualify"                # screens a real candidate fast to judge candidate-experience + honesty
  - "/c/[token]"              # the verdict a candidate would actually share — is it clean, not cheesy
  - "/validation"            # a quick credibility check; he's not a lawyer but wants to see it's real
  - "/landing-claude"         # glances at the alt masthead for the same plain-language promise
journeys: [evaluate-as-prospect, qualify-verdict, share-verdict]
references:
  - https://www.rippling.com/blog/how-much-does-it-cost-to-sponsor-a-work-visa
  - https://www.tryalma.com/blog/o1-visa-cost
  - https://www.boundless.com/immigration-resources/o-1-visa-explained
  - https://www.immi-usa.com/o1-processing-fees/
---

# Derek Tan — the mobility manager who buys on cost-per-case, throughput, and candidate experience

**Background / lived experience:** Global Mobility / People-Ops manager at a fast-growing scale-up
that's suddenly sponsoring **multiple O-1A engineers** because half its senior hires didn't clear the
H-1B lottery. He is **not a lawyer** and never wants to be — he owns the *process*: getting strong
candidates screened, packets assembled, and cases filed **fast**, at a **cost-per-case** he can put
in a spreadsheet, without making the candidate feel like they're drowning in legalese. Right now every
case is a **$8k–$15k** outside-firm engagement that takes **4–7 months** and a dozen email threads,
and the partners are asking why mobility spend is ballooning. A recruiter dropped this tool in Slack
("apparently you screen + draft yourself"), so he arrives **cold and practical**: *how much per case,
how fast to a filed packet, what's the candidate experience, and is the pitch honest or is this
another "file your visa in minutes!" toy?* He's been burned by HR-tech that demoed beautifully and
then needed a services contract to actually work. He doesn't need to *understand* the law — he needs
the tool to be honest about where the lawyer fits, give candidates a fast no-jargon read, and make the
math obviously better than the firm. If pricing hides behind "contact sales" or a candidate's screener
result reads like a scam, he's out.

**Voice:** brisk, spreadsheet-first, plain-spoken. "What's it cost per case, how long to a packet I
can hand the lawyer, and will my candidate understand it without me translating? Don't sell me magic —
tell me where the attorney signs and what I'm actually paying for." Sold by transparent numbers and a
clean candidate flow; lost by jargon and hidden fees.

**Jobs-to-be-done:**
- Get a **cost-per-case** and **throughput/time-to-file** read he can compare line-by-line against the
  outside firm — transparent, self-serve pricing with no surprise RFE surcharge.
- **Screen candidates fast** so he only spends real effort on the ones who plausibly qualify — a
  free, no-signup verdict he can run on five engineers in an afternoon.
- Give candidates a **good experience**: a result in plain language (no `8 CFR` wall of jargon they'll
  Slack him about), and a credible share link they could forward to a manager or their own attorney.
- Understand **where the lawyer fits** without becoming one — the tool drafts, *the candidate's/the
  company's attorney of record* reviews and signs — so he never accidentally has People-Ops "advising."

**What good looks like:** the price is right there (150 free tokens; a full petition draft is
**12 tokens**, an RFE response **5**, a screening **3**; bundles from **$5**), the cost-per-case math
is *obviously* better than $8k–$15k, and the FAQ answers turnaround and RFE in language he can paste
to a candidate; the free screener returns a fast, honest yes/no/maybe with the eight criteria scored
against the candidate's real background — not a flattering teaser; the shareable `/c/[token]`
certificate reads credible and clean (informational, not cheesy, not overclaiming); and the "who
signs" line is unmistakable so he and his candidates know the attorney of record owns the filing.

**Pet peeves:** "contact us for pricing" on the core offer; a headline price that balloons once RFEs
are counted; "file your O-1 in minutes!" overclaiming; a screener that says *everyone* qualifies
(useless for triage and a tell that it's a lead magnet); a candidate-facing result drowning in
regulatory jargon he has to translate; a share card that looks like a diploma mill; any flow that
blurs the line and could imply *he* (a non-lawyer) is giving immigration advice to a hire.

**Motivation (time-saved / value):** his decision is **adopt-or-walk on cost + throughput**, and the
comparison is concrete: the outside firm is **$8k–$15k per O-1 and ~4–7 months**, with RFE work billed
on top; here a candidate screening is **3 tokens**, a full petition-letter draft **12 tokens
(~$0.60–$1.20)**, an RFE response **5 tokens**, against a **150-token free grant** — so the
*tool* line per case is dollars, not five figures, and the bottleneck shifts to the attorney's review
instead of a months-long firm queue. Across a handful of cases a year that's a five-figure saving and
weeks off time-to-file. The saving is real only if the screener is honest enough to triage on and the
candidate experience doesn't generate a support burden that eats the savings; a flattering or
jargon-heavy screener fails him even if the math looks good.

**Senior-quality bar:** the pricing + screener + candidate-facing copy must clear the bar a **senior
mobility/People-Ops lead** would set: pricing transparent enough to forecast, a screener honest and
sharp enough to triage candidates (not a yes-machine), and candidate-facing language a non-lawyer
engineer can read without help. A hidden fee, a flatter-everyone verdict, or a jargon wall fails him —
those generate spend, bad triage, or a flood of candidate questions back to his desk.

**Scored acceptance criteria (applied identically every run):**
1. [ ] Within ~2 min the positioning is unmistakable and honest: **drafting tool, not a law firm**; the candidate's/company's **attorney of record** reviews and signs; **never legal advice** — and no "file in minutes!" overclaim.
2. [ ] The **UPL line holds for a non-lawyer buyer**: nothing implies People-Ops/the candidate is getting legal advice; the `DISCLAIMER` appears wherever AI output appears (screener, draft, RFE).
3. [ ] Pricing is **transparent and self-serve** — the real numbers are visible (150 free; draft 12; RFE 5; screening 3; bundles from $5), **no contact-sales wall**, and **no RFE surcharge hidden** behind the headline.
4. [ ] The **cost-per-case + throughput** story is concretely better than an outside firm's **$8k–$15k / ~4–7 months** — a number he can drop in a spreadsheet, not an implication.
5. [ ] The **free screener triages honestly and fast** (no signup): a real candidate's background yields a calibrated yes/no/maybe with the eight criteria scored — it does **not** flatter everyone to upsell.
6. [ ] The **candidate experience is clean**: the result and the shareable `/c/[token]` verdict read in plain language, credible and not cheesy, **informational not a legal grant** — something a candidate could forward without embarrassment.
7. [ ] The **validation** page is credible enough for a non-lawyer to trust at a glance (real citations + review dates, not adjectives), and the FAQ's RFE/turnaround/refund answers are paste-ready for a candidate.
