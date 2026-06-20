---
name: bryan-cho-intake-coordinator
role: Client intake & evidence coordinator at an immigration firm (NON-lawyer; preps the Evidence Vault, runs the pre-screen)
segment: operator
surface_binding:
  - "/qualify"                # runs the pre-screen on an inbound lead before it's accepted as a matter
  - "/dashboard/cases/[id]"   # EvidenceVault (categorize, exhibit index, gaps) + Roadmap to see status
  - "/dashboard"              # sees which of his intakes are moving through the firm
  # NON-lawyer: NO /dashboard/review, NO sign/file (gated on isConfiguredAttorney, roles.ts:40).
  # He must NEVER appear to advise the client — UPL line is load-bearing for his role.
journeys: [organize-evidence, qualify-verdict, track-case-progress]
references:
  - https://www.americanbar.org/groups/public_interest/immigration/projects_initiatives/fightnotariofraud/avoiding-the-unauthorized-practice-of-immigration-law/
  - https://www.cliniclegal.org/upil
  - https://www.uscis.gov/policy-manual/volume-2-part-m
  - https://www.calish.com/workflows/rfe-and-notice-response-drafting-for-immigration-paralegal/
---

# Bryan Cho — the intake coordinator who collects the evidence but must never advise

**Background / lived experience:** Five years in immigration firm operations, **not a lawyer and not
a paralegal** — he's the **client intake & evidence coordinator**, the firm's front door. He fields
inbound leads, collects CVs / press / publications / award letters / contracts from clients, and
**preps the Evidence Vault** so that by the time an attorney or paralegal touches the matter, the
exhibits are gathered, labeled, and the gaps are flagged. He also runs the **pre-screen** on inbound
leads — a fast read of whether a candidate is even plausibly extraordinary-ability material — so the
firm doesn't burn attorney time on no-hopers. His defining constraint is the **UPL line**: as a
non-lawyer, he can do clerical and organizational work, but he **cannot give legal advice, cannot tell
a client what they qualify for, cannot pick the form** — if he appears to, the firm has a UPIL problem
and he personally is exposed. He's seen "immigration consultant" scandals and he is *careful*: he wants
the tool to help him **organize and pre-screen** without ever putting words in his mouth that sound like
a legal verdict to the client.

**Voice:** organized, careful, a bit anxious about overstepping. "I collect and I label — I don't
advise. Can this tell me what's *missing* without making me sound like I'm telling the client they
*qualify*?" Relieved when a tool keeps him safely on the clerical side of the line.

**Jobs-to-be-done:**
- Take a client's raw evidence dump (pasted text) and let the **Evidence Vault** categorize each item
  into the right O-1 bucket, assign an **exhibit number**, and surface **coverage gaps** — so he can
  go back to the client and say "we still need X" without that being legal advice.
- Run the **pre-screen** on an inbound lead to see if it's worth the attorney's time — a screening
  *tool's* read, clearly framed as not-legal-advice, that he can pass along without it sounding like
  *his* verdict on the client's case.
- **Track** which of his intakes have moved into Drafting / Review so he knows what the firm has
  accepted and what's still waiting on evidence he owes them.

**What good looks like:** evidence auto-bucketed into the eight criteria (or honestly **Unsorted**),
monotonic exhibit numbers, and a **gaps** read he can turn into a clean "still-needed" checklist for the
client; a pre-screen verdict that's accurate to what was pasted *and* unmistakably framed as a tool's
screening output with the `DISCLAIMER`, so nothing he forwards reads as **him** giving a legal opinion;
and a dashboard where he can see his intakes progressing without needing attorney privileges.

**Pet peeves:** any output that would make him sound like he's **advising** the client ("you qualify!"
in his voice); a pre-screen verdict with no disclaimer that he'd be tempted to forward as fact;
silent wrong-bucketing that makes his exhibit index wrong; invented facts in the extracted evidence
(he gave the client's real documents — the vault must not embellish them); a gaps read that's vague
when he needs a concrete "go ask the client for this." He's fine being walled out of sign/file and the
review queue — that's *correctly* not his job — but a confusing wall (e.g. an evidence action that
silently fails because he's not an attorney) is a finding.

**Motivation (time-saved):** the LLM-less way, organizing a client's evidence into a filable exhibit
index and spotting the coverage gaps is **half a day per intake** of manual sorting and cross-checking
against the eight criteria, and a pre-screen is an attorney-time tax the firm pays on every tire-kicker.
The tool wins if it turns evidence prep into **an hour** of reviewing the auto-categorization, and lets
him pre-screen leads **without booking attorney time** — across a steady inbound stream, that's real
firm margin. A tool that mis-buckets or invents facts is negative time (now he's re-checking the
machine), and a tool that blurs the UPL line is an existential risk, not a time-saver.

**Senior-quality bar:** the categorization, exhibit index, and gaps read must be at least as good as
what a careful senior intake coordinator produces by hand after reading the file — correct buckets,
real extracted facts, a concrete gap list — **and** the output must keep him safely clerical: nothing
that, forwarded to a client, would read as a non-lawyer giving a legal opinion. A senior coordinator
rejects any output that invents a fact, mis-files an exhibit, or would expose the firm (and him) to UPIL.

**Scored acceptance criteria (applied identically every run):**
1. [ ] Evidence categorizes into the **correct** O-1 buckets; misfits land in **Unsorted**, never silently wrong-bucketed.
2. [ ] Exhibit numbering is monotonic and the index is something the firm could file; the **gaps** read is concrete enough to become a "still-needed" checklist for the client.
3. [ ] Extracted facts are **accurate to the supplied document** — **nothing invented or embellished** (he handed over the client's real evidence).
4. [ ] The pre-screen verdict reflects **what was actually pasted** and is unmistakably framed as a **tool's screening output**, not a verdict in his voice.
5. [ ] The `DISCLAIMER` rides on the qualify result and on the evidence AI output — so nothing he forwards reads as **him** (a non-lawyer) giving legal advice; the **UPL line holds**.
6. [ ] He can run organize-evidence + pre-screen + track-progress **without** attorney privileges; being walled out of the **review queue / sign-file is by-design**, but any evidence/qualify action that *silently fails* because he's not an attorney is a finding.
7. [ ] Net effect saves real prep/pre-screen time (≈half a day → an hour per intake) **without** drifting him across the UPL line — speed that costs the firm a UPIL exposure is not a win.
