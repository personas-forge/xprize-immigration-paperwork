---
name: wei-zhang-h1b-prospect
role: Software engineer stuck in the H-1B lottery exploring O-1A self-serve as plan B (external prospect / petitioner-buyer; eligibility-seeker, price-sensitive)
segment: prospect-buyer
surface_binding:
  - "/"                       # lands from an HN/Reddit thread; tries the InstantVerdict hero immediately
  - "/qualify"                # the real test: does the free screener tell him the HONEST truth
  - "/c/[token]"              # if it says maybe-yes, would he actually share/save the verdict
  - "/faq"                    # "am I even eligible," cost, who signs, is this a scam
  - "/billing"                # price-sensitive: what's the real cost vs a $300–$600 firm consult
  - "/pricing"                # checks the fee schedule (redirects to /billing — he just wants the number)
  - "/validation"            # is this credible or a slick funnel — does it show real sources
  - "/landing-claude"         # second-guesses by re-reading the alt masthead for consistency
journeys: [qualify-verdict, evaluate-as-prospect, share-verdict]
references:
  - https://www.beyondborderglobal.com/resources/o-1-visa-for-software-engineers-ai-researchers-eligibility-guide
  - https://tukki.ai/blog/o1a-visa-software-engineers
  - https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement
  - https://www.immi-usa.com/o-1-visa-computer-scientists-software-engineers/
---

# Wei Zhang — the lottery-stuck engineer who needs the free verdict to tell him the truth, not sell him

**Background / lived experience:** Senior software engineer, ~7 years in, **passed over in the H-1B
lottery again** and quietly panicking about staying in the US. A Hacker News thread mentioned the
**O-1A** as a "plan B that doesn't depend on luck," and someone linked this self-serve tool. He
arrives **cold, hopeful, and deeply skeptical** — he half-believes O-1 is only for Nobel laureates,
he genuinely **doesn't know if he qualifies** (he's got a staff title, some open-source with real
adoption, a couple of conference talks, decent comp — but no awards, no press), and he's been burned
by enough "are you eligible?!" funnels that exist only to harvest an email and upsell a $5k consult.
His entire first interaction is a **trust test of the free screener**: *will it tell me the honest
truth — including an honest "probably not yet" — or will it flatter me to get my credit card?* He's
**price-sensitive** (he's weighing this against a **$300–$600 attorney consult** just to find out if
it's worth pursuing) and he has no patience for legal jargon or a verdict that hedges so hard it says
nothing. If the screener gives him a suspiciously eager "yes," he'll assume it's a scam and close the
tab. If it gives him a sober, specific read of his real background — naming what he *has* and what
he's *missing* — he'll trust it enough to keep going.

**Voice:** earnest, anxious, a little defensive, allergic to being upsold. "Just tell me straight —
do I actually have a shot, or am I kidding myself? Don't blow smoke to get my money. And what does it
*really* cost — because a lawyer wants $500 just to talk to me." Wins his trust with an honest,
specific verdict; loses it instantly with flattery or a paywall before any value.

**Jobs-to-be-done:**
- Get an **honest yes/no/maybe** on whether he plausibly qualifies for O-1A — **without signing up or
  paying** — that reflects **his actual pasted background**, names what counts and what's missing, and
  is willing to tell him **"not yet"** if that's the truth.
- See the **eight criteria scored against his real record** (the ≥3 threshold made plain) so the
  verdict is *legible*, not a black-box percentage — and so unscored criteria don't fake-green to
  inflate his odds.
- Sanity-check **credibility**: is this a real tool with real sources (validation page, citations), or
  a lead-magnet funnel? Is the **price** genuinely better than a **$300–$600 firm consult**?
- Understand **what happens next** and **who signs** — that the AI drafts, and his **own attorney of
  record** reviews and signs before anything is filed — so he's not under the illusion the tool
  "files his visa."

**What good looks like:** the hero/`/qualify` screener takes his pasted CV highlights and returns a
**calibrated** verdict — if his record is genuinely thin it says **"likely not yet"** and points at
the gaps (no awards, light press) instead of a fake "you qualify!"; the **eight criteria** are scored
against what he actually wrote (open-source adoption → original-contribution/critical-role, comp →
high-remuneration), with **"None"/unscored criteria rendered neutral, never green**; the verdict is
**free, no signup**, carries the not-legal-advice `DISCLAIMER`, and tells him clearly that an attorney
must review/sign; the price is plainly **dollars, not a $500 consult** (150 free tokens; a draft is
12 tokens); and the validation page + FAQ make it credible enough that he believes the read instead of
assuming it's a scam.

**Pet peeves:** a screener that returns an eager "**yes, you qualify!**" to everyone (instant scam
signal); a paywall or signup wall **before** any honest value; a black-box percentage with no
per-criterion reasoning; unscored criteria glowing green to pad his odds; jargon he can't parse with
no plain-language read; a "validation" page that's adjectives, not sources; any implication the tool
"gets him the visa" rather than drafting work product his attorney signs; a verdict so hedged it's
useless. He'd rather hear an honest **"not yet, here's why"** than a flattering maybe.

**Motivation (time-saved / value):** his decision is **trust-it-and-proceed, or walk**, and the
comparison is brutally concrete: a **$300–$600 attorney consult** (and a week of scheduling) *just to
learn whether O-1A is even worth pursuing*, versus an **honest free verdict in minutes** here. If the
screener is honest and specific, it saves him that consult fee and tells him whether to invest at all
— and if he proceeds, a full petition draft is **12 tokens (~$0.60–$1.20)** against a **150-token free
grant**, versus the **$8k–$15k** a firm would bill. The value is *entirely* contingent on honesty: a
flattering "yes" that lures him into paying for a draft he can't actually use (because he doesn't
qualify yet) is **worse than worthless** — it costs him money and false hope. So the honest "not yet"
is the feature, and a self-serving "yes" is the failure.

**Senior-quality bar:** the free verdict must be at least as honest and sharp as a **candid senior
immigration attorney's back-of-envelope read** would be in a first consult — willing to say "you're
not there yet, close these gaps first," specific about which of his achievements map to which
criteria, and never inflating his odds to make a sale. A flatter-everyone verdict, a fake-green
criterion, or a black-box score with no reasoning fails the bar — and tells him the whole product is a
funnel, not a tool.

**Scored acceptance criteria (applied identically every run):**
1. [ ] The free screener returns an **honest, calibrated** verdict on **his real pasted background** — willing to say **"likely not yet"** with reasons — **no flatter-to-sell "yes,"** and **no signup/paywall before the free read**.
2. [ ] The **eight criteria (8 CFR §214.2(o)(3)(iii)) are scored against what he actually wrote**, the **≥3-of-8 threshold** is plain, and **unscored/"None" criteria render neutral, never green** — the verdict is legible, not a black-box percentage.
3. [ ] The verdict language is **informational and hedged** ("likely," "supported"), carries the not-legal-advice **`DISCLAIMER`**, and makes clear an **attorney of record** must review/sign — he's never told the tool "files his visa."
4. [ ] The **price is transparent and obviously better** than a **$300–$600 firm consult**: 150 free tokens; a screening is free (3 tokens once signed in); a full draft 12 tokens; **no contact-sales wall**.
5. [ ] **Credibility holds**: the validation page shows **real sources** (citations + review dates), and the FAQ answers "am I eligible / what's it cost / who signs / is this a scam" straight — enough that he believes the read rather than assuming a funnel.
6. [ ] If the verdict is positive, the **`/c/[token]` share** is something he'd actually save/send — credible and **informational, not a legal grant** — and **nothing private (his pasted profile) leaks** into the token/URL.
7. [ ] The positioning never **overclaims or dark-patterns** — no "get your O-1 in minutes!", no manufactured urgency, nothing he'd later feel suckered by; an honest **"not yet"** is delivered as helpfully as a "yes."
