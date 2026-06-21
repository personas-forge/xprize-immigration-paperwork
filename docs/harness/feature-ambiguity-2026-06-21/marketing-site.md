# Marketing Site — Feature Scout + Ambiguity Guardian

> Context #20 · Group: Marketing & Design System
> Total: 5 findings

## 1. "Live" petition stepper depicts a managed full-service flow ("Voice interview booked", "Attorney Review") that contradicts the self-serve positioning
- **Lens**: ambiguity-guardian
- **Priority**: Critical
- **Category**: trade-off
- **File**: `src/components/PetitionStepper.tsx:21-49`
- **Observation**: The stepper is framed as a real case — header `§ Live · Petition File O1-241` (line 41) and copy "each one stamped, dated, and visible to you and your attorney from the moment it's pressed" (line 47-49). Its five stages narrate a managed, full-service pipeline: `Intake → "Voice interview booked — discovery in 24 hours"`, `Drafting → "Gemini assembling…"`, `Attorney Review → "Stage 3: Attorney reviewing every paragraph"`, `Filed → "I-129 e-filed with USCIS"`, `Approved` (lines 22-26). This directly conflicts with the product's reconciled identity — a self-serve drafting tool where YOUR OWN attorney signs and "We don't supply the attorney, file on your behalf" (faq/page.tsx:27, page.tsx:222). "Voice interview booked", a built-in "Attorney Review" stage, and "e-filed with USCIS" all read as services the tool performs, reintroducing the exact full-service implication the FAQ and Promises strip work to disclaim.
- **Proposal**: Reframe the stepper as an explicit illustration of the user-driven flow, not a live managed case. Drop "Voice interview booked"/"discovery" (no such service exists in this scan's copy), relabel "Attorney Review" → "Your attorney reviews & signs", change "I-129 e-filed with USCIS" → "Your attorney files", and label the block "Illustrative — a sample case file" instead of "§ Live". Keep it consistent with the four-step Process band (page.tsx:248-253).
- **Value / Risk-if-ignored**: This is the most prominent interactive element on the landing page and it is the single strongest residual full-service/"we provide an attorney and a voice interview" claim — a truthfulness/compliance risk for an immigration product where over-promising representation invites UPL and FTC-deception exposure. It also contradicts the rest of the site, eroding trust the moment a careful buyer compares sections.
- **Effort**: S

## 2. No social proof, testimonials, or sample-output gallery anywhere on the funnel
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/app/page.tsx:207-289`
- **Observation**: The landing page is Hero → InstantVerdict → Stepper → Promises → Process → Pricing → Closing (page.tsx:30-38). Every "proof" element is fabricated decoration: the hero card uses an invented petitioner "Dr. A. Krishnan", attorney "J. Park, Esq.", and a `Stamp label="Approved" meta="92% likelihood"` (page.tsx:173-195). There is zero real social proof — no customer testimonials, no approval-rate evidence, no logos, no count of petitions drafted, and no gallery of a redacted sample petition letter or qualification verdict so a buyer can see actual output quality before paying.
- **Proposal**: Add a testimonials/proof band (even 2-3 quotes or "N petitions drafted" once real) and a redacted sample-output section — a real (anonymized) qualification verdict and an excerpt of a drafted I-129 O-supplement narrative — between Promises and Pricing. This converts the abstract "drafted with care" claim into something a skeptical, high-stakes buyer can evaluate.
- **Value / Risk-if-ignored**: For an $8K-15K-alternative selling to founders/researchers/artists making an irreversible immigration decision, trust is the entire conversion barrier. With only fabricated certificates as "proof", visitors have no evidence the output is worth their money or their petition; this is a hard-to-sell-without-it gap.
- **Effort**: M

## 3. Unsourced "$8,000 to $15,000" firm-fee stat repeated as the core value claim across three pages
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/app/page.tsx:117`
- **Observation**: The headline economic claim — "The petition packet a firm would charge $8,000 to $15,000 to assemble" — is a hardcoded magic number repeated on the hero (page.tsx:117), the Promises strip "a fraction of the $8K-15K a firm bills" (page.tsx:212), and the alternate landing "a firm bills $8,000-$15,000" (landing-claude/page.tsx:65). It carries no citation, no "typical"/"as of" qualifier, and no source, yet it anchors the entire price-comparison pitch. Unlike the token prices (driven from `economy.ts` so they can't drift), this competitor-fee figure is free-floating prose that could be challenged as an unsubstantiated comparative-advertising claim.
- **Proposal**: Either soften to a clearly-hedged range ("attorneys commonly quote five figures to assemble an O-1/EB-1A packet") or cite a source and add an "as of 2026" qualifier, and centralize the figure in one constant so the three pages can't drift apart. Confirm the range is defensible before publishing it as a hard dollar comparison.
- **Value / Risk-if-ignored**: A specific, sourceless dollar comparison on a regulated-adjacent legal product is FTC comparative-claim risk and is trivially disputed; if one page is edited and the others aren't, the site quotes two different "firm fees", which reads as careless on the exact claim the funnel hinges on.
- **Effort**: S

## 4. No FAQ structured data (JSON-LD) despite eight on-page FAQ entries
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: feature
- **File**: `src/app/faq/page.tsx:24-57`
- **Observation**: The FAQ page renders eight Q&A entries (`QA` array) as native disclosures via `FaqEntry`, and the layout invests in rich metadata — OpenGraph, Twitter cards, canonical, manifest (layout.tsx:45-87). But the FAQ ships no `FAQPage`/`Question`/`Answer` schema.org JSON-LD, so Google can't render FAQ rich results. The high-intent queries this product targets ("how much does an O-1 petition cost", "do I need a lawyer for EB-1A") are exactly the questions these eight answers cover.
- **Proposal**: Emit a `FAQPage` JSON-LD `<script type="application/ld+json">` from the same `QA` array (single source — no duplicate copy), and consider a lightweight blog/SEO content hub for the same long-tail queries since none exists today.
- **Value / Risk-if-ignored**: Free organic acquisition for a product with no paid-funnel content engine; FAQ rich snippets lift CTR on precisely the comparison/cost queries that drive qualified traffic. Cheap, and the content already exists.
- **Effort**: S

## 5. Per-operation token costs hardcoded in FAQ prose can silently drift from the canonical registry
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: maintenance
- **File**: `src/app/faq/page.tsx:39`
- **Observation**: The FAQ "How much does it cost?" answer hardcodes "A qualification screening costs 3 tokens, a full petition-letter draft 12, a single-section regenerate or an RFE response 5, and evidence categorization 1." These match `registry.ts` today (TIER_COST medium=3, xl=12, heavy=5, light=1; registry.ts:16-43), but unlike the bundle prices — which the landing/pricing render from `economy.ts` so they "can't drift from /billing" (page.tsx:23) — these op costs are free-text. The same is true of "150 free tokens" appearing as both `{FREE_SIGNUP_GRANT}` (page.tsx:139) and a bare "150" literal in the FAQ prose (faq/page.tsx:39).
- **Proposal**: Drive the FAQ cost sentence from `costOf`/`TIER_COST` (and the grant from `FREE_SIGNUP_GRANT`) the way the bundle grid is driven from `BUNDLES`, or at minimum add a test asserting the FAQ literals equal the registry values, so a future re-pricing of any op can't leave the public FAQ quoting the wrong price.
- **Value / Risk-if-ignored**: A pricing tool whose public FAQ quotes a stale token cost after a registry change misleads buyers about what they'll be charged — a money-truthfulness gap. It's correct now, so this is preventive maintenance, not a live error.
- **Effort**: S
