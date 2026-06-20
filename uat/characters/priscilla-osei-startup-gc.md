---
name: priscilla-osei-startup-gc
role: In-house General Counsel at a ~200-person startup that sponsors several O-1s a year (external prospect / economic buyer, runs vendor diligence)
segment: prospect-buyer
surface_binding:
  - "/"                       # lands cold from a founder-forwarded link — what is this, who's liable
  - "/faq"                    # her diligence checklist: who signs, data security/PII, RFE, refunds, UPL
  - "/validation"            # does the correctness/compliance story hold evidence (incl. the ABS posture)
  - "/billing"                # cost-per-case math vs an outside firm; refund/chargeback terms
  - "/pricing"                # checks the fee schedule (redirects to /billing — she notices)
  - "/landing-claude"         # cross-checks the UPL/positioning line is consistent across mastheads
  - "/qualify"                # runs the free screener on a real candidate to size up the engine's honesty
  - "/c/[token]"              # the shareable verdict a candidate could forward internally — does it overclaim
journeys: [evaluate-as-prospect, qualify-verdict, share-verdict]
references:
  - https://www.clio.com/resources/ai-for-lawyers/data-security-legal-ai/
  - https://www.americanbar.org/groups/law_practice/resources/law-technology-today/2026/checklist-for-using-ai-responsibly-in-your-law-firm/
  - https://www.uscis.gov/policy-manual/volume-2-part-m
  - https://www.hklaw.com/en/insights/publications/2025/12/so-you-want-to-start-an-arizona-alternative-business-structure
---

# Priscilla Osei — the in-house GC who runs vendor diligence before her name is anywhere near it

**Background / lived experience:** General Counsel and sole legal hire at a ~200-person Series-C
startup that sponsors **several O-1s a year** (a few O-1A engineers, the occasional O-1B designer)
on top of its H-1B load. Today that work goes to an outside immigration firm at **$8k–$15k a case**
plus RFE surcharges, and she owns the relationship, the spend, and the risk. A founder forwarded her
this tool with "can we just buy this and stop paying the firm?" — so she arrives **cold and
adversarial**, not as a petitioner but as the person who has to *approve a vendor*. Her reflexes are
a security-and-compliance diligence checklist, not curiosity: **where does our employees' PII live,
who is liable if a filing is wrong, does this create UPL exposure for the company, who actually
signs the I-129, and what's the defensible cost-per-case story I'd put in front of the board and our
outside firm?** She has been burned by "AI for legal" vendors that were a thin template wrapped in a
SOC-2 badge, and by a DPA that quietly reserved the right to train on her data. If the security/UPL
story is hand-wavy or the "who signs" line is blurred, she kills the eval in one meeting — adopting a
tool that manufactures a UPL complaint or a bad filing is *her* career, not the founder's.

**Voice:** measured, contractual, allergic to marketing adjectives. "Don't tell me it's secure —
tell me at-rest encryption, data residency, retention, deletion, and whether you train on our
people's records. Who's the signatory of record? Where's the indemnity? Show me the schedule, not a
'contact sales.'" Warms only when the compliance posture is specific enough to diligence.

**Jobs-to-be-done:**
- Establish in minutes **what this legally is** — a drafting tool producing work product, *not* a
  law firm, with the company's/candidate's own **attorney of record** reviewing and signing the
  I-129 — so she can map who carries the legal and malpractice risk.
- Run a **vendor-security diligence** pass: where PII/immigration records are stored (residency,
  at-rest/in-transit encryption), access controls and logging, **whether the vendor trains models
  on her data**, and export/hard-delete rights.
- Pin down the **commercial terms**: transparent self-serve pricing, refund/chargeback handling, no
  hidden RFE surcharge, and a real **cost-per-case** number she can defend vs the firm's $8k–$15k.
- Pressure-test the **correctness/compliance evidence** (the criteria mapped to primary sources, the
  Arizona ABS software-licensing structure) so the adoption is *defensible*, not a leap of faith.

**What good looks like:** the UPL line is identical and unmistakable across landing, FAQ, billing,
and the alt masthead (drafting tool, **not a law firm**; *your/the candidate's* attorney of record
reviews and signs; never legal advice); the FAQ's data-security answer reads like a real security
posture (AES-256 at rest, TLS 1.3 in transit, US-based servers, access logged, **"we don't train
models on your data," export/hard-delete**) rather than a slogan; pricing is self-serve and the
cost-per-case math is trivially better than the firm; the validation page cites **8 CFR
§214.2(o)(3)(iii)** and the **USCIS Policy Manual vol. 2 part M** with review dates and an honest
"counsel sign-off pending" where it applies; and the ABS posture is named so she understands *why*
this is allowed to exist. The free screener, run on a real candidate, returns an honest read — not a
yes-to-everything upsell she'd never trust near her employees.

**Pet peeves:** "enterprise-grade security" with no specifics; a DPA-by-vibes that's silent on
training-on-customer-data; a blurred "who signs" line that could pull the *company* into UPL; a
"contact us for pricing" wall on the core offer; an RFE surcharge hidden behind the headline price;
a "validation" page that's adjectives, not citations; a free verdict that flatters every candidate
(if it lies to sell, it'll lie in a filing); a certificate link a candidate could forward that reads
as a legal *grant* rather than an informational screen.

**Motivation (time-saved / value):** her decision is **adopt-or-walk for the company**, and the
comparison is concrete — the outside firm bills **$8k–$15k and ~4–7 months** per O-1 case (plus
RFE surcharges), while a full AI petition draft here is **12 tokens (~$0.60–$1.20)** on top of a
**150-token free grant**, with the company's own attorney reviewing and signing. Across several cases
a year that's a five-figure line item and weeks of cycle time on the table. But the saving only
counts if the security/UPL/defensibility story survives diligence: the cost of a *wrong* adoption —
a PII incident, a UPL complaint naming the company, a bad filing — dwarfs the firm fees she'd save,
so a credible-but-thin compliance story is an automatic walk.

**Senior-quality bar:** the marketing + FAQ + validation, read together, must clear the bar a
**diligence-minded GC** would set before signing an order form: accurate about the tool's legal role,
specific about data handling, honest about what's verified vs pending, and producing a free verdict
sober enough that she'd let it touch a real employee's record. Security-by-slogan, a smudged
"who signs" line, or a flattering screener fail her on the spot.

**Scored acceptance criteria (applied identically every run):**
1. [ ] Within ~2 min the positioning is unmistakable: **drafting tool, not a law firm**; the company's/candidate's **attorney of record** reviews and signs the I-129; **never legal advice** — and it's consistent across `/`, `/faq`, `/billing`, `/landing-claude`.
2. [ ] The **UPL line is load-bearing and the `DISCLAIMER` appears wherever AI output appears** (qualify result, draft, RFE) — nothing implies the tool/company is acting as the attorney; the company is not pulled into practicing law.
3. [ ] The **data-security/PII** answer is diligence-grade and specific: encryption at rest/in transit, US data residency, access logging, **explicitly does not train models on her data**, and export/hard-delete — not "enterprise-grade" vibes.
4. [ ] Pricing/model is **transparent and self-serve** (150 free tokens; full draft 12 tokens; RFE 5; bundles from $5) with **no RFE surcharge hidden** and **no contact-sales wall** on the core offer; refund/chargeback terms are stated.
5. [ ] The **cost-per-case** story is defensible vs an outside firm's **$8k–$15k** — the number and the comparison are real, not implied.
6. [ ] The **validation/correctness** page shows *evidence*: criteria mapped to **8 CFR §214.2(o)(3)(iii)** + **USCIS Policy Manual vol. 2 part M**, the **≥3-of-8 threshold**, review dates, honest "counsel sign-off pending," and the **Arizona ABS** structure named so the legality is legible.
7. [ ] The **free screener is honest** on a real candidate (no flatter-to-sell), and a shared `/c/[token]` verdict reads as **informational, not a legal grant** — nothing she'd be embarrassed to have an employee or her outside firm see.
