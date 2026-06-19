# L1 report — Devin Cruz (senior immigration paralegal · operator)

- **Character:** Devin Cruz — senior immigration paralegal (power operator), throughput = the firm's margin, burned by AI tools that ship plausible-but-wrong drafts.
- **Segment:** operator
- **Journeys walked:** draft-petition-letter, organize-evidence, respond-to-rfe, track-case-progress, qualify-verdict
- **Date:** 2026-06-19 · **cert_level:** L1 (theoretical, code-grounded, no browser)

---

## Per-journey verdicts

### 1. draft-petition-letter — **L1-conditional**

**Walkthrough.** This is the heart of my job and the machinery is genuinely good. The full-letter draft is built from the case's *real* persisted criteria (petitioner/classification/criteria loaded owner-only before any charge), the evidence vault is *fused in* so each criterion carries its real `(Exhibit N)` documents (`attachExhibits`), and the prompt enforces hard citation discipline — argue only from supplied facts, never invent awards/dates/counts, no case law, and cite only exhibit numbers that exist. After generation, `auditCitations` flags any `(Exhibit N)` that resolves to nothing on file and shows a coverage meter, and a *live* adjudication gate scans the output for fabricated specifics (numbers/years/money not traceable to the record), leaked case-law cites, and wrong visa codes, surfacing an attorney-readiness badge. The orchestrator reclaims the token and labels the result "mock" when the model returns junk, so I never pay for boilerplate stamped as model output. That is exactly the discipline I apply by hand, automated.

Two problems keep it from a clean pass. **First and worst:** per-section *regenerate* persists by merging the new section into the **last stored draft** (`getLatestDraft`), not into the sections I'm actually looking at. My plain textarea edits are local-only — there's no autosave and no "Save edits" button — so if I edit the Introduction, then regenerate the Awards section, the version that gets saved merges new-Awards into a stored draft that never had my Introduction edit. The screen still shows my edit for the session, but reopen the case and it hydrates from the stored version: my Introduction edit is **gone, silently.** That is my single worst pet peeve (losing edits) landing on a paid path. **Second, milder:** the section-regenerate *prompt* only sees that one criterion's data, not the rest of the letter, so a regenerated section can't stay narratively continuous with the others (the persistence keeps the other sections; it's a prose-continuity gap, not structural loss).

**Findings:** `dc-draft-01` (major), `dc-draft-02` (minor), plus the cross-cutting strength `dc-cross-01`.

### 2. organize-evidence — **L1-pass**

**Walkthrough.** This one I'd adopt as-is for the grunt work. Each pasted document is categorized against the *actual* classification's pack criteria from its real name+content, misfits are coerced to **Unsorted** (and a live gate fails any bucket not in the pack — no silent wrong-bucket into a fabricated criterion), and the exhibit number is assigned from a transactional high-water mark, so it's monotonic and **never reused** — deleting the top exhibit doesn't renumber the survivors, and refile keeps the exhibit glued to its document. The gap read (`summarizeVault`) is computed from real per-criterion coverage, the index reads like something I could file, and the DISCLAIMER rides on the categorize payload. The one soft spot: manual **refile** to a wrong bucket is unvalidated and then counts as coverage, so a careless re-file can inflate the "criterion covered" read — but refile is a legitimate human override and acceptable for an MVP. Whether the model puts a *press clipping* into Press vs Press-vs-Original-contribution is the L2 accuracy question; structurally this is sound.

**Findings:** strength `dc-evidence-01`; minor `dc-evidence-02`.

### 3. respond-to-rfe — **L1-pass** (with two minors)

**Walkthrough.** The grounding question I most wanted answered comes back the right way: the RFE prompt receives the **original petition's scored criteria + evidence + rationale + the fused vault exhibits AND the pasted RFE notice text** — not the RFE text alone. It's structured point-by-point (an opener naming the petition+RFE, one section per issue reinforcing the relevant criterion with on-record evidence, a closing), edits are keyed by index so duplicate headings don't collide, citation discipline + exhibit binding match the drafting path, and versions persist non-destructively and re-open from the latest. Reachability is correct — the studio only appears on a **Filed** case, and the API resolves owner-or-attorney before charging. Two nits keep me from raving: the RFE path has **no live adjudication gate** (drafts get one; a hallucinated number in an RFE wouldn't get flagged the way it would in a draft), and the prompt grounds on the *criteria* rather than the actual filed letter prose — right answer for most RFEs, one rung short of full fidelity. On a 60-90 day clock, this saves me a real draft cycle.

**Findings:** minors `dc-rfe-01`, `dc-rfe-02`; strength `dc-rfe-03`.

### 4. track-case-progress — **L1-pass**

**Walkthrough.** My real cases list at the top of the dashboard (above the illustrative mock case file), each deep-links to a case detail hydrated entirely from stored state behind an IDOR-closed `resolveCase` gate, and the roadmap stepper derives done/current/upcoming from real status + whether evidence/draft exist — drafting a letter, adding evidence, and submitting for review all move me forward correctly. Empty state points me to `/qualify`. The only friction is cosmetic: the hardcoded "Dr. Anya Krishnan / O1-241" sample case is still the visual hero below my real list, with a non-functional "Open petition letter" button — an accepted demo gap, not a defect.

**Findings:** strength `dc-track-01`; minor/scope `dc-track-02` (refuted as a defect — accepted gap).

### 5. qualify-verdict — **L1-pass**

**Walkthrough.** As a pre-screen for an inbound lead this is honest and grounded. The prompt embeds the *real pasted profile* and the pack's exact criterion names with an explicit "don't let one criterion satisfy another" rule (the discipline I apply manually), the parser always returns the **full canonical 8 criteria in order**, fills anything the model omitted with "None", coerces unknown statuses to "None", and "None" **never renders green** and never counts toward the **≥3 threshold** (which is read from the pack, not hardcoded, so EB-1A/O-1B don't misreport). The DISCLAIMER renders first and non-dismissible, and a live qualify gate checks canonical criteria/valid statuses/likelihood range/UPL language. Whether the *scoring* is calibrated rather than generous is the L2 question; the structure is exactly right.

**Findings:** strength `dc-qualify-01`.

---

## Findings table

| id | journey | type | severity | dimension | title | code_check | verdict |
|----|---------|------|----------|-----------|-------|------------|---------|
| dc-draft-01 | draft-petition-letter | broken-flow | **major** | trust | Section regenerate persists into last STORED draft, dropping unsaved edits to other sections | present-broken | confirmed |
| dc-draft-02 | draft-petition-letter | quality-gap | minor | senior-quality | Section-regen prompt lacks the rest of the letter (no narrative continuity) | by-design | confirmed |
| dc-rfe-01 | respond-to-rfe | missing-feature | minor | trust | RFE generation has no live adjudication gate (drafts do) | confirmed-absent | confirmed |
| dc-rfe-02 | respond-to-rfe | quality-gap | minor | senior-quality | RFE prompt grounds on criteria+evidence+exhibits, not the filed letter prose | by-design | confirmed |
| dc-rfe-03 | respond-to-rfe | strength | polish | completion | RfeStudio correctly gated to Filed cases (reachability) | by-design | confirmed |
| dc-evidence-01 | organize-evidence | strength | polish | trust | Monotonic never-reused exhibits; misfits → Unsorted, not a wrong bucket | by-design | confirmed |
| dc-evidence-02 | organize-evidence | confusion | minor | clarity | Unvalidated refile can silently inflate coverage | by-design | uncertain |
| dc-track-01 | track-case-progress | strength | polish | clarity | Roadmap derives from real state; real cases above mock, deep-links hydrate | by-design | confirmed |
| dc-track-02 | track-case-progress | confusion | minor | clarity | Mock sample case is the dashboard hero (accepted gap) | by-design | refuted |
| dc-qualify-01 | qualify-verdict | strength | polish | trust | Grounded on real profile; canonical 8 criteria; ≥3 threshold; None never green | by-design | confirmed |
| dc-cross-01 | draft-petition-letter | strength | polish | trust | Citation discipline end-to-end: real-vault exhibits, audited cites, live fabrication scan, mock never billed | by-design | confirmed |

---

## First-person review (Devin's voice)

I came in expecting to hate this, because every AI tool I've trialed demos like magic and then hands me a confident draft with a citation that doesn't exist and a bucket that's plain wrong — negative time, every time. This one is different in the place that matters: **it has citation discipline baked into the code, not just the marketing.** Exhibits are bound from my real vault, never from free text; the draft can only cite an `(Exhibit N)` that's actually on file, and if the model invents one, an audit flags it red instead of letting it slide into a packet. On top of that there's a live scan that catches fabricated numbers, leaked case-law cites, and the wrong visa code, and the system refuses to charge me for boilerplate when the model flakes. That's the first AI drafting tool I've seen that smells a hallucination the way I do. Evidence organization I'd hand off tomorrow — monotonic exhibit numbers that survive deletes, honest Unsorted, a real gap read. And the RFE responder actually does the thing the others fake: it crosswalks to my **original petition's criteria and evidence**, point by point, on the deficiency at issue — not just a paraphrase of the RFE.

What stops me short of "roll it out to the team" is one ugly edge: I can edit a section, regenerate a different one, and the **save quietly drops my first edit** because the regenerate merges into the last stored version, not what's on my screen — and there's no Save button or autosave to protect me. That's the exact thing that turns a tool from a time-saver into a trap, because I won't notice until I reopen the file and my Introduction rewrite is gone. Fix that and tighten the RFE path to get the same adjudication badge the drafts get, and this clears my bar: at least as good as my own first draft after reading the file, with the citation discipline intact and the disclaimer on every payload protecting the attorney. I'd tell a peer to watch it — and to save-as-they-go until the edit-persistence bug is dead.

---

## What passed (strengths worth protecting)

- **Citation discipline end-to-end** (`dc-cross-01`): real-vault exhibit binding (`attachExhibits`), inline citation audit with an `unresolved` quarantine (`auditCitations`), and a live fabrication/case-law/wrong-code adjudication gate shared single-source-of-truth with the eval harness. This is the spine that earns a burned paralegal's trust.
- **Mock is never billed as model output** — the orchestrator reclaims the charge and labels `source: "mock"` on unusable JSON (`lib/ai/operation.ts:312`). No paying for boilerplate.
- **Monotonic, never-reused exhibit numbers** from a transactional high-water mark (`pglite-store.ts:646`); misfits coerced to **Unsorted**, and a gap read derived from real coverage.
- **RFE prompt is properly grounded** on the original petition criteria + evidence + exhibits + the RFE text (`rfe.ts:176`), not the RFE alone — and is correctly gated to Filed cases.
- **Qualify is grounded + honest**: real profile in the prompt, full canonical criteria filled to "None", ≥3 threshold from the pack, "None" never green, DISCLAIMER first.
- **DISCLAIMER on every AI payload** via the single `wrapResult` / `buildXResult` chokepoint and on every orchestrator error body (402/429/500) — the UPL line is load-bearing and held everywhere I looked.
- **Roadmap + dashboard derive from real case state**, real cases above the mock, IDOR-closed case detail hydration.
