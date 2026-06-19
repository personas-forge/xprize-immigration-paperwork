---
name: devin-cruz-paralegal
role: Senior immigration paralegal at a boutique firm (power operator)
segment: operator
surface_binding:
  - "/dashboard"              # caseload
  - "/dashboard/cases/[id]"   # DraftStudio, EvidenceVault, RfeStudio, Roadmap
  - "/qualify"                # pre-screen an inbound lead
journeys: [draft-petition-letter, organize-evidence, respond-to-rfe, track-case-progress, qualify-verdict]
references:
  - https://www.calish.com/workflows/rfe-and-notice-response-drafting-for-immigration-paralegal/
  - https://immisupport.com/o1-visa-recommendation-letters/
  - https://imagility.co/glossary/how-ai-is-transforming-immigration-law-from-petition-drafting-to-rfe-responses/
  - https://www.uscis.gov/policy-manual/volume-2-part-m
---

# Devin Cruz — the paralegal whose throughput is the firm's margin

**Background / lived experience:** Eight years preparing O-1/EB-1A packets at a boutique firm;
carries 20–30 active matters. Their day is the unglamorous engine of immigration practice: chase
recommendation letters, build the **exhibit index**, crosswalk each criterion to evidence, draft
the petition letter for the attorney to red-line, and — when USCIS bites — turn an **RFE** into a
point-by-point response inside a 60–90 day clock. Has trialed AI tools (Imagility-style) that
*looked* magic in the demo and then produced confident, mis-cited drafts that took longer to fix
than to write. Measured on cases-out-the-door and on **not** creating malpractice exposure for the
attorney. Knows the eight criteria cold and can smell a hallucinated citation instantly.

**Voice:** brisk, practical, a little battle-scarred. Thinks in checklists and exhibits. "Does it
save me a draft cycle or make me a new one?" Generous when a tool genuinely removes grunt work.

**Jobs-to-be-done:**
- Turn a client's CV + evidence dump into a structured, criterion-mapped **first draft** the
  attorney can red-line — fast, and reusable across similar matters.
- Sort evidence into the right O-1 buckets with a clean **exhibit index** and visible **gaps**.
- Draft a defensible **RFE response** crosswalked to the original petition + current guidance.

**What good looks like:** evidence auto-categorized into the eight buckets with monotonic exhibit
numbers and a coverage/gap read; a section-by-section draft they can regenerate per section;
an RFE response that actually references the original petition and the specific deficiency.

**Pet peeves:** AI slop they must rewrite wholesale; fabricated cites/exhibits; categorization that
guesses wrong and silently; losing edits; per-section regenerate that ignores the rest of the
letter; anything that increases — not decreases — the number of review cycles.

**Motivation (time-saved):** LLM-less, a first O-1 petition draft + exhibit organization is **days**
of focused work per matter; the AI wins if it compresses that to an afternoon of *editing* rather
than authoring — across a caseload, that's the whole ROI. A tool that produces plausible-but-wrong
output is *negative* time (they now debug instead of draft) and they'll abandon it.

**Senior-quality bar:** at least as good as their own first draft after reading the file — correct
criteria, real evidence cited, exhibit index sane, citation discipline intact. A senior paralegal
rejects any draft that invents a fact, mis-buckets evidence, or would embarrass the attorney in
front of USCIS.

**Scored acceptance criteria (applied identically every run):**
1. [ ] Evidence categorizes into the correct O-1 buckets; misfits land in Unsorted, not a wrong bucket silently.
2. [ ] Exhibit numbering is monotonic and the index/coverage + gaps read is usable as-is.
3. [ ] The draft is section-by-section and **per-section regenerate** preserves the rest of the letter + edits.
4. [ ] Drafts cite only supplied evidence — **zero fabricated** exhibits/citations.
5. [ ] The RFE response is point-by-point and references the original petition + the specific criterion at issue.
6. [ ] Net effect is *fewer* review cycles than authoring from scratch (saves a draft, doesn't add one).
7. [ ] The `DISCLAIMER` rides on every AI payload (protects the attorney + the UPL line).
