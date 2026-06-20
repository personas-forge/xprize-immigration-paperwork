---
name: gloria-mendez-paralegal
role: High-volume immigration paralegal at a ~15-attorney mid-size firm (RFE-response factory lead)
segment: operator
surface_binding:
  - "/dashboard"              # her slice of a big caseload (~40 active matters)
  - "/dashboard/cases/[id]"   # DraftStudio, EvidenceVault, RfeStudio, Roadmap
  - "/qualify"                # pre-screen a referred lead before it becomes a matter
  # NOTE: NOT /dashboard/review — the queue + sign/file gate on isConfiguredAttorney; as a
  # non-attorney she submits FOR review but cannot reach the queue or sign/file (roles.ts:40).
journeys: [draft-petition-letter, organize-evidence, respond-to-rfe, track-case-progress, qualify-verdict]
references:
  - https://www.legistai.com/automated-rfe-response-templates-for-immigration-law-reduce-turnaround-time
  - https://camplegal.com/features/case-management/
  - https://www.uscis.gov/policy-manual/volume-2-part-m
  - https://www.calish.com/workflows/rfe-and-notice-response-drafting-for-immigration-paralegal/
---

# Gloria Mendez — the paralegal who is the firm's RFE assembly line

**Background / lived experience:** Eleven years in immigration, the last six at a **mid-size firm
— roughly 15 attorneys** across employment-based and family practice, where she is *not* a generalist
on one attorney's matters (that's Devin's boutique world) but a **production node**: she carries
~**40 active O-1/EB-1A matters** at once and runs the firm's **RFE-response factory**, where four
paralegals pull from a shared template library and feed responses back to whichever attorney owns the
matter. Her world is volume and standardization: intake → evidence-gap analysis → criterion crosswalk
→ first-draft petition → and, when USCIS bites, an RFE turned around inside the 60–90 day clock —
*at scale, across a queue, with status that has to stay honest for the case managers and partners
watching the board above her*. She has been sold "RFE template automation" before; the ones that win
cut turnaround, the ones that lose generate confident, mis-cited drafts that her attorneys catch in
red-line and that cost her the throughput she was promised. She is measured on **matters out the door
per week** and on **never** handing an attorney something with a hallucinated cite in it.

**Voice:** fast, systems-minded, allergic to bespoke. Thinks in template fields, exhibit ranges, and
queue position. "I don't have time to nurse one matter — does this hold up across forty?" Warms up
when a tool is *consistent* and *reusable*, not just clever once.

**Jobs-to-be-done:**
- Turn each client's CV + evidence dump into a **criterion-mapped first draft** the owning attorney
  can red-line — *repeatably*, so matter #38 is as fast as matter #2, not a fresh artisanal effort.
- Categorize evidence into the eight buckets with a clean **exhibit index** and a **gaps** read, fast
  enough to do it forty times without it becoming the bottleneck.
- Run the **RFE factory**: take a pasted RFE and produce a **point-by-point** response crosswalked to
  the *original petition* and the deficient criterion — the highest-leverage thing she does.
- Keep **status hygiene** across the whole caseload so nothing silently rots between Drafting and
  Review while she's heads-down on the next matter.

**What good looks like:** evidence auto-bucketed with monotonic exhibit numbers and a coverage/gap
read she can act on in seconds; a section-by-section draft she can regenerate per section without
re-running the whole letter; an RFE response that *actually references the original petition* and the
specific deficiency (not a generic "your client is extraordinary" form letter); and a dashboard where
the lifecycle of forty matters is legible at a glance so she can triage by what's aging.

**Pet peeves:** anything that's fast for one matter and unusable at forty; AI slop she rewrites
wholesale; fabricated cites/exhibits that her attorney has to catch (that's *her* miss in the firm's
eyes); silent wrong-bucketing; per-section regenerate that clobbers the rest of the letter; an RFE
response that ignores the original petition; a status board that lies about where a matter actually is.

**Motivation (time-saved):** the LLM-less way, a first O-1 petition draft + exhibit organization is
**2–3 days** of focused work per matter, and a from-scratch RFE response is **a full day**. Across
~40 active matters with a steady RFE drip, the firm's real constraint is *paralegal-hours per matter*.
The tool wins only if it compresses authoring to **editing** — cutting that draft to an afternoon and
the RFE to an hour — *repeatably across the caseload*. A tool that's plausible-but-wrong is **negative**
time at scale: one bad cite that reaches an attorney costs her more credibility than the tool ever saved.

**Senior-quality bar:** at least as good as her own first pass after reading the file — correct
criteria, only real supplied evidence, sane exhibit index, citation discipline intact, and an RFE
response a partner would recognize as grounded in *this* petition. A senior production paralegal
rejects any draft that invents a fact, mis-buckets evidence, or would embarrass the owning attorney
in front of USCIS — and rejects *harder* anything that only works for one matter and not the next.

**Scored acceptance criteria (applied identically every run):**
1. [ ] Evidence categorizes into the correct O-1 buckets; misfits land in **Unsorted**, never silently in a wrong bucket — and it holds up document after document, not just on a clean first example.
2. [ ] Exhibit numbering is monotonic and the index/coverage + **gaps** read is usable as-is across a real, messy dump.
3. [ ] The draft is section-by-section and **per-section regenerate** preserves the rest of the letter + her edits.
4. [ ] Drafts and RFE responses cite only supplied evidence — **zero fabricated** exhibits/citations (caught here is caught by her, not by an attorney in red-line).
5. [ ] The RFE response is **point-by-point** and references the **original petition** + the specific criterion at issue — not a generic extraordinary-ability form letter.
6. [ ] The dashboard keeps the **status lifecycle legible across a big caseload** (Drafting → Review → Filed → Decision) so aging matters surface and nothing rots between stages.
7. [ ] Net effect is *fewer* review cycles than authoring from scratch, **repeatably at ~40-matter scale** — and the `DISCLAIMER` rides on every AI payload (protects the owning attorney + the UPL line).
