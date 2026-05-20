# Immigration Concierge — 12-week build backlog

> Source brief: `C:\Users\kazda\xprize\Designs\02-immigration-paperwork.md`
> Design prototype: `C:\Users\kazda\xprize\claude` (open `/app/immigration`, variants A "Case file" + B "Roadmap")

---

## 1. Mission
Deliver attorney-quality O-1A visa petitions at one-third the typical cost ($2,500 flat vs. $8–15K market) by letting Gemini do every templated task — qualification, evidence gathering, petition drafting, exhibit indexing, RFE response drafting — while a licensed immigration attorney provides the legal judgment, signature, and USCIS filing.

## 2. Customer & wedge
- **Target:** O-1A applicants in tech — founders, senior engineers, researchers, designers — who would genuinely qualify but balk at attorney rates
- **They are:** YC alumni, GitHub-prominent, paper-citing, press-mentioned, $200K+ salaried
- **Wedge:** dominate O-1A first; then O-1B (arts), EB-1A self-petition, H-1B premium processing
- **Distribution:** YC / On Deck / Founders Inc. founder networks, On Deck Twitter/X, university grad-student associations (Stanford, MIT, CMU), referral fees

## 3. Unique added value vs. incumbents
| Incumbent | Their failure mode | Our move |
|---|---|---|
| Boutique immigration firms | $8–15K, hourly billable, slow | $2,500 flat, 21-day median to file |
| Big-law immigration practices | $25K+, employer-funded only | Self-pay friendly, founder-targeted |
| Lawfully / Lawyaw (legal-tech) | Tools for lawyers, not customers | Customer-first, attorney-of-record built-in |
| DIY USCIS forms | UPL fear, no clue what evidence to gather | AI assembles 28-exhibit package automatically |

## 4. Pricing & trial
- **O-1A · $2,500 flat** — full petition + I-129 + cover + 28 exhibits, attorney sign-off, e-filing
- **O-1B (arts) · $3,500 flat** — same plus tailored arts-industry evidence curation
- **EB-1A self-petition · $4,500 flat** — 12-month engagement
- **RFE response add-on · $500** (free with original engagement)
- **USCIS premium processing $2,805** — passthrough at cost
- **Trial:** free qualification call + free first-revision guarantee. 50% upfront / 50% on filing.

## 5. Tech stack
- **Frontend:** Next.js 14 on Cloud Run; long-form editor (variant B "Roadmap" view) using TipTap or Lexical
- **LLM:** Gemini 1.5 Pro for petition-letter drafting (1M-context window critical for full evidence inclusion)
- **Vision / parsing:** Document AI for diplomas, awards, recommendation letters
- **Voice intake:** Vapi or Retell — 45-minute discovery interview, claims everything you'd write on a CV
- **Document gen:** docx-templater on Cloud Run → PDF via Cloud Print
- **E-sign:** DocuSign for attorney sign-off; signed PDFs locked in Firestore
- **Storage:** Firestore for case metadata, Cloud Storage (CMEK, per-tenant prefix) for evidence
- **CRM / case management:** Custom React UI; Linear-style for attorney review queue
- **E-filing:** USCIS portal (attorney login)
- **Cost target:** Gemini cost per petition < $40 (worth it vs. $2,500 ASP)

## 6. 12-week roadmap

### Month 1 — Find your attorney, build the spine (weeks 1–4)
- **Week 1** — Find attorney co-founder or paid partner ($300–500/case + equity). Form law firm of record. Build legal-services contract templates. Project skeleton.
- **Week 2** — Voice intake agent (Vapi or Retell). Captures CV, publications, GitHub, press, employment, awards. 45-min average.
- **Week 3** — Evidence vault: parse uploaded PDFs/images via Document AI. Auto-categorize into the 8 O-1A criteria buckets. Bates-numbering.
- **Week 4** — Petition letter drafting v1. Gemini prompted on USCIS guidance + publicly redacted approved petitions. **Deliverable:** end-to-end demo on 3 pro-bono cases (real founders, real filings).

### Month 2 — Sign, file, learn (weeks 5–8)
- **Week 5** — Attorney review UI (variant A "Case file"). Inline edits, sign-off workflow, rejection-with-feedback flow.
- **Week 6** — DocuSign + I-129 form filler. Filing-ready package.
- **Week 7** — USCIS e-filing automation (Playwright, monitored). RFE detection from receipt notice email parsing.
- **Week 8** — First 5 paid filings. Stripe milestone billing (50% upfront / 50% on filing). **Deliverable:** $12,500 collected, 10 cases in flight.

### Month 3 — Scale and ship (weeks 9–12)
- **Week 9** — RFE response drafting (40% O-1 RFE rate industry-wide; our edge is pre-drafted bench).
- **Week 10** — Voice match: train petition drafts on the candidate's own voice from the discovery interview. Pass GPTZero-style detectors.
- **Week 11** — Founder community outreach: YC mailing list, On Deck, Indie Hackers, founder DMs. **Deliverable:** 25 cases.
- **Week 12** — Polish + hardening + demo video + submission. **Deliverable:** 40+ cases at $2,500 avg = $100K revenue.

## 7. Feature epics
- **E1 · Qualification quiz + voice intake** — 5-min web quiz, then 45-min voice interview
- **E2 · Evidence vault** — encrypted GCS, per-tenant prefix, Document AI parsing, bates-numbering
- **E3 · Petition letter editor** — long-form editor with criteria-aware AI suggestions inline
- **E4 · Attorney review queue** — sign-off workflow, rejection-feedback, signed-PDF locker
- **E5 · I-129 form fill + cover letter generator**
- **E6 · E-filing automation** — USCIS portal via Playwright; receipt-notice parsing
- **E7 · RFE bench** — pre-drafted responses for common RFEs (judging-others, original-contribution, etc.)
- **E8 · Client portal** — variant B "Roadmap" view; what's done, what's next, ETAs
- **E9 · Sales pipeline** — founder community automation; referral tracker

## 8. Distribution / GTM
1. **Founder communities** — YC, On Deck, Indie Hackers, Founders Inc.; AI runs warm intro outreach via founder mailing-list newsletters.
2. **University grad-student offices** — Stanford, MIT, CMU CS PhD lists. OPT → H-1B → O-1 pipeline.
3. **Twitter/X build-in-public** — immigration is one of the most-discussed topics among tech founders.
4. **Referral fees** — $300 for every successful referral, paid on filing.
5. **Content + self-screening quiz** — AI-written, attorney-reviewed guides on "Do you qualify for O-1?" + quiz that captures email.

## 9. Risks & mitigations
- **UPL (unauthorized practice of law)** — single highest risk. Mitigation: attorney-owned firm structure; firm is the legal entity, the Next.js app is licensed software to that firm. Disclaimers at intake. No legal advice from AI; AI gathers + drafts only.
- **Adverse case selection** — turn down weak candidates honestly. Builds long-term trust; protects approval rate.
- **USCIS rejection / RFE** — RFE bench pre-drafted; RFE response included free. Approval-rate target > 85%.
- **Slow conversion cycle** — O-1 processing months. Milestone billing brings 50% revenue forward.
- **Trust gap** — founder face on site, attorney bio prominent, free initial consultation.

## 10. Success metrics
- Cases filed (target 40+ in 90 days)
- Revenue cash-collected (target $100K)
- Attorney hours per case (< 2 hrs, vs. industry 15–25)
- Approval rate (> 85%)
- NPS / referral conversion

## 11. Definition of "hackathon ready"
- [ ] 40+ cases filed or fully drafted in pipeline (revenue $100K+ collected)
- [ ] Attorney co-founder named with state-bar #
- [ ] Demo video: candidate at intake → petition letter → attorney sign-off → USCIS filing receipt
- [ ] 3+ approved case testimonials (premium processing means some come back in 15 days)
- [ ] Cost-per-case dashboard
- [ ] UPL legal review memo on file
