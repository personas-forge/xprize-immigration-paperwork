# L1 review — Lucia Ferraro, documentary director (O-1B arts)

**Character:** lucia-ferraro-filmmaker · **Segment:** beneficiary · **Date:** 2026-06-20 · **cert_level:** L1
**Journeys walked:** qualify-verdict, draft-petition-letter, organize-evidence, share-verdict
**Surfaces modeled (real code):** `/` InstantVerdict · `/qualify` (BestPathFinder + QualifyPanel) · `/visa/o-1b/artist` · `/dashboard/cases/[id]` (CaseDetailView → criteria, EvidenceVault, DraftStudio) · `/c/[token]` + OG image.

---

## The one test that matters: does my classification reach the O-1B SIX, not the O-1A eight?

I built the surface model by following the import chain from each entry affordance to the code that backs it. The short version: **the O-1A-fallback trap that the protocol warned about cannot bite me.** `packFor()` only falls back to O-1A for an *unknown/unset* classification (`packs.ts:223-225`), but O-1B is a **live program** (`jurisdictions.ts:63`), so:

- `parseQualifyRequest` keeps `"O-1B"` because `isLiveProgram("O-1B")` is true (`qualification.ts:108-111`).
- `buildQualifyPrompt` enumerates `packFor("O-1B").criteria` by name — the arts six (`qualification.ts:140-141`).
- `CriteriaReport` renders `result.criteria` straight from the pack, **no hardcoded O-1A list** (`CriteriaReport.tsx:119-153`).
- The qualify route **persists `req.classification`** onto the case (`route.ts:98`), so the case is born O-1B.
- On `/dashboard/cases/[id]` the DB classification flows into the criteria header (`§ II — O-1B criteria`, `CaseDetailView.tsx:143`), the **EvidenceVault buckets** (`CaseDetailView.tsx:196` → `criteriaNames(classification)`, `EvidenceVault.tsx:55`), and the **DraftStudio** (`CaseDetailView.tsx:204` → draft prompt uses `gate.value.classification`, `draftOperation.ts:151`).
- The `/visa/o-1b/artist` landing reads `packFor("O-1B")` and pre-selects O-1B in its embedded screener (`page.tsx:76,186`), with `artist`-tuned examples per O-1B criterion (`professions.ts:103-111`).
- The share token encodes/decodes against the O-1B pack and **rejects a tampered token whose status count ≠ 6** (`letters-patent.ts:93-97`).

The pack itself is clean: O-1B = 6 criteria (Lead role in distinguished productions, National/international recognition, Reviews & press, Record of major commercial/critical success, Recognition from organizations & experts, High salary), and **"Scholarly articles" / "Judging" / "patent" / "Original contribution" simply do not exist in my pack** (`packs.ts:99-141`). O-1B has a `verified` validation record (3 of 6, 8 CFR 214.2(o)(3)(iv)) shown on the screen (`validation.ts:79-102`). **Acceptance criterion 1: PASS.** I never see the patent question on my screen.

---

## Journey 1 — qualify-verdict · **L1-conditional**

**Walkthrough (in my head):** Two doors. If I take **"I already know my visa → O-1B"** (`QualifyEntry.tsx:48-52`), I land in QualifyPanel, the visa selector offers O-1B (`livePrograms()` includes it), and the real authenticated screening runs the model against the arts six and (criterion 2) should name *my* Sundance/IDFA selections, NYT/Variety reviews, the deal, the DGA/IDA membership. That door is clean.

The other door — **"Find my best path"** — is where I get nervous, and the code confirms why. Best-path scores every program with the **keyword mock only** (`best-path route:57-60`, `best-path.ts:71-98`). Against my own pack, my real words **miss** on my two strongest claims: "Lead role in distinguished productions" matches `lead role|starring|principal|headlin|featured performer` — **"director"/"directed" is not in it** (`packs.ts:106`); "Record of major commercial or critical success" matches `box office|...|streams|...` — a **"distribution deal"** and **"streaming"** are not `streams` (`packs.ts:124`). And the gut-punch: on the **O-1A** pack, "director" *does* match Critical role (`packs.ts:79`) — the keyword view literally reads me as a business critical-role, the exact misread I've lived through. I still tend to *clear* O-1B (recognition + reviews + org/expert ≈ 3/6) while O-1A sits at 2/8, so the recommendation usually lands on O-1B — but it lands right by luck of which keywords fire, the rationale is keyword-thin, and the comparison card shows my **lead creative role as unmet**. That's a `major` (`lf-qual-02`).

The landing `/` certificate is also a keyword mock with generic "what we found" lines (`route:69`, `packs.ts:119`) — "Mentions reviews or press coverage." instead of "New York Times Critic's Pick." It's honestly labelled an "instant keyword read" with a soft gate to the deeper read (`InstantVerdict.tsx:273-277`), so it's disclosed, not deceptive (`lf-qual-03`, minor).

**Grounding score: 2/6** on best-path / landing (it sees my profile *text* but through keyword regex, not my named festivals/reviews/deal/membership; no case facts, no evidence). The authenticated `/qualify` model path is the one that grounds on my real record — L2 must prove that.

**Est. time-saved-if-it-worked:** vs my anchor ($8k–12k + 2–3 months of an arts firm), a correct O-1B verdict that names my films in minutes is the whole point — but only if I take the "I already know my visa" door or the model read overrides the keyword miss.

## Journey 2 — draft-petition-letter · **L1-conditional**

**Walkthrough:** From my O-1B case the draft is generated per *qualifying criterion by name*, so my section headings would be "Lead role in distinguished productions", "Reviews & press", etc. — **the arts grammar, correct** (`drafting.ts:174-208`, prompt uses `${req.classification}`). On the DB path it's grounded on my persisted O-1B criteria **plus the vault's real exhibit facts** (`draftOperation.ts:147-161`), citation discipline forbids inventing festivals/reviews/box-office (`drafting.ts:181-192`), and `auditCitations` quarantines any `(Exhibit N)` that doesn't resolve to a real document (`drafting.ts:593-608`, surfaced in `DraftStudio.tsx:447`). A fabricated Sundance year or made-up gross has **no grounding path** — that's a genuine strength (`lf-draft-02`).

Two snags. First, the user-facing copy hardcodes **"Draft a full O-1A petition letter"** (`DraftStudio.tsx:376`) even on my O-1B case — the engine is right, but for the one person whose deepest fear is an O-1A-shaped process, reading "O-1A" on the button is exactly the wrong word (`lf-draft-01`, minor; stale "O-1A" comments at `drafting.ts:5,350,374` too). Second, and more material: **the draft prompt has no arts-specific guidance** (`lf-draft-03`, major). Nothing tells the model that, for O-1B, "lead role" means lead *creative* role in a distinguished production, that reviews are the field's recognition currency, or that a distribution deal evidences commercial/critical success. Whether my "Lead role" and "Reviews & press" sections read like a real arts petition or a relabeled business argument rides entirely on the model's defaults from the criterion name + my persisted evidence — invisible to static analysis, so it's L2's to judge.

**Grounding score: 4/6** (persisted criteria ✓, evidence/rationale ✓, vault exhibit facts ✓, the rest of the letter for section regenerate ✓ via `buildSectionPrompt` continuity, `drafting.ts:222-278`; but the *raw CV* is not re-fed — accepted PN-DRAFT-01/G1.3 — and there's no arts framing). **Est. time-saved-if-it-worked:** an afternoon to a red-line-ready draft — the headline promise, contingent on the arts prose landing.

## Journey 3 — organize-evidence · **L1-pass**

**Walkthrough:** The vault buckets are *my* six (`EvidenceVault.tsx:55`), categorization sends my case's O-1B classification (`EvidenceVault.tsx:72`), the prompt enumerates the arts six and coerces anything off-list to **Unsorted** (`evidence.ts:106-148`). Exhibit numbers are **monotonic, never reused** — a high-water mark across `doc_seq` and surviving rows, so deleting one doesn't renumber the rest (`pglite-store.ts:646-693`). Coverage only counts pack criteria; an Unsorted bucket never closes a gap (`evidence.ts:226-244`); and the UI is honest that "documents present ≠ criterion proven" and that refiling doesn't re-check fit (`EvidenceVault.tsx:210-216`). Structurally there is **no "Judging" bucket** for my Variety review to fall into — my single biggest mis-bucket fear is impossible here (`lf-evid-01`, strength). One residual: the *keyless* mock categorizer is first-match-in-pack-order, so a review that also says "acclaimed" could be swallowed by "National/international recognition" (criterion 2) before "Reviews & press" (criterion 3) (`evidence.ts:185-191`, `lf-evid-02`, minor) — but under `LLM_ENGINE=claude` the model classifies, so this is a mock-only risk.

**Grounding score: 5/6** (sees the document name + full pasted text; G2.1 even feeds a whole-vault summary for sibling consistency, `evidence.ts:84-101`; only missing is binary/OCR, an accepted env-gap). **Est. time-saved-if-it-worked:** a filed-looking exhibit index without paralegal hours.

## Journey 4 — share-verdict · **L1-pass**

**Walkthrough:** The "Letters Patent" mints only my name/classification/likelihood/per-criterion statuses into a base64url token — **never my profile text** (`letters-patent.ts:69-77`, `LettersPatentShare.tsx:26-32`). `/c/[token]` and the OG image decode it and render from `packFor("O-1B")` — **six** arts badges — rejecting a tampered status count (`letters-patent.ts:93-97`), so the coat-of-arms can't drift from my real pack. It's labelled "Certificate of Extraordinary Ability", the Stamp honestly reads "Qualifies"/"In progress" vs threshold, and the footer says "Informational only · not legal advice" (`page.tsx:118-126`). Renders DB-free from the token alone (`lf-share-01`, strength). Minor nit: the share affordance shows even below threshold (`QualifyPanel.tsx:271`), only the `/c` Stamp downgrades the framing — a non-issue for my strong record (`lf-share-02`, polish).

**Grounding score: 6/6** for what this surface needs (it's not an AI surface; it faithfully reflects the verdict, leaks nothing). **Est. time-saved-if-it-worked:** a credible card I'd actually send my producer/line producer.

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|----|---------|------|----------|-----------|----------------|-------|------------|---------|
| lf-qual-01 | qualify-verdict | strength | polish | trust | high/high/high | O-1B reaches the arts SIX end-to-end — no O-1A leak | by-design | confirmed |
| lf-qual-02 | qualify-verdict | quality-gap | **major** | senior-quality | high/med/med | Best-path keyword mock misreads a director ('Lead role'/'commercial success' miss; O-1A catches 'director') | by-design | confirmed |
| lf-qual-03 | qualify-verdict | quality-gap | minor | senior-quality | high/high/low | Landing '/' is keyword mock — generic evidence, not named festivals | by-design | confirmed |
| lf-draft-01 | draft-petition-letter | quality-gap | minor | clarity | high/high/low | DraftStudio copy hardcodes 'O-1A petition letter' on her O-1B case | present-broken | confirmed |
| lf-draft-02 | draft-petition-letter | strength | polish | trust | high/high/high | Citation discipline + exhibit audit blocks fabricated festival/review/box-office | by-design | confirmed |
| lf-draft-03 | draft-petition-letter | quality-gap | **major** | senior-quality | med/high/med | No arts-specific draft guidance — director 'distinction' may flatten to business framing | confirmed-absent | uncertain |
| lf-evid-01 | organize-evidence | strength | polish | completion | high/high/med | Vault buckets follow O-1B pack; monotonic, never-reused exhibits | by-design | confirmed |
| lf-evid-02 | organize-evidence | quality-gap | minor | senior-quality | med/high/med | Keyless mock could swallow her review under 'recognition' (order-dependent) | present-broken | uncertain |
| lf-share-01 | share-verdict | strength | polish | trust | med/high/med | Share card DB-free, leaks no profile, renders the O-1B six, framed informational | by-design | confirmed |
| lf-share-02 | share-verdict | trust | polish | trust | low/med/low | Share affordance offers a link even below threshold | by-design | uncertain |

**Severity counts:** blocker 0 · major 2 · minor 3 · polish/strength 5.

---

## First-person review — Lucia's felt verdict

I came in braced for the trap I've already lived through, and the first thing I want to say is: **this tool did not ask me for a patent.** It didn't show me "scholarly articles." When I screen as O-1B, the six things it scores me on are *my* field's six — lead role in distinguished productions, recognition, reviews & press, commercial/critical success, recognition from organizations and experts, salary — and that's true everywhere I looked: the screening, my case file's criteria table, the evidence buckets, the draft headings, even the certificate I'd share. For someone who got burned by a paralegal who ran her through a business intake, that consistency is not a small thing. It's the difference between a tool and a trap.

But I'm a director — I notice where the seams show. The "Find my best path" comparison reads me with a keyword machine that doesn't know "directed" means *lead creative role*; it shrugs at my distribution deal and, worse, it's the **O-1A** column that perks up at the word "director." If I'd come in unsure and trusted that comparison at face value, it would whisper the wrong answer with a confident face. I clear O-1B anyway and it usually points me there, but it points me there by accident of vocabulary, and it tells me my lead role is "not met" — the one thing a documentary director's case is *built* on. The fix is easy (the comparison is admittedly just a rough keyword pre-read), but until then I'd tell a peer: skip the comparison, click "I already know my visa," choose O-1B, and let the real read work.

And then the part a static review can't settle: when it drafts my "Lead role" section, does it argue distinction the way an arts O-1 actually reads — my films, my festivals, my reviews as the measure of acclaim — or does it relabel a business argument with an arts heading? The machinery is honest (it won't invent a Sundance year or a box-office number it doesn't have — I checked, there's no path for that), but nothing in the prompt teaches it *how a director is judged*. That's the question I'd hold my signature on, and it's the one I'm handing to L2. Small thing that stung more than it should: the draft button literally says "Draft a full **O-1A** petition letter" on my O-1B case. The engine's right; the word is wrong; and it's the exact word I never want to see again.

**Would I adopt it?** Yes — through the right door, and with my attorney red-lining the draft, which it correctly insists on at every step. It clears my bar on *pack identity* and *no fabrication*. It does not yet clearly clear it on *arts-specialist drafting voice*, and the best-path door needs a fix before I'd trust it to a colleague who's still guessing her visa. Forgivably plain in places; unforgivable nowhere. That's a pass-with-conditions from me.

---

## What passed (protect these)

- **O-1B → arts-six wiring, end to end** (qualify → case criteria → evidence buckets → draft headings → share card). The `packFor()` O-1A fallback is correctly walled off because O-1B is a live program. `packs.ts:99`, `jurisdictions.ts:63`, `qualification.ts:108`, `CaseDetailView.tsx:143,196,204`.
- **No "Scholarly articles"/"Judging"/"patent" anywhere in my pack** — my worst-case mis-bucket (review under Judging) is structurally impossible. `packs.ts:99-141`.
- **Citation discipline + `(Exhibit N)` resolution audit** — a fabricated festival/review/gross has no grounding path; an invented exhibit citation is flagged. `drafting.ts:181,593`, `DraftStudio.tsx:447`.
- **Monotonic, never-reused exhibit ordinals** — deleting a doc never renumbers survivors. `pglite-store.ts:646`.
- **DB-free, profile-free share token** that renders the O-1B six and rejects tampering. `letters-patent.ts:69,93`.
- **The DISCLAIMER rides every AI payload** (qualify, draft, categorize, share framing) and the attorney-must-sign line is everywhere. `qualification.ts:255`, `drafting.ts:694`, `evidence.ts:205`, `page.tsx:118`. **Acceptance criterion 6: PASS.**
- **Honest self-labeling** — the landing read is called an "instant keyword read", keyless drafts are stamped "Placeholder output", coverage says "documents present ≠ criterion proven". Honesty the build flags about itself.
