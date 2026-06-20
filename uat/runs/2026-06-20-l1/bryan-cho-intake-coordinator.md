# L1 review — Bryan Cho (intake & evidence coordinator)

- **Character:** bryan-cho-intake-coordinator · **Segment:** operator (NON-lawyer)
- **Journeys walked:** organize-evidence, qualify-verdict, track-case-progress
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)

Bryan is the firm's front door: he collects a client's raw evidence dump, preps the Evidence
Vault, and runs a fast pre-screen on inbound leads — and he must **never** appear to advise the
client. The UPL line is load-bearing for everything he touches.

**Reachability resolved before judging:** as the dev-auth user `developer@localhost` Bryan owns the
cases he creates via `/qualify`. The categorize op needs only authentication (not attorney), and the
case-detail page resolves owner-or-attorney through `resolveCase` — so **organize-evidence,
pre-screen, and track-progress are all fully reachable** for him. He is walled out of the review
**queue** (nav only renders for `isConfiguredAttorney`, `DashboardView.tsx:35`) and sign/file — **by
design and correct** for his role; no silent-fail wall was found on any evidence/qualify action.

**Pack-correctness (end-to-end):** classification is captured at qualify
(`qualify/route.ts:98` persists `req.classification`), read back on the case detail page
(`cases/[id]/page.tsx:74`), and threaded into both the criteria table and `EvidenceVault`
(`CaseDetailView.tsx:117,193-197`). The vault buckets and `summarizeVault` follow that classification
(`evidence.ts:111,229`). So once a case exists there is **no silent fallback-to-O-1A** — whatever the
firm intook (O-1A / O-1B / EB-1A) drives the right buckets. Pack correctness holds for Bryan's path.

---

## Journey 1 — organize-evidence · **L1-conditional**

**Grounding score: 4/5.** Sources the categorize prompt *should* see and *does*: (1) the document
name ✓, (2) the document's pasted text ✓ (`evidence.ts:136-138`), (3) the case classification's
exact criterion names ✓ (`evidence.ts:130-131`), (4) a read-only summary of what's already filed in
the vault ✓ — `summarizeVaultBuckets` is now wired through the route (`categorize/route.ts:64-75`,
`evidence.ts:84-101`), which **resolves the prior backlog item PN-EVID-01/G2.1** (categorization no
longer sees one doc in isolation). The one source it doesn't get is the *facts the model already
extracted on sibling docs* (only titles), but that's a refinement, not a gap. The prompt receives the
real document text, with explicit anti-invention rule 2 ("Base facts ONLY on the document's content;
do not invent anything", `evidence.ts:120`).

**Walkthrough (in Bryan's head):** I paste a client's award letter and press piece, name each, hit
"Add & categorize." The vault sorts each into one of the case's criteria (or honestly **Unsorted** —
`coerceBucket` forces anything off-list to Unsorted, `evidence.ts:145-148`), assigns a monotonic
`Ex. N` that's never reused even after a delete (`pglite-store.ts:652-664` — exactly the filable index
I need), extracts a few facts, and the coverage meter + **Gaps** badges tell me which criteria are
still empty (`summarizeVault` derives gaps from real per-bucket counts, `evidence.ts:226-244`). That
gaps read is concrete enough to become a "still-needed" checklist — criterion #2 met. And the honest
framing paragraph ("Evidence on file means documents are present — not that a criterion is proven …
Refiling moves a document … without re-checking", `EvidenceVault.tsx:210-216`) **resolves the prior
dc-evidence-02 concern** and keeps me on the clerical side of the line.

**Where it bites me:** the **DISCLAIMER never shows on this surface.** It rides on the API payload
(`evidence.ts:205`) and the component even types it (`EvidenceVault.tsx:27`), but the vault renders
criterion / exhibit / facts and **drops the disclaimer and the source label on the floor.** A grep
for `Disclaimer|disclaimer` across `src/features/case-file/components` returns **zero matches** — the
entire case-detail/evidence page has no UPL stamp on screen. This is the one thing that, screenshotted
and forwarded to a client as a "here's how your evidence maps to the criteria" read, could look like
**me** rendering a verdict. That's `bc-org-01` (major, trust). Secondary: the per-document **source**
(model vs keyword-mock) is captured but hidden (`bc-org-02`), so I can't tell which extracted facts
are template-derived before I file them; and the optimistic-add path can show `Ex. —` if persistence
is skipped (`bc-org-03`, edge case in my owner env).

**Findings:** bc-org-01 (major), bc-org-02 (minor), bc-org-03 (minor).
**Est. time-saved-if-it-worked:** ≈ half a day → ~1 hour per intake (auto-buckets + monotonic index +
concrete gaps), **once the disclaimer is on-surface** so I can forward the read safely.

## Journey 2 — qualify-verdict (pre-screen) · **L1-pass**

**Grounding score: 4/4** (authenticated path). The prompt receives the user's real pasted profile
(`qualification.ts:159-161`), the exact pack criteria + the right threshold (`qualification.ts:140-141`,
pack-driven), the petitioner name, and the model is held to per-criterion isolation (rule 4) + a hard
anti-invention rule (rule 2). The keyless landing preview is deterministic, never charges, never
persists, always `source:"mock"`, and carries the DISCLAIMER (`preview/route.ts:62-70`).

**Walkthrough:** This is the journey that most protects me. When I pre-screen a lead, the result is
unmistakably a **tool's** output, not my verdict: the `DisclaimerStamp` renders *first* and is
non-dismissible (`CriteriaReport.tsx:47`), the section is labelled "§ Self-screening · informational",
a provenance badge shows whether it was the real engine or the mock (`CriteriaReport.tsx:64`), and an
unscored criterion never renders green (None → `border-l-transparent`, `CriteriaReport.tsx:20-26`).
Even better, the qualify route runs a **live UPL adjudication tripwire** over the screening's own
evidence/rationale/gaps text (`qualify/route.ts:72-83`). Criterion #4 and #5 are met cleanly. The
landing "Certificate" framing is theatrical, but it self-labels "This was an instant keyword read"
and carries the disclaimer — I reference the open backlog item PN-QUAL-01/G3.1 rather than logging a
new defect.

**Findings:** bc-qual-01 (strength), bc-qual-03 (strength); bc-qual-02 references backlog
PN-QUAL-01.
**Est. time-saved-if-it-worked:** an attorney-time tax on every tire-kicker → a self-serve read I can
run and forward without booking attorney time. Real firm margin across an inbound stream.

## Journey 3 — track-case-progress · **L1-pass**

**Grounding score: n/a** (non-AI surface; roadmap derives from real case state).

**Walkthrough:** From the dashboard I see my **real** intakes in `YourCasesCard` above the mock, or
an empty-state CTA pointing me at `/qualify` (`CaseFileDashboard.tsx:31`). I open one and the
**Roadmap** stepper (Qualified → Evidence → Drafted → Review → Filed → Decision) marks done/current/
upcoming purely from status + whether evidence/draft exist (`roadmap.ts:38-58`, fed real flags at
`CaseDetailView.tsx:133-137`) — so when I add the evidence I owe them, the Evidence stage advances. I
never need attorney privileges to track; the review-queue nav simply isn't shown to me
(`DashboardView.tsx:35-45`), which is the *right* wall, not a confusing one. The only friction is the
hardcoded mock "Dr. Anya Krishnan / Drafting / 92%" case file that renders **below** my real cases
(`bc-track-02`) — but that's the accepted "mock demo case file" gap, so a scope note, not a defect.

**Findings:** bc-track-01 (strength), bc-track-02 (scope note → accepted gap).
**Est. time-saved-if-it-worked:** I always know what each intake is waiting on (evidence I owe vs. in
review) at a glance — no chasing the attorney or paralegal to ask "where is this?"

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|----|---------|------|----------|-----------|----------------|-------|------------|---------|
| bc-org-01 | organize-evidence | trust | **major** | trust | high/high/high | DISCLAIMER on categorize payload but never rendered on the Evidence Vault surface | confirmed-absent | confirmed |
| bc-org-02 | organize-evidence | quality-gap | minor | trust | med/high/med | Per-doc source (model vs mock) captured but hidden | confirmed-absent | confirmed |
| bc-org-03 | organize-evidence | quality-gap | minor | clarity | low/med/low | Optimistic-add shows `Ex. —` when persistence skipped | present-broken | uncertain |
| bc-qual-01 | qualify-verdict | strength | polish | trust | high/high/low | Pre-screen framed as a tool's output (disclaimer-first + provenance + UPL tripwire) | by-design | confirmed |
| bc-qual-02 | qualify-verdict | quality-gap | minor | trust | med/med/med | "Certificate" framing of keyless preview (refs PN-QUAL-01) | by-design | uncertain |
| bc-qual-03 | qualify-verdict | strength | polish | senior-quality | high/high/low | Anti-invention + per-criterion isolation in qualify prompt; None never green | by-design | confirmed |
| bc-track-01 | track-case-progress | strength | polish | completion | high/high/low | Real cases above mock; roadmap from real state; trackable w/o attorney | by-design | confirmed |
| bc-track-02 | track-case-progress | confusion | minor | clarity | med/high/low | Mock demo case file below real intakes (accepted gap) | by-design | refuted |

---

## First-person review — in Bryan's voice

I collect and I label — I don't advise. So the first thing I check on any tool is: can I forward what
it gives me without it sounding like *I* told the client they qualify? On the **pre-screen**, the
answer is a relieved yes. The disclaimer sits right at the top of the result, the section literally
says "informational self-screening," there's a little badge telling me whether a real model or the
keyword fallback produced it, and — I didn't expect this — there's a tripwire scanning the output for
anything that reads like legal advice. That's the most careful framing I've seen. I'd run it on every
tire-kicker and pass the read along, and I wouldn't lose sleep.

The **Evidence Vault** is *so close* to being the half-day-to-an-hour win I want. It buckets a client's
documents into the right criteria, gives me clean "Ex. 1, Ex. 2" numbers that don't shuffle when I
remove something, and the Gaps badges hand me my "still-needed" checklist without me having to
cross-check eight criteria by hand. It even tells me, in plain words, that "evidence on file" isn't
"criterion proven" — exactly the hedge that keeps me clerical. But here's what stops me: **there's no
disclaimer anywhere on that page.** The categorized exhibit list with the model's extracted facts is
precisely the artifact I'd screenshot and send the client — "here's how your stuff lines up, here's
what we still need" — and on screen it carries nothing that says "this is a tool, not advice." The
machinery put the disclaimer in the data; the screen just doesn't show it. For *my* job that's the
difference between a tool I can adopt and one that quietly exposes the firm. Fix that one line and I'm
in. (I'd also love a "model vs. keyword" tag on each doc so I know which facts to double-check before
filing.)

**Tracking** is genuinely good — my real intakes sit above the demo file, the roadmap moves when I do
the work, and I'm never shown the attorney's review queue, which is correct. The only beat is the fake
"Dr. Krishnan" case under mine, but I know that's the sample.

**Would I tell a peer?** For pre-screening and tracking, yes today. For evidence prep, yes *the day the
disclaimer renders on the vault* — until then I'd be hand-stamping every export, which eats the hour I
was supposed to save.

## What passed (protect these)

- **Pre-screen UPL framing** — DisclaimerStamp-first, non-dismissible; provenance badge (mock vs
  engine); live UPL adjudication tripwire on qualify (`CriteriaReport.tsx:47,64`, `qualify/route.ts:72`).
- **Keyless landing preview** — deterministic, never charges/persists, always `source:"mock"`, carries
  the disclaimer; can't leak a paid engine to anonymous traffic (`preview/route.ts:62-70`).
- **Anti-invention + per-criterion isolation** in the qualify prompt; unscored criteria never green
  (`qualification.ts:129-138`, `CriteriaReport.tsx:20-26`).
- **Pack-correctness end-to-end** — classification persisted at qualify and threaded into the criteria
  table + vault buckets; no silent O-1A fallback once a case exists (`qualify/route.ts:98`,
  `cases/[id]/page.tsx:74`, `CaseDetailView.tsx:193`).
- **Monotonic, never-reused exhibit numbering** via a high-water-mark ordinal (`pglite-store.ts:652-664`).
- **Honest coverage framing** — "documents present, not criterion proven; refile doesn't re-check"
  (`EvidenceVault.tsx:210-216`) — keeps Bryan clerical (resolves dc-evidence-02).
- **Whole-vault categorization context** wired in (`categorize/route.ts:64-75`) — resolves PN-EVID-01.
- **Real-cases-above-mock + roadmap-from-real-state + attorney-only review nav** (`CaseFileDashboard.tsx:31`,
  `roadmap.ts:38-58`, `DashboardView.tsx:35`).
