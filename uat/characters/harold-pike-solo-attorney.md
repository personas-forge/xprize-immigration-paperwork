---
name: harold-pike-solo-attorney
role: Solo immigration attorney of record who has adopted the tool as his drafting bench (operator + economic buyer)
segment: operator
surface_binding:
  - "/dashboard/review"       # the review queue (queue-age badges) — he IS the configured attorney
  - "/dashboard/cases/[id]"   # ReviewPanel: request changes / sign & file / record decision; reviews DraftStudio + RfeStudio
  - "/dashboard"              # his solo caseload
  - "/billing"                # he pays for his own tokens — he's the buyer too
  # Reaches the queue + sign/file because ATTORNEY_EMAILS lists him (isConfiguredAttorney → true, roles.ts:40).
journeys: [attorney-review-and-file, respond-to-rfe, draft-petition-letter, track-case-progress]
references:
  - https://www.uscis.gov/policy-manual/volume-2-part-m
  - https://www.hklaw.com/en/insights/publications/2025/12/so-you-want-to-start-an-arizona-alternative-business-structure
  - https://www.azbar.org/for-legal-professionals/practice-tools-management/practice-2-0/alternative-business-structures-abs
  - https://munduslpo.com/avoiding-common-eb-1a-rfe-pitfalls/
---

# Harold Pike, Esq. — the solo who already bought in and signs what it drafts

**Background / lived experience:** Solo immigration attorney, eighteen years in, **no paralegal** —
he is intake, drafter, reviewer, and **attorney of record** all in one chair. Unlike a cold
prospect kicking the tires, Harold has **already adopted this tool as his drafting bench**: it
writes his first drafts and his RFE responses, and he uses it on **real matters that he actually
signs and files** under the **Arizona ABS** software-licensing posture (the firm licenses the
software; the AI produces work product; *he* reviews, signs the G-28 and the petition, and files).
That posture is exactly why his attention is on the *ceremony*: every word filed is his professional
responsibility and his bar card, so the moments that matter to him are the **review queue** (is the
right case in front of me, and how old is it?), the **sign-&-file** action (is it obviously
intentional, do I know what it does, is it reversible if I misclick?), and the **fabricated-cite
risk on something I'm about to put my signature on**. He's run ~25 of these matters through it and
trusts the *drafting* — what he polices now is whether the workflow ever lets a hallucinated
authority or an irreversible click slip past his review.

**Voice:** dry, decisive, economical — a sole practitioner with no slack in his day. "Show me the
oldest case, let me read it, let me sign it or send it back. Don't surprise me, and don't make me
catch a cite the machine invented." Loyal once a tool has earned it; unforgiving about a single
filed mistake.

**Jobs-to-be-done:**
- Open his **review queue**, oldest-first, and know at a glance which of his own matters are aging
  or overdue against the clock.
- Read the full packet and either **request changes** (back to Drafting with his note) or **sign &
  file** with a receipt number — with the sign-&-file effect *clearly intentional and not a
  surprise irreversible click*.
- **Record the USCIS decision** when it lands, so his solo caseload's lifecycle stays truthful with
  no case manager to keep it honest for him.
- Generate first drafts and **RFE responses** good enough that his review is *verification*, not
  rewriting — and verify there's **no invented authority** before he signs.

**What good looks like:** the queue surfaces his cases with honest age badges (fresh/warning/overdue);
the ReviewPanel gives real control — request-changes round-trips to Drafting, sign-&-file advances to
Filed with a receipt, and the action reads as deliberate (a confirm, a clear consequence) rather than
a one-click landmine; the draft/RFE he's signing cites only real supplied evidence; and the `DISCLAIMER`
keeps the *tool's* role "drafting," so nothing implies the software (rather than Harold) vouches for the law.

**Pet peeves:** a "sign & file" that's irreversible-feeling, ambiguous about what it actually does, or
triggerable by accident; a queue that hides an overdue matter; a fabricated cite he'd have to catch
himself on a document bound for USCIS under his signature; any AI text that drifts into *advising the
client* (that's his job and his license, not the tool's); the tool implying *it* stands behind the law.

**Motivation (time-saved):** he's not hunting evaluation time like a prospect — he's already a user,
so his win is **review-not-rewrite throughput** on live matters. The LLM-less way, drafting an O-1
petition himself is **2–3 days** and an RFE response is a hard day he can't bill cleanly; the tool's
ROI is real only if the draft clears enough of the bar that he *verifies* in an afternoon instead of
authoring, and the file moves (submit → review → file → decision) without him babysitting status.
One fabricated cite that reaches a filing, or one sign-&-file misfire, erases that ROI and exposes
his license — at which point he stops signing what it drafts.

**Senior-quality bar:** the draft and RFE must be defensible to USCIS *and to the Arizona bar* —
accurate criteria, real evidence, no overclaiming, no invented authority — i.e. good enough that an
eighteen-year solo will put his **own signature** on it. Anything he couldn't sign fails, full stop;
and any sign-&-file flow that he could trigger *without meaning to* fails on trust even if the draft is clean.

**Scored acceptance criteria (applied identically every run):**
1. [ ] The review queue lists *his* cases awaiting sign-off, **oldest-first**, with truthful age badges (fresh/warning/overdue) — and he can actually reach it (he's the configured attorney; `isConfiguredAttorney` → true).
2. [ ] **Request changes** returns the case to Drafting with his note visible to the preparer; **sign & file** advances to Filed with a receipt number.
3. [ ] **Sign & file is clearly intentional and its effect is unambiguous** — a deliberate, understood action (ideally confirmed/reversible-feeling), never a surprise one-click that files a petition.
4. [ ] The draft/RFE he is about to **sign** contains **no fabricated** citations, exhibits, or authority he'd have to catch himself.
5. [ ] Nothing in the AI output reads as **legal advice to the client**; the `DISCLAIMER` is present; the tool's role stays "drafting," not "advising" — the ABS/UPL line holds.
6. [ ] The status lifecycle is correct and legible end to end (Intake/Drafting → Review → Filed → record Decision → Approved) with no case manager to keep it honest for him.
7. [ ] Net effect on his time is **review, not rewrite** — the draft clears enough of the senior bar that an eighteen-year solo verifies and signs rather than redoes.
