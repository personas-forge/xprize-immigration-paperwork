# L1 review — Marcus Bell (pro sport climber & national-team coach · O-1A athletics)

- **Character:** marcus-bell-athlete-coach · **segment:** beneficiary
- **Journeys walked:** qualify-verdict, draft-petition-letter, share-verdict
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, no browser)
- **Surface set (reachable as `developer@localhost`):** `/` (InstantVerdict), `/qualify` (BestPathFinder + QualifyPanel), `/dashboard/cases/[id]` (his own O-1A case — owner-gated, reachable), `/c/[token]` (share). Attorney sign/file affordances are walled off by `isConfiguredAttorney` (by-design, not on his beneficiary path).

---

## The athlete's central question, answered up front

Marcus's whole fear is the *inverse* of overclaiming: he's seen tools fabricate a "publication" from a magazine interview, or pad "judging" from one local comp, to make him look paper-complete — the exact stretch that draws an RFE. The two load-bearing questions for him are:

1. **Does the real screening honestly mark Scholarly articles / Press as thin-or-N/A** instead of force-fitting them?
2. **Does it credit his athlete-shaped evidence** — World Cup podiums + national titles → Awards, national-team → Membership, coaching the squad to medals → Critical role, sponsorships → High remuneration?

The **code answers both well on the authenticated path** (`/api/qualify` → real Claude). The risk for an athlete lives entirely in the **keyless keyword mock** that backs the `/` hero preview and the best-path ranker, whose regexes are scientist/founder-shaped.

---

## Surface model (from the real code, import chain cited)

**Qualify (his strongest path read):**
- `/` hero → `InstantVerdict` (`InstantVerdict.tsx:64`) POSTs `/api/qualify/preview` → **keyless `mockQualification`** (`preview/route.ts:69`), `source:"mock"`, no charge/DB/model. Honestly self-labels "This was an instant keyword read… the full screening reads your whole record in depth — catching strengths a quick scan misses" (`InstantVerdict.tsx:273-276`).
- `/qualify` → `QualifyEntry` (`QualifyEntry.tsx:18`) leads with `BestPathFinder`; "I already know my visa →" drops to `QualifyPanel`. Marcus selects **O-1A** from the live-program select (`QualifyPanel.tsx:42,147` → `livePrograms()` = O-1A/O-1B/EB-1A, `jurisdictions.ts:96`).
- `QualifyPanel.onSubmit` POSTs `/api/qualify` with `{name, profile, classification}` (`QualifyPanel.tsx:92`) → `executeAiOperation` → **real model** via `getLlm()` (`client.ts:55`, claude under `LLM_ENGINE=claude`). Prompt = `buildQualifyPrompt` (`qualification.ts:120`), fed **the full pasted `profile`** (`qualification.ts:161`) and the O-1A pack's 8 exact criterion names (`qualification.ts:140-141`, `packs.ts:90-98`).
- Result rendered by `CriteriaReport` (`QualifyPanel.tsx:270`) with the pack threshold (`packFor(classification).threshold` = 3).

**Draft:**
- `DraftStudio` (mounted inline at `QualifyPanel.tsx:278`, and on the case at `CaseDetailView`) POSTs `/api/draft` → `draftSpec` (`draftOperation.ts:95`). DB path sources criteria from the persisted case (`getCriteria`, `draftOperation.ts:147`) + fuses vault exhibits (`attachExhibits`, `:160-161`); inline path uses `result.criteria` (`draftOperation.ts:166`). Prompt = `buildDraftPrompt` (`drafting.ts:174`), one section **only per "Met"/"Strong" criterion** (`drafting.ts:83-85,204-205`).
- Per-section regenerate sends the user's CURRENT sections as continuity context (`DraftStudio.tsx:213` → `buildSectionPrompt(...otherSections)`, `drafting.ts:222-225`).

**Share:**
- `LettersPatentShare` (`QualifyPanel.tsx:271`) mints `encodeSnapshot` (`letters-patent.ts:69`) → `/c/[token]`. Token carries only name/classification/likelihood/statuses — **never profile text** (`letters-patent.ts:7-10,70-77`). `/c/[token]/page.tsx:45` and `opengraph-image.tsx:25` render purely from `decodeSnapshot` (no DB).

---

## Grounding audit (per AI surface)

**Authenticated `/api/qualify` (his real read) — grounding 5/5 of what this surface should use:**
| Source the read should use | Reaches the prompt? |
|---|---|
| His full pasted background CV | ✅ `req.profile` verbatim (`qualification.ts:161`) |
| The correct O-1A criteria set (8) | ✅ pack names injected (`qualification.ts:140-141`) |
| The ≥3 threshold | ✅ `packFor(classification).threshold` to `CriteriaReport` (`QualifyPanel.tsx:270`) |
| Anti-fabrication instruction | ✅ "Base every score ONLY on what the user describes. Do not invent facts, awards, publications…" (`qualification.ts:132-133`) |
| Anti-cross-pad instruction | ✅ Rule 4: score each criterion only from evidence specific to THAT criterion (`qualification.ts:135-138`) |

This is the best possible L1 grounding for his question — full CV in, correct pack, explicit no-fabricate / no-force-fit. **Grounding 5/5.**

**Keyless mock (the `/` hero preview + the best-path ranker) — grounding for an *athlete* ≈ 2/4 of his strong criteria:** the mock is regex keyword matching (`qualification.ts:225-248` over `packs.ts` regexes). Tracing his real evidence:
- Awards `/award|prize|medal|won|winner|…/` → hits on **"medals"** only; **"podium", "championship", "title" do NOT match.** Partial.
- Membership `/member|membership|…/` → hits "national-team membership". ✅
- Critical role `/founder|lead|leader|director|head of|principal|chief|…/` → **"coach"/"coaching" is NOT in the regex** → likely **None** unless he writes "led/head".
- High remuneration `/salary|compensation|remuneration|equity|\$\d|…/` → **"sponsorship" is NOT in the regex** → likely **None** unless he states a dollar figure.
- Scholarly `/paper|publication|journal|…/` → None ✅ (correct — exactly what he wants).

So the *keyword preview* can under-score an athlete to ~2/8 and **omit two of his genuinely strong criteria (Critical role, Remuneration)**. The SoftGate caveat mitigates the hero (`InstantVerdict.tsx:273-276`); the **best-path ranker has no equally prominent caveat** and ranks on this same thin mock with no model fallback (`best-path.ts:76`). **Lowest grounding score of the run: 2/4 on the athlete keyword path.**

**Draft — grounding = the per-criterion evidence/rationale captured at qualify (+ vault exhibits), NOT the full CV.** This is the *accepted* design `G1.3 / PN-DRAFT-01` (BACKLOG.md:37-46, "RESOLVED, accepted, no code change"): the qualify model captures his specifics into each criterion's evidence string, and that is the draft's argument. Suppressed per scope-honesty. L2 must confirm the live draft names *his* podiums/titles/sponsors on the grounded path.

---

## Journey 1 — qualify-verdict · **L1-pass**

**Walkthrough (in Marcus's head):** I land on `/qualify`, hit "I already know my visa →", pick **O-1A** (the select label literally reads "Extraordinary ability — sciences, education, business, **athletics**" — `packs.ts:93`; good, it knows athletes belong here), paste my podiums/titles/team/sponsors, "Check my eligibility". The real model gets my **whole** paragraph (`qualification.ts:161`) and the **eight** O-1A criteria by their exact names. The prompt explicitly forbids inventing awards/publications and forbids letting one criterion's evidence satisfy another (`qualification.ts:132-138`) — that's the anti-RFE-bait honesty I came for. The read-out can't paint a row green it didn't score: `statusTone("None") → "neutral"` and `summarizeCriteria` ignores None toward the ≥3 (`criteria.ts:27-48,84-95`), so my **Scholarly articles "None" renders neutral, never green, and never inflates the count** — and the same math drives the headline "X of 8 supported, need 3". A live `legalAdviceGate` UPL tripwire blocks "you will qualify / you should file" language (`adjudication-gates.ts:135-142,302-303`), and the `disclaimerGate` fails any payload missing the exact DISCLAIMER (`:204-209`). The `AdjudicationBadge` surfaces all of this (`QualifyPanel.tsx:269`). This is the read a sports-immigration associate would give: honest about the inapplicable criteria, crediting the ones I clear.

**Why pass, not conditional:** every acceptance criterion that lives on the authenticated path is structurally satisfied. The one wrinkle is the keyword preview under-scoring an athlete (MB-QV-01), but that surface honestly labels itself a quick keyword read and routes me to the deep model read — so it's a calibration/clarity minor, not a structural fail.

- **Grounding score:** 5/5 (authenticated) · 2/4 (keyword preview path)
- **Est. time-saved if it works:** paste → honest mapped verdict in well under 5 min vs his $6k–9k / 6–8-week sports-firm anchor — the verdict alone is a credible afternoon-vs-weeks win.

## Journey 2 — draft-petition-letter · **L1-pass**

**Walkthrough:** From the score I hit "Draft the petition" (`DraftStudio.tsx:389`). The letter is built **only from my "Met"/"Strong" criteria** (`drafting.ts:83-85,665`) — so my **None scholarly articles gets no section at all**; the tool literally cannot manufacture a paper I don't have, because there's no section to fill. The prompt's STRICT RULES forbid inventing awards/publications/dates/citation counts and fence my data against injection (`drafting.ts:181-192`). If I have vault exhibits the draft cites them as `(Exhibit N)` and an audit quarantines any hallucinated citation (`drafting.ts:593-608`; `DraftStudio.tsx:447-454`). The live `fabricationGate` flags any number/year/money in the output not traceable to my record (`adjudication-gates.ts:122-127,212-217,300`) — so a fabricated podium placement or sponsor figure gets surfaced for the attorney. Regenerating one section now passes the rest of the letter as continuity context (`drafting.ts:222-225` — the shipped `G1.1` fix) and preserves my other edits (`draftOperation.ts:75-93,254`). The disclaimer + "attorney work product" framing rides on every output (`DraftStudio.tsx:444`, `drafting.ts:184`).

**Caveat carried to L2:** the draft argues from the per-criterion evidence the qualify model captured, not my raw CV (accepted `G1.3`). For an athlete this means the draft is only as specific as the qualify model's evidence strings were — L2 must confirm the live draft actually names *my* IFSC podiums, national titles, the squad's medals, and my sponsors rather than generic "the record reflects an award."

- **Grounding score:** 3/4 (criteria evidence + exhibits + classification reach the prompt; the full raw CV does not, by accepted design)
- **Est. time-saved if it works:** a criterion-mapped, un-padded draft "in an afternoon" — the core of beating the firm, *provided* the grounded prose names his specifics (L2).

## Journey 3 — share-verdict · **L1-pass**

**Walkthrough:** "Copy link" mints a `/c/[token]` certificate. Only my name, O-1A, likelihood, and the per-criterion statuses travel in the token — **my pasted background never leaves my browser** (`letters-patent.ts:70-77`). The public page and OG card render entirely from the decoded token (no DB — `page.tsx:45`, `opengraph-image.tsx:25`), and `decodeSnapshot` rejects a tampered token whose status count doesn't match the pack (`letters-patent.ts:93-97`), so nobody can forge a bogus coat-of-arms. The criteria badges reuse `statusTone` (`page.tsx:104`), so my "None" scholarly shows neutral on the shared card too — it reads honest, not inflated. The stamp says "Qualifies" only when I clear the threshold (`page.tsx:126`), and the card is stamped "Informational only · not legal advice" (`page.tsx:119`). I'd send this to my federation/sponsor without worrying it overclaims.

- **Grounding score:** n/a (no AI surface) — structural check: token codec is honest, DB-free, leak-free.
- **Est. time-saved if it works:** instant credible verdict link for a sponsor/federation — pure upside over the firm path (which produces nothing shareable mid-process).

---

## Findings table

| id | journey | type | severity | dimension | impact | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| MB-QV-01 | qualify-verdict | quality-gap | minor | senior-quality | f:med r:med t:med | Keyword preview + best-path ranker under-score an athlete (regexes lack coach/podium/championship/title/sponsorship) | present-broken | confirmed |
| MB-QV-02 | qualify-verdict | trust | polish | trust | f:low r:high t:low | "Certificate/Approved" theater on the shared/hero read (known G3.1) | by-design | refuted (scope) |
| MB-DP-01 | draft-petition-letter | missing-feature | minor | senior-quality | f:low r:med t:med | Draft grounds on per-criterion evidence, not raw CV (accepted G1.3) — athlete specifics depend on qualify capture | by-design | refuted (scope) |
| MB-QV-03 | qualify-verdict | missing-feature | minor | missing | f:low r:low t:low | No athlete/coach profession in the SEO matrix; criterion examples are scientist/founder-shaped | confirmed-absent | confirmed |
| MB-QV-S1 | qualify-verdict | strength | polish | trust | — | Prompt explicitly forbids fabrication AND cross-criterion padding; "None" renders neutral via shared math | by-design | confirmed |
| MB-DP-S2 | draft-petition-letter | strength | polish | trust | — | Letter only sections "Met"/"Strong" criteria + live fabrication/UPL gates — structurally cannot manufacture a paper/podium | by-design | confirmed |
| MB-SV-S3 | share-verdict | strength | polish | trust | — | Share token leaks zero profile text; DB-free; tamper-rejecting; statuses stay honest on the card | by-design | confirmed |

---

## First-person review — in Marcus's voice

I came in expecting to fight a tool that wants to flatter me. I didn't have to. The real screening — the one behind sign-in — gets my *whole* write-up, scores it against the actual eight, and the prompt itself tells the model: don't invent awards or publications, and don't let my podiums pretend to be a paper. That's the line a good sports-immigration associate holds, and the code holds it too. My scholarly box comes back **None**, grey, not green, and it doesn't count against my three — exactly right. I've got podiums and a team that wins; I don't have papers, and finally a tool that doesn't pretend I do. The draft seals it: it only writes sections for the criteria I actually clear, so there's literally no empty "Scholarly Articles" paragraph begging to be padded, and a live gate flags any number it can't trace back to me — so no invented podium placement or sponsor figure slips through. The share link is clean: my CV stays on my machine, only the verdict travels, and the card reads honest enough to send my federation.

Two things keep me from a clean bill of health. First: the **instant read on the homepage and the "find my best path" comparison run a dumb keyword scan**, and that scan is built for scientists and founders — it knows "salary" and "patent" but not "coach", "podium", "championship", "title", or "sponsorship". So the quick read can show me a weak 2-of-8 and miss that I clear Critical role and High remuneration — the homepage at least *tells* me it's a shallow keyword pass and to go deeper, which saves it, but the best-path ranker doesn't say so as loudly, and I could walk away thinking O-1A is a stretch when it isn't. Second, smaller: the draft argues from whatever the screening captured about me, not my raw CV — so I'm trusting the screening to have written down *my* podiums by name. That's the one thing I can't confirm from the structure alone; show me a draft that says "IFSC World Cup, two national titles, the squad's medals, my apparel and hardware sponsors" and I'm sold.

Would I adopt it? For the real screening and the draft — yes, this beats $6k–9k and 6–8 weeks if the deep read names my evidence. Would I tell a peer? "Use it, but ignore the instant homepage number — go straight to the full O-1A screening; the quick scan undersells athletes."

## What passed (protect these)

- **Anti-fabrication + anti-force-fit is in the prompt, not just the marketing.** `qualification.ts:132-138` forbids inventing facts and forbids cross-criterion padding — the exact RFE-bait Marcus fears. Don't soften this wording.
- **"None" can never render green.** Single-source `classifyStatus`/`statusTone`/`summarizeCriteria` (`criteria.ts:27-95`) means the table tone and the threshold count can't disagree — his thin criteria stay honestly grey everywhere (report, case table, share card).
- **The draft structurally cannot manufacture a criterion** — it sections only "Met"/"Strong" (`drafting.ts:83-85`), so there's no scholarly-articles slot to pad. Plus the live `fabricationGate`/`legalAdviceGate`/`disclaimerGate` (`adjudication-gates.ts`).
- **Share leaks nothing private** — token carries statuses only, DB-free, tamper-rejecting (`letters-patent.ts:70-97`).
- **O-1A is correctly his pack end-to-end** — select → request → prompt → persisted case → case-detail criteria → draft all carry his chosen `O-1A`; the `packFor` O-1A fallback doesn't bite him because O-1A *is* both his classification and the fallback target.
