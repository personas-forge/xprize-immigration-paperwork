# L1 report — Sam Reyes (founder)

- **Character:** Sam Reyes — time-poor YC-backed technical founder, O-1A self-petitioner (DIY-if-good)
- **Segment:** beneficiary
- **Journeys walked:** qualify-verdict, draft-petition-letter, evaluate-as-prospect, share-verdict, track-case-progress
- **Date:** 2026-06-19 · **cert_level:** L1 (theoretical, code-grounded, no browser)

---

## Journey 1 — qualify-verdict · **L1-pass**

**Walkthrough.** Sam lands on `/` and the hero IS the screener (`InstantVerdict`, page.tsx:82-103): paste a CV, get a sealed certificate with zero signup. The eight-criteria machinery is correct — `summarizeCriteria`/`statusTone` are single-sourced (criteria.ts:27-103) so an unscored "None" criterion can never render green and the count can never disagree with the rows (the exact "unscored never green" requirement). The ≥3 threshold is honoured and pack-driven (packs.ts:88-95). The `/qualify` funnel leads with **best-path** across O-1A/O-1B/EB-1A (best-path.ts), ranked by clears-threshold → margin → gaps → likelihood with a one-line rationale and a green-card tag for EB-1A — legible and reasoned, not a coin flip (acceptance #3 met). The authenticated screening (`/api/qualify`) feeds Sam's **real pasted profile** verbatim into the prompt (`buildQualifyPrompt`, qualification.ts:159-161) and the prompt explicitly forbids inventing facts (qualification.ts:131-138). The `DISCLAIMER` rides on every result (qualification.ts:255) and renders first/non-dismissible (CriteriaReport.tsx:47). Next step is explicit ("Open case file" + 3-step panel). In the L2 dev-auth env Sam is auto-authenticated as `developer@localhost` (session.ts:66-69) with a 150-token grant, so the 401 wall on `/api/qualify` never bites him.

**Grounding audit.** Authenticated path = fully grounded (real profile → model). **Caveat worth carrying to L2:** the landing-hero `InstantVerdict` and the best-path finder both run ONLY the deterministic keyword mock (`mockQualification`), never the model — by design (preview/route.ts:18-28, best-path/route.ts:11-18), no signup/charge. For Sam's founder evidence the regexes map correctly: "founder/co-founder/CEO/CTO" → Critical role (packs.ts:74-79), "TechCrunch/Forbes/featured/press" → Press (packs.ts:50-55), "patent/invented/novel/pioneered" → Original contribution (packs.ts:62-67), "$<n>/equity/salary" → High remuneration (packs.ts:80-85). So a founder pasting "raised $4M, ex-founder, TechCrunch feature, granted patent" gets a believable instant read. But GitHub-shaped evidence ("12k stars", "open-source", "shipped product") is NOT in the O-1A `ORIGINAL`/`CRITICAL_ROLE` regexes — the keyword mock will under-score a pure GitHub/product founder until the *model* path runs. L2 must confirm the model maps GitHub/product → original contribution.

**Findings:** SR-QV-01 (minor, the hero verdict is keyword-only — manage Sam's expectation), SR-QV-02 (strength, grounding + UPL).

## Journey 2 — draft-petition-letter · **L1-pass**

**Walkthrough.** From the qualified case, `DraftStudio` renders inline with `criteria={result.criteria}` + `caseId` (QualifyPanel.tsx:278-283). "Draft the petition" POSTs with the `caseId`, so the draft route takes the **DB path** (draftOperation.ts:81-122): it re-loads the case's persisted criteria AND fuses in evidence-vault exhibits (`attachExhibits`), so the prompt is grounded in Sam's real, model-extracted evidence — not thin sample data. The full-letter prompt (drafting.ts:174-208) wraps applicant data in `<<<CASE_DATA>>>` markers with a prompt-injection guard, enforces strict citation discipline (use ONLY provided facts; no invented awards/citations/ARR; no case law), and — when exhibits exist — requires every `(Exhibit N)` to resolve to a real on-file document. `auditCitations` (drafting.ts:556-571) then quarantines any hallucinated exhibit number, and a **live adjudication gate** scans every draft for fabricated specifics ($ / % / years / big ints like star or citation counts) not traceable to the input and surfaces them as a visible "verify:" badge (adjudication-gates.ts:122-127, 212-217) — a direct, real safety net for Sam's "no fabricated stars/ARR/press" bar. Per-section **Regenerate** (5 tokens) hits the same route with `focus`, pins the heading, and merges into the latest stored draft as a new version, preserving the rest (draftOperation.ts:140-147, 205-225). Drafts persist versioned and re-open hydrated on the case detail (`initialSections`, case detail page.tsx:89-90). Cost is visible at the button ("Uses 12 tokens", DraftStudio.tsx:357).

**Grounding audit.** Strong. The criterion bullet renders `name [status]: evidence — rationale` (criteria-text.ts:35-40) where `evidence` is the qualify-model's paraphrase of Sam's text. The richness of that grounding depends on how well the qualify step captured his real numbers — that is an L2 prose-quality check, not an L1 structural gap.

**Findings:** SR-DP-01 (strength, fabrication tripwire + citation audit), SR-DP-02 (minor, mock-path draft uses templated evidence strings — only on the keyless build, not L2).

## Journey 3 — evaluate-as-prospect · **L1-pass**

**Walkthrough.** Positioning is unmistakable and consistent: hero says "work product, ready for *your* attorney of record to review and sign... informational drafting, never legal advice" and "We're a drafting tool, not a law firm" (page.tsx:154-157, 255). Sam's exact cost frame is named ("$8,000 to $15,000", page.tsx:154). Pricing is self-serve and canonical — landing + `/billing` both read `BUNDLES` from `economy.ts` (page.tsx:13/328, billing.tsx:10/95), so prices can't drift; `/pricing` permanently redirects to `/billing` (pricing/page.tsx:7-9). No "contact us for price" wall on the core offer (Enterprise is correctly the only contact-only tier). The free 150-token grant is shown. UPL line recurs on landing, billing footnotes, qualify, and every AI output.

**Findings:** SR-EV-01 (minor copy nit — billing headline "one token = one AI form-field guidance answer" (billing.tsx:56,130) undersells a real draft at 12 tokens; the landing pricing footnote already corrects this ("a full petition draft spends more", page.tsx:370-371) and per-op costs show at point-of-use, so it's a clarity nit, not a dark pattern).

## Journey 4 — share-verdict · **L1-pass**

**Walkthrough.** A positive screening offers "Share your Letters Patent" (`LettersPatentShare`, QualifyPanel.tsx:271-276, InstantVerdict.tsx:201-206). The token encodes ONLY name/classification/likelihood/per-criterion status (letters-patent.ts:69-77) — **never the profile text** — so nothing private leaks. `/c/[token]` renders from the token alone (no DB, page.tsx:43-46), and decode validates the program is live and the status count matches the pack, rejecting tampered tokens (letters-patent.ts:93-97). There's a per-result OG card (opengraph-image.tsx) that unfurls on LinkedIn/X and degrades gracefully on a bad token. Framing is honest: "Informational only · not legal advice · no account needed" (`/c/[token]` page.tsx:118-120). This is a credible founder-postable win, not cheesy (acceptance #7 met).

**Findings:** SR-SV-01 (strength, privacy-safe stateless certificate).

## Journey 5 — track-case-progress · **L1-conditional**

**Walkthrough.** `/dashboard` lists real cases above the mock demo via `YourCasesCard` (links to `/dashboard/cases/[id]`), with an `EmptyCasesCallout` → `/qualify` when none (CaseFileDashboard.tsx:31, 111-133). Case detail shows a `RoadmapStepper` (Qualified → Evidence → Drafted → Review → Filed → Decision) derived purely from real status + hasEvidence/hasDraft (roadmap.ts:38-59), and the draft re-opens hydrated. Deep-link "Open case file" works and the case detail page gates owner/attorney via `resolveCase`. Next action is always present.

**Why conditional (env-mode interaction, not a pure product bug):** the dashboard page short-circuits when `TOKENS_BYPASS=1` OR no store, leaving `cases = []` (dashboard/page.tsx:15-37). env.md recommends `TOKENS_BYPASS=1` for the *quality* journeys (J2/J5) to avoid depleting the 150-token grant — but in that mode Sam's **real cases do not list on `/dashboard`** (only the mock portfolio shows), even though the case WAS created (qualify's `persist` still runs under bypass because `getUser()` returns DEV_USER). The case is still reachable via the `/qualify → Open case file` deep-link (case detail uses `requireOnboardedUser()` unconditionally). So J5 "my dashboard lists my real cases" holds in real-economy mode and breaks only in bypass mode — a reachability footnote for L2 to pin down, not a structural dead-end.

**Findings:** SR-TP-01 (minor/major-pending-L2: dashboard case list suppressed under `TOKENS_BYPASS`).

---

## Findings table

| id | journey | type | severity | dimension | title | code_check | verdict |
|----|---------|------|----------|-----------|-------|------------|---------|
| SR-QV-01 | qualify-verdict | confusion | minor | clarity | Landing hero verdict is keyword-mock, not the model; pure GitHub/product founders under-scored until model path | by-design | confirmed |
| SR-QV-02 | qualify-verdict | strength | polish | trust | Real profile fed to prompt; UPL disclaimer first + non-dismissible; unscored never green | n-a | confirmed |
| SR-DP-01 | draft-petition-letter | strength | polish | trust | Live fabrication tripwire + citation audit guard Sam's "no fabricated stars/ARR/press" bar | n-a | confirmed |
| SR-DP-02 | draft-petition-letter | quality-gap | minor | senior-quality | Keyless mock-draft uses templated evidence strings (keyless build only; L2 uses real model) | by-design | confirmed |
| SR-EV-01 | evaluate-as-prospect | confusion | minor | clarity | Billing headline "1 token = 1 answer" undersells a 12-token draft | present-but-missed | confirmed |
| SR-SV-01 | share-verdict | strength | polish | trust | Stateless, privacy-safe certificate; no profile text in token; tamper-rejecting decode | n-a | confirmed |
| SR-TP-01 | track-case-progress | broken-flow | minor | completion | Dashboard real-case list suppressed when TOKENS_BYPASS=1 (deep-link still works) | present-broken | uncertain |

---

## First-person review — in Sam's voice

Okay, this one actually respects my time. I pasted my noise into the hero — ex-founder, TechCrunch, a granted patent, $4M seed — and a sealed certificate assembled in seconds with no signup. That's the demo I'd screenshot. The best-path screen answered the question I actually have ("O-1A or EB-1A?") with a real reason, not a coin flip — and it flagged EB-1A as a green card, which is the thing nobody tells you. Good.

What earns my trust is the boring stuff under the hood: the draft prompt is fed my *real* criteria and exhibits, it's told in caps not to invent my numbers, and there's a literal scanner that flags any dollar figure or star count in the output that isn't in what I gave it — with a "verify this" badge. That's the difference between this and ChatGPT, and it's exactly the failure mode that got me burned by the template service my friend's lawyer called "a liability". The disclaimer is everywhere and the framing is honest: it drafts, *my* lawyer signs. I never felt funnelled — pricing is right there, no "book a call".

Two things keep me from a clean yes. One: the instant hero verdict is keyword-matching, not the smart model — fine for a teaser, but if I were a pure GitHub-stars founder with no press, the free read would low-ball me and I might bounce before the real screening proves me right. Tell me the hero is the appetizer. Two: I'd want to actually *read* the generated prose before I commit — L1 can only tell me the pipe is grounded, not that the sentences sound like a senior immigration drafter instead of filler. That's the whole ballgame for "solid starting draft" vs "start over", and I'm reserving judgement until I see it live.

Would I tell a peer? Yes — "go run the free screener, it's the cleanest one." Would I pay and draft? If the live draft reads like a lawyer wrote it, absolutely — this is a few hundred tokens vs $12k and three months. That's not a close call.

## What passed (protect these)

- **Single-sourced criteria math** (criteria.ts) — unscored never green, summary can't disagree with rows. Don't refactor this apart.
- **Real-profile grounding** on the authenticated qualify + the DB-path draft (qualification.ts:159-161; draftOperation.ts:106-121).
- **Live adjudication gate** — fabrication / case-law / UPL / wrong-code scans on every paid output, surfaced as a visible badge (adjudication-gates.ts). This is the trust differentiator.
- **Citation discipline + audit** — `<<<CASE_DATA>>>` injection guard, exhibit-resolution requirement, `auditCitations` quarantine (drafting.ts).
- **Best-path comparison** — deterministic, reasoned ranking with green-card tagging (best-path.ts).
- **Stateless share certificate** — no DB, no profile leak, tamper-rejecting, with a per-result OG card (letters-patent.ts, /c/[token]).
- **Honest, canonical, self-serve pricing** — BUNDLES single source; `/pricing`→`/billing` redirect; UPL line consistent across every surface.
