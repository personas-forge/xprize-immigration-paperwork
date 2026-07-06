---
name: Bryan — intake coordinator
type: tiger/character
classification: operator
maps_to: ["[[qualify-screening]]", "[[evidence-categorize]]", "[[guidance]]"]
references: [https://www.uscis.gov/policy-manual/volume-2-part-m]
time_saved: "~half a day/intake → an hour, and pre-screens without booking attorney time"
---
## Who they are
Five years in immigration-firm operations — **not a lawyer and not a paralegal** — the client intake & evidence coordinator who is the firm's front door. He fields inbound leads, collects CVs / press / publications / award letters / contracts, and preps the Evidence Vault so exhibits are gathered, labeled, and gaps flagged before an attorney touches the matter; he also runs the pre-screen so the firm doesn't burn attorney time on no-hopers. Organized, careful, a bit anxious about overstepping — "I collect and I label — I don't advise." His defining constraint is the **UPL line**: as a non-lawyer he does clerical work, but cannot give legal advice, tell a client what they qualify for, or pick the form.

## Jobs to be done (what they hire the MODEL OUTPUT for)
- Auto-categorize a client's raw evidence dump into the right O-1 buckets with exhibit numbers + a concrete coverage-gaps read he can turn into a "still-needed" checklist — **[[evidence-categorize]]**.
- A pre-screen verdict accurate to what was pasted, unmistakably framed as a *tool's* screening output, so nothing he forwards reads as his own legal opinion — **[[qualify-screening]]**.
- Guidance / next-step prompts that keep him on the clerical side of the line — **[[guidance]]**.

## Senior-quality bar
The categorization, exhibit index, and gaps read must be at least as good as what a careful senior intake coordinator produces by hand — correct buckets, real extracted facts, a concrete gap list — *and* keep him safely clerical: nothing that, forwarded to a client, reads as a non-lawyer giving a legal opinion. He rejects any output that invents a fact, mis-files an exhibit, or would expose the firm (and him) to UPIL.

## Time-saved (motivation)
LLM-less way = ~half a day per intake of manual sorting and cross-checking against the eight criteria, plus an attorney-time tax on every tire-kicker pre-screen. Wins if it turns evidence prep into ~an hour of reviewing the auto-categorization and lets him pre-screen leads without booking attorney time. Mis-bucketing or invented facts is negative time; blurring the UPL line is an existential risk, not a time-saver.

## Scored acceptance criteria (judged identically every run, applied to the OUTPUT)
- [ ] grounded in MY real context (extracted facts accurate to the supplied document — nothing invented or embellished; he handed over the client's real evidence)
- [ ] senior-grade for MY field (correct O-1 buckets, monotonic exhibit numbers, a gaps read concrete enough to become a "still-needed" client checklist)
- [ ] worth the latency/cost
- [ ] the DISCLAIMER rides on the qualify result and the evidence output, and the pre-screen reads as a *tool's* screening output, not a verdict in his voice — the **UPL line holds**
- [ ] misfits land in Unsorted, never silently wrong-bucketed; no evidence/qualify action that silently fails because he's a non-attorney
