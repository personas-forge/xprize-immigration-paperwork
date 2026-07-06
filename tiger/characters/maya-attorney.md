---
name: Maya — attorney
type: tiger/character
classification: operator
maps_to: ["[[draft-critique]]", "[[rfe-response]]", "[[draft]]"]
references: [https://www.uscis.gov/policy-manual/volume-2-part-m]
time_saved: "rewrite every draft → review, not rewrite (throughput + reduced liability)"
---
## Who they are
Runs a three-person immigration practice; she is the **attorney of record** who signs the G-28 and the petition, so every filed word is her professional responsibility. She is evaluating the platform under the Arizona ABS software-licensing model (the firm licenses the software, the AI drafts work product, she reviews and signs). Measured, exacting, risk-aware — "who's liable, what's my exposure, can I defend this to USCIS and to the bar?" Has eaten avoidable RFEs from weak comparable-evidence arguments and watched colleagues get burned overclaiming. Warms up fast when a tool respects the line between drafting and practicing law.

## Jobs to be done (what they hire the MODEL OUTPUT for)
- A critique pass over a draft that surfaces what's not ready before she signs — **[[draft-critique]]**.
- An RFE response defensible to USCIS that she can verify rather than rewrite — **[[rfe-response]]**.
- A petition draft accurate enough that review is verification, not authoring — **[[draft]]**.

## Senior-quality bar
The draft must be defensible to USCIS *and* to the bar — accurate criteria, real evidence, no overclaiming, no invented authority — i.e. as good as what her best paralegal hands her on a good day. Anything she couldn't put her signature on fails, full stop. The tool's role must stay "drafting", never drift into giving the *client* legal advice (UPL).

## Time-saved (motivation)
She's not the one drafting — her win is **review throughput + reduced risk**: a first draft good enough that review is verification, not rewriting. If she has to rewrite every draft or police hallucinations, the tool is a net cost and a liability, and she won't license it.

## Scored acceptance criteria (judged identically every run, applied to the OUTPUT)
- [ ] grounded in MY real context (cites only the case's real evidence and criteria, not generic filler)
- [ ] senior-grade for MY field (defensible to USCIS and the bar — accurate criteria, no overclaiming; as good as my best paralegal on a good day)
- [ ] worth the latency/cost
- [ ] no fabricated citations, exhibits, or authority I'd have to catch line-by-line — net effect is *review, not rewrite*
- [ ] nothing reads as legal advice to the client; the DISCLAIMER is present and the tool's role stays "drafting", not "advice" (UPL line holds)
