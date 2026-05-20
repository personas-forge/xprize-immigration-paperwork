# Immigration Concierge — pre-launch checklist

UPL is the highest risk. Compliance items are not optional.

## Legal & compliance — gating items
- [ ] Attorney co-founder or paid partner named · state bar # · E&O insurance bound
- [ ] Law firm of record formed (LLC / PLLC per state requirements)
- [ ] Software license agreement between tech entity and law firm executed
- [ ] UPL legal review memo on file (state-by-state)
- [ ] No-legal-advice disclaimer on every customer touchpoint
- [ ] Intake script reviewed by attorney for UPL exposure
- [ ] Sample petition reviewed for UPL exposure
- [ ] Attorney is "of record" on every I-129 filed

## Infrastructure
- [ ] GCP project + billing alerts
- [ ] Firestore (Native mode) for case metadata
- [ ] Cloud Storage CMEK · per-tenant prefix · audit logging on every PHI / PII access
- [ ] Cloud Run + Cloud Load Balancing + custom domain
- [ ] Secret Manager for all API keys

## AI / model quality
- [ ] Gemini 1.5 Pro for petition drafting (1M-context confirmed needed)
- [ ] Petition draft eval set · 20 cases with attorney-graded scores
- [ ] Voice-match metric on 10 sample petitions (passes attorney review > 90%)
- [ ] AI never makes legal claims · prompt audit on file
- [ ] Citation verification step before any document leaves system
- [ ] Cost-per-petition dashboard (target < $40 Gemini)

## Document & filing pipeline
- [ ] Document AI processor live for diplomas, awards, recommendation letters
- [ ] Bates-numbering on every exhibit
- [ ] I-129 form fill tested with 5 sample cases (USCIS accepted format)
- [ ] DocuSign integration · attorney sign-off audit trail
- [ ] USCIS portal e-filing automation tested (Playwright)
- [ ] Receipt-notice email parsing tested
- [ ] RFE response bench drafted (8 most common RFE types)

## Billing
- [ ] Stripe milestone billing live · 50% upfront, 50% on filing
- [ ] Premium processing fee passthrough confirmed at cost
- [ ] Refund policy (case decline) published

## GTM
- [ ] YC / On Deck / Indie Hackers outreach scripts approved by attorney
- [ ] Build-in-public Twitter/X presence active
- [ ] Self-screening O-1 quiz live · lead capture confirmed
- [ ] Referral fee · $300 per filing
- [ ] 3 founder-community AMA sessions scheduled

## Customer success
- [ ] Voice intake · < 45 min average
- [ ] Drafting cycle · candidate to draft 3 in < 14 days
- [ ] Attorney review · < 5 business days
- [ ] Approval-rate target (> 85%) measured per cohort

## Submission package
- [ ] 40+ cases filed or fully drafted
- [ ] $100K+ revenue collected (Stripe export)
- [ ] 3-min demo video · intake → draft → attorney sign-off → USCIS receipt
- [ ] 3+ approved-case testimonials (premium = some come back in 15 days)
- [ ] Attorney bio + state bar # public on site
- [ ] Cost-per-case dashboard
