# Backlog  (☐ todo · ◐ in progress · ☑ done · ✕ cut by user decision)

Numbering is append-only and stable — never renumber (user decisions reference these numbers).

| # | S | Dim | Size | Item |
|---|---|-----|------|------|
| 1 | ☐ | 5-Billing | S | Client sends `Idempotency-Key` on every charged-op fetch (DraftStudio, RfeStudio, QualifyPanel, EvidenceVault, FieldGuidancePanel, RfeRiskRadar, critique) so the built server de-dupe engages; test pins it. Kills double-charge on retry/second-tab. |
| 2 | ☐ | 5-Billing | S | Reclaim tokens when a metered op serves the unconfigured-LLM mock (operation.ts step 5, getLlm()==null) — restore "a mock is never billed" invariant; unit test. |
| 3 | ☐ | 5-Billing | S | `/api/checkout` 503s when Store unconfigured; webhook 500s when a paid order credits 0 tokens — closes money-taken-no-tokens hole. |
| 4 | ☐ | 6-Sec | S | Hard-gate TOKENS_BYPASS to NODE_ENV!=="production"; add auth check on metered AI routes independent of metering free-pass. |
| 5 | ☐ | 2-Func | M | Filing honesty: attorneySignAndFile records DEMO receipt ("not actually filed") while landing/FAQ advertise real attorney filing w/ premium processing. Product decision: label in-product as pilot/demo OR change marketing copy. (CP decision) |
| 6 | ☐ | 2-Func | S | Dead dashboard masthead buttons "Open petition letter" + "Voice intake transcript" (CaseFileDashboard.tsx:76-77) — wire or remove; voice intake exists nowhere. |
| 7 | ☐ | 2-Func | S | Enterprise CTA defaults to mailto:sales@example.com (economy.ts:98) — set real contact or hide the band until configured. |
| 8 | ☐ | 5-Billing | M | Save-failure parity: RFE + categorize keep the charge but lose the artifact on persist-fail (drafts have free rescue) — add rescue route or auto-reclaim on saveFailed. |
| 9 | ☐ | 3-Tests | M | Unit tests for chargeForOperation guard matrix: bypass / no-store / no-auth-provider / unauth 401 / insufficient / charge+reclaim. |
| 10 | ☐ | 3-Tests | L | Ledger tests against the real PGlite store: debit idempotency by ref, insufficient-balance refusal, credit idempotency by (reason,ref), signup-grant-once, clawback floor-at-0, balance_after correctness. |
| 11 | ☐ | 3-Tests | M | Polar webhook route tests: bad signature 403, order.paid credits bundle, replay idempotent, refund proportional clawback, unresolvable paid order → 500 (retry). |
| 12 | ☐ | 4-UAT | L | UAT harness: production build (`next build`+`start`) + PGlite + dev-auth + metering ON; first journey signup-grant → qualify → draft asserting exact debits (A2), tagged @uat. |
| 13 | ☐ | 4-UAT | M | Paywall + purchase journey (A3): zero balance → charged op blocked, no debit, CTA works → simulated order.paid webhook credits → op succeeds. |
| 14 | ☐ | 4-UAT | M | Journeys: evidence vault (categorize/refile/delete), RFE studio, case tracking, account export/delete, onboarding consent. |
| 15 | ☐ | 8-Ops | M | Deploy config for chosen target: Dockerfile + output:"standalone" (Cloud Run) or vercel.json; maxDuration on LLM routes; firebase.json so firestore.rules/indexes are deployable. |
| 16 | ☐ | 8-Ops | S | /api/health endpoint: store driver, LLM engine, Polar config status (booleans, no secrets). |
| 17 | ☐ | 7-UX | S | Root not-found.tsx + error.tsx + global-error.tsx, PageFrame-branded (3 live notFound() paths incl. public /c/[token] share links). |
| 18 | ☐ | 8-Ops | S | Env docs sync: document OPS_EMAILS, ATTORNEY_NOTIFY_WEBHOOK_URL/TOKEN, RATE_LIMIT_DISABLED, TRUSTED_PROXY_HOPS, DB_DRIVER, FIRESTORE_PROJECT_ID, PGLITE_PATH; add NEXT_PUBLIC_SITE_URL to .env.example; remove dead DATABASE_URL/NEXT_PUBLIC_APP_URL/Stripe/DocuSign/Vapi rows or mark aspirational. |
| 19 | ☐ | 7-UX | M | SiteHeader responsive: nav overflows at 375px (no breakpoints/menu) — wraps entire marketing+billing funnel. |
| 20 | ☐ | 7-UX | S | Login error → danger token + role="alert"; LocalThemeToggle missing focus-ring; logo alt text "Immigration Concierge". |
| 21 | ☐ | 2-Func | M | Dashboard home mock content (Dr. Anya Krishnan masthead, criteria, tasks from fixtures): label clearly as sample OR replace with real-case data; also dedupe "Your cases" vs CaseList double render. (CP decision) |
| 22 | ☐ | 5-Billing | S | Derive hardcoded UI token costs from costOf() (DraftStudio.tsx:449 "Uses 12 tokens", EvidenceVault.tsx:279); make costOf throw on unknown op instead of defaulting to 1. |
| 23 | ☐ | 6-Sec | S | HMAC-sign /c/[token] snapshots — currently anyone can forge a named certificate with OG unfurl. |
| 24 | ☐ | 8-Ops | M | Error visibility: root client boundary reports to a server endpoint; structured server error logging; wire the un-wired audit sink seam. |
| 25 | ☐ | 6-Sec | S | categorize rate-limit keyed byUser (currently IP-only, evadable); document TRUSTED_PROXY_HOPS. |
| 26 | ☐ | 2-Func | S | robots.ts; cross-link /visa/* programmatic-SEO pages from footer or /qualify (currently sitemap-only orphans). |
| 27 | ☐ | 3-Tests | M | Tests for getUser session resolution (cookie/verify/dev-seed paths) + attorney sign/file transition actions (CAS, receipt validation). |
| 28 | ☐ | 7-UX | M | Screenshot sweep key pages at 375px + 1440px, review vs UX checklist, burn down ship-blockers (dimension-7 evidence). |
| 29 | ☐ | 8-Ops | S | Repo hygiene: fix `.claude/CLAUDE.md` stale `test:e2e` → `e2e`; untrack committed run artifacts (check_runs*.json, playwright-report/, test-results/, scripts/llm-eval/out/). |
| 30 | ☐ | 6-Sec | L | Shared rate-limit store (Redis/Firestore) for multi-instance prod — in-memory caps multiply per instance. Defer unless target is multi-instance. |
