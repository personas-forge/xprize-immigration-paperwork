---
name: Gloria — paralegal
type: tiger/character
classification: operator
maps_to: ["[[draft]]", "[[draft-section]]", "[[rfe-response]]", "[[rfe-forecast]]", "[[evidence-categorize]]"]
references: [https://www.uscis.gov/policy-manual/volume-2-part-m]
time_saved: "2–3 days/draft + a full day/RFE → an afternoon + an hour, repeatably across ~40 matters"
---
## Who they are
Eleven years in immigration, six at a ~15-attorney mid-size firm where she's a **production node**, not a generalist: ~40 active O-1/EB-1A matters at once, running the firm's RFE-response factory (four paralegals pulling from a shared template library, feeding responses to whichever attorney owns the matter). Fast, systems-minded, allergic to bespoke — "I don't have time to nurse one matter — does this hold up across forty?" Measured on matters out the door per week, and on never handing an attorney a hallucinated cite. As a non-attorney she submits *for* review but cannot reach the queue or sign/file.

## Jobs to be done (what they hire the MODEL OUTPUT for)
- A criterion-mapped first draft the owning attorney can red-line, *repeatably* — **[[draft]]** — regenerable per section without clobbering the rest — **[[draft-section]]**.
- Evidence auto-bucketed into the eight criteria with a clean exhibit index + gaps read, fast enough to do forty times — **[[evidence-categorize]]**.
- The RFE factory: a point-by-point response crosswalked to the *original petition* and the deficient criterion — **[[rfe-response]]** — plus an honest read of likely RFE exposure — **[[rfe-forecast]]**.

## Senior-quality bar
At least as good as her own first pass after reading the file — correct criteria, only real supplied evidence, sane exhibit index, citation discipline intact, an RFE response a partner recognizes as grounded in *this* petition. She rejects any draft that invents a fact, mis-buckets evidence, or would embarrass the owning attorney before USCIS — and rejects *harder* anything that works for one matter but not the next. Throughput, not artistry: a plausible-but-wrong draft is negative time at scale.

## Time-saved (motivation)
LLM-less way = 2–3 days per first petition draft + exhibit organization, and a full day for a from-scratch RFE response. The firm's real constraint is paralegal-hours per matter; wins only if it compresses authoring to *editing* — draft to an afternoon, RFE to an hour — repeatably across ~40 matters. One bad cite that reaches an attorney costs more credibility than the tool ever saved.

## Scored acceptance criteria (judged identically every run, applied to the OUTPUT)
- [ ] grounded in MY real context (only this client's supplied evidence; correct buckets, misfits in Unsorted, never silently wrong-bucketed)
- [ ] senior-grade for MY field (holds up document-after-document at ~40-matter scale, not just a clean first example; monotonic exhibit numbers + usable gaps read)
- [ ] worth the latency/cost
- [ ] zero fabricated exhibits/citations — caught here by *her*, not by an attorney in red-line (protects the owning attorney + the UPL line; DISCLAIMER rides every payload)
- [ ] the RFE response is point-by-point and references the *original petition* + the specific criterion, not a generic extraordinary-ability form letter; per-section regenerate preserves her edits
