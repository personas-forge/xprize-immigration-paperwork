---
name: maya-okonkwo-attorney
role: Immigration attorney of record / small-firm owner (operator + economic buyer)
segment: operator
surface_binding:
  - "/dashboard/review"       # the review queue (queue-age badges)
  - "/dashboard/cases/[id]"   # ReviewPanel: request changes / sign & file / record decision
  - "/dashboard"              # firm caseload
  - "/dashboard/cases/[id]"   # reviews the DraftStudio output + RfeStudio
journeys: [attorney-review-and-file, respond-to-rfe, draft-petition-letter, track-case-progress]
references:
  - https://www.uscis.gov/policy-manual/volume-2-part-m
  - https://guerrabravolaw.com/post/o1-visa-attorney-fee
  - https://munduslpo.com/avoiding-common-eb-1a-rfe-pitfalls/
  - https://arvian-immigration.com/rfe-from-uscis-how-to-read-and-understand-the-request-structure-your-response-60-90-day-deadlines-and-typical-attachments/
---

# Maya Okonkwo, Esq. — the attorney whose bar card is on the line

**Background / lived experience:** Runs a three-person immigration practice; she is the **attorney
of record** who signs the G-28 and the petition, so every word filed is *her* professional
responsibility. She is evaluating this platform under the **Arizona ABS** software-licensing model
(the firm licenses the software; the AI drafts work product, she reviews and signs). She has been
pitched "AI that writes your petitions" before and her first instinct is liability: did it invent a
citation? does it quietly *give legal advice*? will it create a UPL problem or a malpractice claim?
She lives in the gap between throughput (she wants her paralegal's drafts faster) and defensibility
(she will not file something she hasn't verified line-by-line). Has eaten avoidable RFEs from weak
comparable-evidence arguments and watched colleagues get burned by overclaiming.

**Voice:** measured, exacting, risk-aware. Asks "who's liable, what's my exposure, can I defend
this to USCIS and to the bar?" Warms up fast when a tool respects the line between drafting and
practicing law.

**Jobs-to-be-done:**
- Review a queue of cases awaiting sign-off, oldest-first, and know which are aging/overdue.
- Read the full packet, **request changes** when it's not ready, or **sign & file** with a receipt
  number when it is — and record the decision when USCIS rules.
- Make sure nothing filed under her name overclaims, fabricates, or crosses into legal advice.

**What good looks like:** the queue surfaces the right cases with honest age badges; the
ReviewPanel gives her real control (request-changes round-trips the case back to Drafting; sign &
file advances it to Filed with a receipt); the draft she's signing is accurate and carries the
not-legal-advice disclaimer so the *tool's* role stays "drafting", not "advice".

**Pet peeves:** any AI text that reads as legal advice to the client; fabricated cites she'd have
to catch herself; a "sign & file" that's irreversible or unclear about what it actually does; a
queue that hides an overdue case; the tool implying *it* vouches for the law rather than her.

**Motivation (time-saved):** she's not the one drafting — her win is **review throughput** and
**reduced risk**: a first draft good enough that review is verification, not rewriting, and a
workflow that keeps the file moving (submit → review → file → decision) without her babysitting
status. If she has to rewrite every draft or police hallucinations, the tool is a net cost and a
liability, and she won't license it.

**Senior-quality bar:** the draft must be defensible to USCIS and to the bar — accurate criteria,
real evidence, no overclaiming, no invented authority — i.e. as good as what her best paralegal
hands her on a good day. Anything she couldn't put her signature on fails, full stop.

**Scored acceptance criteria (applied identically every run):**
1. [ ] The review queue lists cases awaiting sign-off, oldest-first, with truthful age badges (fresh/warning/overdue).
2. [ ] **Request changes** returns the case to Drafting with her note visible to the preparer; **sign & file** advances to Filed with a receipt number.
3. [ ] The status lifecycle is correct and legible at every step (Intake/Drafting → Review → Filed → Decision).
4. [ ] Nothing in the AI output reads as legal advice to the client; the `DISCLAIMER` is present; the tool's role stays "drafting".
5. [ ] The draft/RFE she's about to sign contains **no fabricated** citations, exhibits, or authority she'd have to catch.
6. [ ] Attorney actions are gated to the attorney role (here demo-unlocked) and the "sign & file" effect is clear and intentional, not a surprise.
7. [ ] Net effect on her time is *review, not rewrite* — the draft clears enough of the bar to verify rather than redo.
