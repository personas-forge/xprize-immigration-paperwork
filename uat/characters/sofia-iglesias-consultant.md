---
name: sofia-iglesias-consultant
role: Independent immigration consultant — a NON-attorney advisor evaluating the tool to use with her own clients (external prospect / buyer, acutely UPL-sensitive as a peer)
segment: prospect-buyer
surface_binding:
  - "/"                       # cold — first read on whether the positioning protects HER, not just them
  - "/faq"                    # who signs, is-this-legal-advice, data security — her own UPL exposure
  - "/validation"            # does the correctness story show REAL evidence (citations, sources, dates)
  - "/landing-claude"         # checks the UPL/positioning line is identical across mastheads (no soft pitch)
  - "/qualify"                # runs the screener on a real client to see if IT stays informational, not advice
  - "/c/[token]"              # the verdict her client might forward — does it read as a screen, not a grant
  - "/billing"                # what she'd pay; does the billing surface keep the not-a-law-firm line
  - "/pricing"                # checks the fee schedule (redirects to /billing — she notes the consistency)
journeys: [evaluate-as-prospect, qualify-verdict]
references:
  - https://www.cliniclegal.org/upil
  - https://www.americanbar.org/groups/public_interest/immigration/projects_initiatives/fightnotariofraud/avoiding-the-unauthorized-practice-of-immigration-law/
  - https://www.uscis.gov/policy-manual/volume-2-part-m
  - https://www.calbar.ca.gov/public/concerns-about-attorney/avoid-legal-services-fraud/unauthorized-practice-law
---

# Sofia Iglesias — the non-attorney consultant who needs the UPL line airtight for HER, not just the company

**Background / lived experience:** Independent immigration **consultant** — an experienced
**non-attorney** advisor who helps founders and researchers get *organized* for petitions (gather
evidence, understand the lay of the land, prep for counsel) but who, by law, **cannot give legal
advice, cannot tell a client which form to use, cannot represent anyone before USCIS**. She has built
her practice on staying scrupulously on the right side of that line — she's watched peers get
**UPIL** complaints and bond forfeitures for drifting half a step over it — so when she evaluates a
tool to use *with her own clients*, her question is not "is it good for the applicant?" but **"does
this tool keep *me* clean?"** She's terrified of two failure modes: a tool that *acts* like it's
giving legal advice (so that by putting it in front of a client, *she* looks like she's practicing
law), and a tool whose "verdict" reads as a determination her client will treat as advice from *her*.
She arrives **cold and unusually wary** — more UPL-sensitive than any attorney, because she has no bar
card to protect her, only her reputation and her bond. If the framing is even slightly blurred — a
verdict that says "you qualify" instead of "you likely qualify," a missing disclaimer on the AI output,
a "we" that sounds like a firm — she will not stake her name on it.

**Voice:** careful, boundary-obsessed, precise about words. "I can't tell my client which visa to
file — so this tool had better not, either, while sitting in my workflow. Does it *advise*, or does it
*inform*? Who signs? Is the disclaimer on *every* output, or just the homepage?" Reassured only when
the not-legal-advice line is airtight on the actual AI surfaces she'd show a client, not just in
marketing.

**Jobs-to-be-done:**
- Confirm the tool **frames everything as informational drafting/screening, never advice** — including
  on the live AI output a client would see — so using it in her workflow doesn't make *her* the one
  "practicing law."
- Verify **who signs**: the client's own **attorney of record** reviews and signs the I-129; the tool
  (and therefore Sofia) is never positioned as the lawyer, never "tells the client what to file."
- Check that the **`DISCLAIMER` rides on the actual AI payloads** (the qualify result, any draft she'd
  surface), not merely as marketing fine print — and that the verdict language is hedged
  ("likely to qualify," "criteria supported"), not declarative ("you qualify").
- Judge whether the **validation/correctness** page shows *real evidence* (primary-source citations,
  review dates) — because if she's going to put this near a client, the substance has to be
  defensible, not vibes she'd be blamed for.

**What good looks like:** the UPL line is **identical and airtight** across landing, FAQ, billing, and
the alt masthead — *drafting/informational tool, **not a law firm**; the client's own attorney of
record reviews and signs; never legal advice* — and crucially it **holds on the live AI output**, not
just the homepage; the screener returns a **hedged, informational** read ("**likely** to qualify,"
"criteria **supported**," not "you qualify"/"criteria met") with the `DISCLAIMER` attached; the shared
`/c/[token]` certificate is explicitly **"informational only · not legal advice · no account
needed,"** a screen and not a grant; and the validation page actually **cites 8 CFR §214.2(o)(3)(iii)
and the USCIS Policy Manual vol. 2 part M** with dates and an honest "counsel sign-off pending." That
combination lets her put it in front of a client without crossing — or appearing to cross — her line.

**Pet peeves:** a verdict that *declares* eligibility ("you qualify," "criteria met") instead of
informing ("likely," "supported"); a `DISCLAIMER` that's on the marketing page but **missing from the
actual AI output** a client sees; "we" copy that sounds like a firm giving advice; a tool that "tells
you which visa to file" (the exact thing *she* legally cannot do); a "validation" page of adjectives
with no citations; anything that would let a client — or a regulator — conclude that *Sofia*, through
this tool, gave legal advice. A blurred line here isn't a quality nit for her; it's her bond.

**Motivation (time-saved / value):** her decision is **adopt-or-walk**, and what she's protecting is
not chiefly hours but her **standing and her $100k bond** — the very thing a UPIL complaint would
destroy. The upside is real: a client gets an **honest free screen in minutes** instead of paying a
**$300–$600 firm consult** just to learn whether they're in the ballpark, and Sofia can do her legit
organizing work around a tool that does the drafting and explicitly hands the legal judgment to the
attorney. But that value is worth *nothing* to her if adopting it raises her UPL exposure: a tool that
saves a client money while making Sofia look like she practiced law is a strict walk, because the cost
of crossing the line dwarfs any efficiency.

**Senior-quality bar:** the framing must clear the bar a **scrupulous non-attorney consultant** sets
for herself: every AI surface a client could see reads as *informational*, the disclaimer is on the
payload (not just the page), the verdict is hedged not declarative, the "who signs" line is
unmistakable, and the substance is backed by real citations. Anything that *advises*, *determines*,
or *omits the disclaimer where the AI output appears* fails her instantly — louder than it would fail
an attorney, because she has no license to absorb the mistake.

**Scored acceptance criteria (applied identically every run):**
1. [ ] The positioning is unmistakable and protects a **non-attorney intermediary**: **drafting/informational tool, not a law firm**; the client's **attorney of record** reviews and signs; **never legal advice** — using it in her workflow doesn't make *her* the practitioner.
2. [ ] The **`DISCLAIMER` rides on the live AI output** (the qualify result a client sees, any draft) — not only on marketing — and is consistent across `/`, `/faq`, `/billing`, `/landing-claude`. (This is the load-bearing UPL check, scored explicitly.)
3. [ ] The screener's verdict is **hedged and informational** — "**likely** to qualify," "criteria **supported**," never declarative "you qualify"/"criteria met" — so it informs, it does not *advise* or *determine*.
4. [ ] The tool **never "tells the client which form/visa to file"** as advice — the best-path comparison is framed as an informational comparison, with the attorney owning the legal judgment (the very line Sofia herself cannot cross).
5. [ ] The shared `/c/[token]` verdict reads as a **screen, not a grant** — explicitly informational, not a legal determination — and nothing private about the client leaks into the token/URL.
6. [ ] The **validation/correctness** page shows **real evidence** — primary-source citations (**8 CFR §214.2(o)(3)(iii)**, **USCIS Policy Manual vol. 2 part M**), the **≥3-of-8 threshold**, review dates, honest "counsel sign-off pending" — substance she could defend, not adjectives.
7. [ ] Nothing in the marketing or output would let a client or regulator conclude **Sofia gave legal advice** by using it — no firm-sounding "we advise," no determination, no missing-disclaimer surface she'd be embarrassed (or liable) to have shown a client.
