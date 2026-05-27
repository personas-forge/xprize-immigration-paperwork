# Backlog Brainstorm — Meridian (immigration-paperwork)

100 medium-to-large business feature ideas for PM triage in the Vibeman Tinder module. Tailored to a Gemini-drafted, attorney-supervised O-1 visa product expanding into the broader US immigration paperwork space.

| # | Title | Description | Category | Effort | Impact | Risk |
|---|-------|-------------|----------|:-:|:-:|:-:|
| 1 | O-1A criteria auto-classifier from resume + LinkedIn | Ingest a candidate's resume and LinkedIn export, then auto-map achievements to USCIS O-1A's eight regulatory criteria with confidence scores and gap callouts. | automation | 6 | 9 | 4 |
| 2 | Free 60-second qualification check funnel | Top-of-funnel quiz that returns a Go/No-Go O-1A score and captures email; doubles as the primary lead magnet on the marketing site. | growth | 3 | 9 | 2 |
| 3 | Petition draft generator with Gemini long-context | Stream a full §III petition narrative grounded only in uploaded evidence, with inline citations to exhibits and tracked attorney edits. | functionality | 8 | 10 | 6 |
| 4 | Evidence vault with CMEK-encrypted Cloud Storage | Per-case bucket with customer-managed encryption keys, granular ACLs, and audit logs to satisfy attorney work-product confidentiality. | compliance | 6 | 8 | 5 |
| 5 | DocuSign attorney sign-off and G-28 packaging | Generate the G-28, petition, and exhibits as a single signing envelope so the attorney signs once and the package is filing-ready. | integration | 5 | 9 | 3 |
| 6 | Stripe milestone billing (qualify, draft, file) | Three-step billing tied to product milestones with auto-pause on attorney hold and pass-through USCIS fees billed separately. | monetization | 4 | 7 | 3 |
| 7 | Recommendation letter writer with persona prompts | Draft tailored letters from each recommender's voice using their CV and relationship to the beneficiary, with explicit attorney edit gates. | automation | 6 | 9 | 6 |
| 8 | Exhibit indexer with auto-numbered Bates stamps | Auto-name and Bates-stamp every uploaded exhibit, generate a hyperlinked exhibit list, and rebuild the index on reorder. | functionality | 4 | 8 | 2 |
| 9 | USCIS Case Status polling and Slack/SMS alerts | Watch the public case status endpoint for each receipt number and notify the applicant + attorney on every change with diffs. | retention | 4 | 8 | 3 |
| 10 | RFE response drafting workflow | Ingest the scanned RFE notice, classify the deficiencies, and draft section-by-section responses with new exhibit suggestions. | automation | 7 | 9 | 6 |
| 11 | Voice intake via Vapi/Retell for non-native speakers | Phone-based intake in 12+ languages that captures biographic data and routes a structured transcript into the case file. | ux | 6 | 7 | 4 |
| 12 | Petition diff viewer for attorney revisions | Side-by-side diff of the AI draft and the attorney's red-line with accept/reject controls and reasoning notes. | functionality | 5 | 7 | 2 |
| 13 | EB-1A upsell path from approved O-1A cases | Detect O-1A approvals strong enough to support EB-1A and auto-trigger a green card upsell with pre-filled drafts. | monetization | 5 | 9 | 3 |
| 14 | O-1B expansion for artists and entertainers | Adapt the criteria engine and templates to O-1B's extraordinary-ability-in-the-arts standard with industry-specific evidence packs. | functionality | 6 | 7 | 4 |
| 15 | H-1B cap-season companion product | Tier targeting H-1B registrants with employer-side LCA prep and beneficiary document checklist as an annual seasonal SKU. | growth | 8 | 8 | 5 |
| 16 | Employer sponsorship portal for HR teams | Multi-seat dashboard letting an employer kick off, track, and pay for visa petitions across many employees. | growth | 8 | 9 | 4 |
| 17 | University international-student office partnerships | White-label dashboard for OPT/STEM-OPT and O-1 transitions, marketed through DSOs at top STEM universities. | growth | 7 | 8 | 4 |
| 18 | Lawyer-referral B2B2C marketplace | Allow independent immigration attorneys to plug into the platform, get matched to qualified leads, and use Meridian as their drafting OS. | growth | 8 | 9 | 6 |
| 19 | Premium attorney-supervised tier at $4,500 | Higher-touch SKU with named partner review, mock interview, and post-filing concierge for high-risk profiles. | monetization | 3 | 8 | 2 |
| 20 | Document OCR + structured extraction pipeline | Run Document AI on every upload, extract entities (dates, employers, salaries), and pre-populate forms and the case file. | automation | 6 | 9 | 3 |
| 21 | Renewal/extension reminder engine | Track each beneficiary's status expiration and trigger guided renewal flows 180/120/60 days out. | retention | 3 | 8 | 2 |
| 22 | Family-tree document reuse across derivatives | Reuse the principal's evidence and biographic data for O-3 dependents and downstream petitions to cut intake by 70%. | retention | 5 | 7 | 3 |
| 23 | AILA member discount + integration | Co-marketing with the American Immigration Lawyers Association including a sponsor tier and SSO for AILA members. | integration | 4 | 7 | 3 |
| 24 | CLINIC accreditation pathway for non-profits | Compliance + workflow mode that lets BIA-accredited representatives at CLINIC affiliates serve low-income clients on platform. | compliance | 6 | 7 | 5 |
| 25 | Form auto-fill across I-129, I-130, I-485, I-765, I-131 | One canonical case schema that auto-renders any current USCIS form PDF with field-level validation and lock-on-file. | functionality | 8 | 10 | 4 |
| 26 | ETA-9089 PERM labor certification module | Step-by-step PERM workflow including prevailing wage, recruitment, and DOL submission packaging for employment-based GC. | functionality | 9 | 8 | 6 |
| 27 | Multi-language interview prep simulator | Live AI mock consular/USCIS interview in 15+ languages with scored feedback and red-flag warnings. | automation | 6 | 8 | 5 |
| 28 | Country-conditions research for asylum cases | Auto-compile country-conditions packets from State Department, HRW, and Amnesty sources with citations. | automation | 7 | 8 | 7 |
| 29 | Certified translation marketplace integration | Built-in routing of foreign documents to certified translators with SLA, price, and chain-of-custody tracking. | integration | 5 | 7 | 3 |
| 30 | UPL safeguard layer (non-attorney boundaries) | Hard guardrails preventing legal advice in AI outputs to non-attorney users, with required attorney review checkpoints. | compliance | 5 | 10 | 3 |
| 31 | Privilege log + attorney work-product tagging | Tag every document and AI output for privilege and produce a defensible privilege log on demand. | compliance | 5 | 7 | 3 |
| 32 | Document retention and deletion schedule | Configurable retention policies per case type with cryptographic deletion proofs aligned to state bar rules. | compliance | 4 | 6 | 2 |
| 33 | GDPR-compliant EU resident data handling | Regional data residency, DSAR tooling, and DPA templates so European applicants can lawfully use the product. | compliance | 6 | 7 | 4 |
| 34 | Biometrics appointment scheduling assistant | Detect ASC appointment notices, surface earliest available slots, and one-click reschedule when conflicts arise. | automation | 5 | 6 | 3 |
| 35 | Court e-filing for immigration court matters | EOIR ECAS-compatible e-filing for removal defense and motion practice, gated to attorneys on the platform. | integration | 8 | 7 | 7 |
| 36 | Paralegal collaboration workspace | Multi-role workspace with task assignment, draft handoff, and an audit trail so paralegals can offload attorney work. | operational | 6 | 7 | 3 |
| 37 | Attorney review queue with SLA timers | Single inbox showing every draft awaiting attorney review, sorted by filing deadline with SLA breach alerts. | operational | 5 | 8 | 2 |
| 38 | Per-case-type document checklists | Dynamic checklist driven by visa category and beneficiary profile, blocking submission until required items are present. | functionality | 4 | 7 | 2 |
| 39 | USCIS fee calculator with current schedule | Always-current fee table including premium processing and biometrics, embedded in checkout to prevent surprises. | ux | 3 | 6 | 2 |
| 40 | Premium processing eligibility advisor | Recommend when to upgrade to I-907 premium processing based on deadlines, employer needs, and current PP windows. | ux | 3 | 6 | 2 |
| 41 | Citation linter for petition exhibits | Verify every claim in the petition draft maps to an exhibit reference, flagging unsupported or orphaned citations. | automation | 5 | 8 | 3 |
| 42 | Press article verifier with archive snapshots | Wayback Machine + archive.today snapshots for every press exhibit to guarantee link rot doesn't break the filing. | automation | 4 | 6 | 2 |
| 43 | Citation-count enrichment from Google Scholar/Semantic Scholar | Auto-pull citation counts and h-index for scholarly criterion, with snapshot date for the record. | automation | 4 | 7 | 3 |
| 44 | Patent registry enrichment (USPTO/EPO) | Pull patent assignments, citations forward, and family members to strengthen the original-contribution criterion. | automation | 5 | 7 | 3 |
| 45 | High-remuneration benchmarks (BLS + Levels.fyi) | Build a defensible salary benchmark per role/region so the high-remuneration criterion comes with a methodology page. | automation | 5 | 7 | 3 |
| 46 | Concierge dashboard for ops team | Internal cockpit showing every active case's blockers, owner, and ETA filed; the single screen ops runs on. | operational | 5 | 8 | 2 |
| 47 | Applicant mobile app for evidence capture | Native mobile capture for diplomas, contracts, and press, with on-device OCR and direct upload to the case vault. | ux | 7 | 7 | 3 |
| 48 | WhatsApp case-update channel | Two-way WhatsApp notifications and document upload for international applicants who don't check email. | ux | 5 | 8 | 3 |
| 49 | Annual subscription for serial founders/firms | Flat annual SKU bundling unlimited extensions, EB-1A, and dependents — sold to repeat customers and small firms. | monetization | 3 | 8 | 2 |
| 50 | Refer-a-friend with shared discount | Two-sided referral giving both parties $250 off, tracked via UTM + Stripe coupon and capped to prevent abuse. | growth | 3 | 7 | 2 |
| 51 | Founder community (Slack/Discord) with attorney AMAs | Gated community for paying customers featuring monthly attorney AMAs and immigration policy briefings. | retention | 3 | 6 | 2 |
| 52 | Public approval-rate transparency page | Quarterly published approval, RFE, and denial rates by visa category to differentiate from black-box competitors. | growth | 3 | 7 | 4 |
| 53 | Case timeline predictor with USCIS historicals | Predict time-to-decision per service center using public processing time data + the platform's own filing dataset. | functionality | 5 | 7 | 3 |
| 54 | Denial post-mortem generator | When a denial arrives, auto-draft a structured post-mortem and a motion-to-reopen viability assessment. | automation | 5 | 7 | 5 |
| 55 | Motion to reopen / reconsider drafting | Specialized workflow to draft I-290B motions with case law citations and a fresh evidence delta. | automation | 6 | 7 | 6 |
| 56 | EB-2 NIW companion module | National Interest Waiver workflow with the Dhanasar three-prong framework and evidence templates. | functionality | 7 | 8 | 5 |
| 57 | Consular processing (DS-260 / DS-160) helper | Guided DS-260 / DS-160 completion with embassy-specific document checklists and interview prep. | functionality | 6 | 7 | 4 |
| 58 | AC21 portability advisor for H-1B/EB | Detect when an applicant qualifies for AC21 job portability and auto-draft the supplement-J notification. | automation | 5 | 6 | 4 |
| 59 | Travel advisory engine while case pending | Per-case travel advisory tracking advance parole, visa stamping risk, and country-of-origin re-entry implications. | retention | 5 | 7 | 4 |
| 60 | Advance parole (I-131) one-click filing | Once an I-485 is on file, generate I-131 advance parole automatically with biometrics reuse. | functionality | 4 | 7 | 3 |
| 61 | EAD (I-765) auto-bundle with I-485 | Default-on EAD bundling with adjustment of status filings, including category-code selection logic. | functionality | 4 | 7 | 3 |
| 62 | Public-charge analysis for adjustment cases | Pre-screen I-485 cases against the current public-charge rule and flag risk factors before filing. | compliance | 5 | 6 | 5 |
| 63 | I-944 / affidavit-of-support orchestrator | Walk sponsors through I-864 affidavit-of-support with tax-transcript pull from IRS and joint-sponsor matching. | automation | 6 | 7 | 4 |
| 64 | Form versioning watchdog | Daily diff of every USCIS / DOL form PDF; auto-quarantine drafts using deprecated editions. | operational | 4 | 8 | 3 |
| 65 | Policy-manual change feed for attorneys | Diff the USCIS Policy Manual and AAO precedent decisions, summarize impact, and notify affected cases. | automation | 6 | 7 | 4 |
| 66 | AAO precedent retrieval-augmented search | Search non-precedent AAO decisions semantically and cite analogous fact patterns inside the petition draft. | automation | 6 | 7 | 4 |
| 67 | Tax-transcript pull via IRS Get-Transcript API | Pull sponsor and beneficiary IRS transcripts directly with consent to satisfy I-864 and EB-5 requirements. | integration | 5 | 6 | 4 |
| 68 | I-9 / E-Verify employer companion | Adjacent SKU for employers handling I-9 and E-Verify with the same vault and audit infra. | growth | 6 | 7 | 4 |
| 69 | Naturalization (N-400) civics tutor | Adaptive civics-test tutor with USCIS-published questions, scoring, and accent-friendly oral practice. | functionality | 4 | 6 | 2 |
| 70 | DACA renewal assembly line | Annual workflow targeting DACA renewals with pre-fill from prior filings and reminder cadences. | retention | 4 | 6 | 4 |
| 71 | TPS designation tracker by country | Track Temporary Protected Status designations and auto-open registration windows for eligible users. | automation | 4 | 5 | 3 |
| 72 | Asylum I-589 narrative builder | Trauma-informed I-589 narrative builder with country-conditions linking and one-year-bar analyzer. | functionality | 8 | 8 | 8 |
| 73 | U-visa / VAWA self-petition support | Sensitive-data workflow for U-visa certifications and VAWA self-petitions with vetted advocate review. | functionality | 7 | 7 | 7 |
| 74 | L-1 intracompany transferee workflow | Multinational L-1A/L-1B drafting with org-chart import and one-year-abroad evidence aggregation. | functionality | 6 | 7 | 4 |
| 75 | E-2 treaty investor business plan generator | Generate the E-2 business plan, source-of-funds tracing, and treaty-country eligibility analysis. | automation | 6 | 7 | 5 |
| 76 | TN visa quick-turn for Canadian/Mexican pros | 48-hour TN packaging optimized for the USMCA professional list with port-of-entry presentation kit. | functionality | 4 | 6 | 3 |
| 77 | Green-card timing optimizer (priority-date dashboard) | Visa-bulletin-aware dashboard showing each beneficiary's priority date, retrogression risk, and filing window. | functionality | 5 | 7 | 3 |
| 78 | EB-5 investor source-of-funds tracer | Document-chain tracer satisfying lawful-source-of-funds requirements for EB-5 with FX rate snapshots. | automation | 7 | 7 | 6 |
| 79 | Sponsor employer compliance audit pack | Generate the public-access file for H-1B/LCA compliance audits in one click for sponsoring employers. | compliance | 4 | 6 | 3 |
| 80 | Site-of-employment maps for H-1B amendments | Detect material-change worksite events and auto-trigger H-1B amendment drafts. | automation | 4 | 6 | 3 |
| 81 | Prevailing-wage determination automation | Pull OFLC prevailing wage levels by SOC code and worksite, with appeal-readiness scoring. | automation | 5 | 6 | 4 |
| 82 | PERM recruitment ad placement workflow | Coordinate the SWA and Sunday-newspaper recruitment ads with evidence preservation and audit-file assembly. | operational | 6 | 6 | 4 |
| 83 | Conditional-permanent-resident I-751 reminder | Two-year reminder cadence and joint-petition I-751 drafting with bona-fide-marriage evidence packs. | retention | 4 | 6 | 3 |
| 84 | Cap-gap and STEM-OPT timeline assistant | Auto-detect students hitting cap-gap or STEM-OPT extension windows and surface the filing checklist. | automation | 4 | 6 | 3 |
| 85 | Embedded checkout for attorney partners | White-label checkout widget partners drop on their site so they take payment under their brand. | growth | 5 | 7 | 3 |
| 86 | API for HR systems (Rippling, Deel, Gusto) | Publish a partner API so HRIS vendors can kick off visa cases for new hires without leaving their tool. | integration | 7 | 8 | 4 |
| 87 | Lever/Greenhouse ATS integration | Sync new hires marked as visa-required from major ATS platforms directly into the case pipeline. | integration | 5 | 7 | 3 |
| 88 | Concierge SOC2 Type II + HIPAA-aligned posture | Achieve SOC2 Type II and HIPAA-aligned controls to unlock enterprise and health-system employer deals. | compliance | 7 | 8 | 3 |
| 89 | Bias and hallucination eval suite for petition AI | Continuously run an eval set of 100+ historical petitions to catch fabricated citations and drift. | compliance | 6 | 8 | 4 |
| 90 | Attorney-of-record routing across states | Auto-route cases to the appropriate state-bar-licensed attorney based on jurisdictional rules and conflicts. | operational | 6 | 7 | 5 |
| 91 | Conflicts-of-interest checker | Run conflict checks across all prior cases and corporate sponsors before opening a new matter. | compliance | 4 | 6 | 3 |
| 92 | Trust accounting (IOLTA) for retainer flows | Track filing fees held in trust separately from earned fees with monthly reconciliation reports for the bar. | compliance | 6 | 6 | 4 |
| 93 | Multi-currency pricing for international applicants | Show pricing in the applicant's local currency via Stripe FX with country-specific PSP fallbacks (e.g., UPI, Pix). | monetization | 4 | 7 | 3 |
| 94 | Pay-as-you-go evidence-review tokens | Sell granular tokens for one-off attorney spot reviews to applicants doing pro-se petitions. | monetization | 4 | 6 | 3 |
| 95 | Outcome-tracking and alumni network | Track post-approval career outcomes (funding raised, papers published) and showcase as proof points. | retention | 4 | 6 | 2 |
| 96 | Petition style-guide enforcer | Lint petition drafts against a configurable house style (passive voice limits, citation format, exhibit naming). | operational | 4 | 6 | 2 |
| 97 | Multilingual UI with right-to-left support | Localize the applicant UI in Spanish, Hindi, Mandarin, Portuguese, and Arabic with proper RTL handling. | ux | 5 | 7 | 3 |
| 98 | Voice-of-customer recorder for ops training | Optional call recording with consent and PII redaction, used to improve drafts and ops onboarding. | operational | 4 | 5 | 4 |
| 99 | Petition export to Microsoft Word with track changes | Round-trip the petition to .docx with comments and track changes preserved for attorneys who live in Word. | integration | 4 | 7 | 2 |
| 100 | Slack app for attorney inbox + approvals | Attorneys triage their review queue and approve drafts inside Slack with one-tap signature pre-staging. | ux | 5 | 7 | 3 |

Note: the spec listed 8 categories (functionality, growth, monetization, retention, automation, compliance, integration, ux). Several ideas best fit an "operational" theme (internal ops, attorney workflow plumbing); they are tagged `operational` for clarity and a PM can re-map them on triage if desired.
