# Backlog  (☐ todo · ◐ in progress · ☑ done · ✕ cut by user decision)

Numbering is append-only and stable — never renumber (user decisions reference these numbers).

| # | S | Dim | Size | Item |
|---|---|-----|------|------|
| 1 | ☑ | 5-Billing | S | Client sends `Idempotency-Key` on every charged-op fetch (DraftStudio, RfeStudio, QualifyPanel, EvidenceVault, FieldGuidancePanel, RfeRiskRadar, critique) so the built server de-dupe engages; test pins it. Kills double-charge on retry/second-tab. |
| 2 | ☑ | 5-Billing | S | Reclaim tokens when a metered op serves the unconfigured-LLM mock (operation.ts step 5, getLlm()==null) — restore "a mock is never billed" invariant; unit test. |
| 3 | ☑ | 5-Billing | S | `/api/checkout` 503s when Store unconfigured; webhook 500s when a paid order credits 0 tokens — closes money-taken-no-tokens hole. |
| 4 | ☑ | 6-Sec | S | Hard-gate TOKENS_BYPASS to NODE_ENV!=="production"; add auth check on metered AI routes independent of metering free-pass. |
| 5 | ☑ | 2-Func | M | Filing honesty: attorneySignAndFile records DEMO receipt ("not actually filed") while landing/FAQ advertise real attorney filing w/ premium processing. Product decision: label in-product as pilot/demo OR change marketing copy. (CP decision) |
| 6 | ☑ | 2-Func | S | Dead dashboard masthead buttons "Open petition letter" + "Voice intake transcript" (CaseFileDashboard.tsx:76-77) — wire or remove; voice intake exists nowhere. |
| 7 | ☑ | 2-Func | S | Enterprise CTA defaults to mailto:sales@example.com (economy.ts:98) — set real contact or hide the band until configured. |
| 8 | ☑ | 5-Billing | M | Save-failure parity: RFE + categorize keep the charge but lose the artifact on persist-fail (drafts have free rescue) — add rescue route or auto-reclaim on saveFailed. |
| 9 | ☑ | 3-Tests | M | Unit tests for chargeForOperation guard matrix: bypass / no-store / no-auth-provider / unauth 401 / insufficient / charge+reclaim. |
| 10 | ☑ | 3-Tests | L | Ledger tests against the real PGlite store: debit idempotency by ref, insufficient-balance refusal, credit idempotency by (reason,ref), signup-grant-once, clawback floor-at-0, balance_after correctness. |
| 11 | ☑ | 3-Tests | M | Polar webhook route tests: bad signature 403, order.paid credits bundle, replay idempotent, refund proportional clawback, unresolvable paid order → 500 (retry). |
| 12 | ☑ | 4-UAT | L | UAT harness (npm run uat): PGlite + dev-auth + metering ON + deterministic fake claude CLI; journey signup-grant→qualify→draft w/ exact debits + failure-reclaim (A2.1-3). Dev server, not prod build (dev-auth is prod-hard-gated — deviation logged); found+fixed 2 dev-mode app bugs (stale cacheComponents auth pages; per-graph PGlite duplication). |
| 13 | ☑ | 4-UAT | M | Paywall + purchase journey (uat-02-billing, 8 tests): 402 no-debit, UI paywall CTA, signed order.paid credit + idempotent replay, unblock, proportional refund clawback, forged-sig 403, unmapped-product 500, checkout-503. Found+fixed 2 PROD webhook bugs (camelCase reads: full-bundle over-clawback on partial refunds; revenue relay dead for all paid orders) + unit tests. Live Polar checkout/webhook still unverified (sandbox) — 🟡 note stands. |
| 14 | ☑ | 4-UAT | M | uat-03 lifecycle journey (6 tests): vault categorize+refile+delete/undo, tracking, guidance, attorney draft→submit→queue→sign&file(demo)→Filed, RFE studio (5 tokens, saves), decision, account export/marketing/delete-phrase. |
| 15 | ☑ | 8-Ops | M | Deploy config for chosen target: Dockerfile + output:"standalone" (Cloud Run) or vercel.json; maxDuration on LLM routes; firebase.json so firestore.rules/indexes are deployable. |
| 16 | ☑ | 8-Ops | S | /api/health endpoint: store driver, LLM engine, Polar config status (booleans, no secrets). |
| 17 | ☑ | 7-UX | S | Root not-found.tsx + error.tsx + global-error.tsx, PageFrame-branded (3 live notFound() paths incl. public /c/[token] share links). |
| 18 | ☑ | 8-Ops | S | Env docs sync: document OPS_EMAILS, ATTORNEY_NOTIFY_WEBHOOK_URL/TOKEN, RATE_LIMIT_DISABLED, TRUSTED_PROXY_HOPS, DB_DRIVER, FIRESTORE_PROJECT_ID, PGLITE_PATH; add NEXT_PUBLIC_SITE_URL to .env.example; remove dead DATABASE_URL/NEXT_PUBLIC_APP_URL/Stripe/DocuSign/Vapi rows or mark aspirational. |
| 19 | ☑ | 7-UX | M | SiteHeader responsive: nav overflows at 375px (no breakpoints/menu) — wraps entire marketing+billing funnel. |
| 20 | ☑ | 7-UX | S | Login error → danger token + role="alert"; LocalThemeToggle missing focus-ring; logo alt text "Immigration Concierge". |
| 21 | ☑ | 2-Func | M | Dashboard home mock content (Dr. Anya Krishnan masthead, criteria, tasks from fixtures): label clearly as sample OR replace with real-case data; also dedupe "Your cases" vs CaseList double render. (CP decision) |
| 22 | ☑ | 5-Billing | S | Derive hardcoded UI token costs from costOf() (DraftStudio.tsx:449 "Uses 12 tokens", EvidenceVault.tsx:279); make costOf throw on unknown op instead of defaulting to 1. |
| 23 | ☐ | 6-Sec | M | HMAC-sign /c/[token] snapshots (forgeable named certificate w/ OG unfurl). RESIZED S→M: the token is encoded CLIENT-side (LettersPatentShare), so signing needs a server mint endpoint (free, rate-limited) + client + verify-on-page changes. CP1 decision: worth it now vs accept for v1. |
| 24 | ☑ | 8-Ops | M | Error visibility: root client boundary reports to a server endpoint; structured server error logging; wire the un-wired audit sink seam. |
| 25 | ☑ | 6-Sec | S | categorize rate-limit keyed byUser (currently IP-only, evadable); document TRUSTED_PROXY_HOPS. |
| 26 | ☑ | 2-Func | S | robots.ts; cross-link /visa/* programmatic-SEO pages from footer or /qualify (currently sitemap-only orphans). |
| 27 | ☑ | 3-Tests | M | Tests for getUser session resolution (cookie/verify/dev-seed paths) + attorney sign/file transition actions (CAS, receipt validation). |
| 28 | ☑ | 7-UX | M | Screenshot sweep key pages at 375px + 1440px, review vs UX checklist, burn down ship-blockers (dimension-7 evidence). |
| 29 | ☑ | 8-Ops | S | Repo hygiene: fix `.claude/CLAUDE.md` stale `test:e2e` → `e2e`; untrack committed run artifacts (check_runs*.json, playwright-report/, test-results/, scripts/llm-eval/out/). |
| 30 | ☑ | 6-Sec | L | Shared rate-limit store (Redis/Firestore) for multi-instance prod — in-memory caps multiply per instance. Defer unless target is multi-instance. |
| 31 | ☑ | 4-UAT | S | Prod-build smoke: `next build`+`start`, hit / + one API route + /api/health (pre-flight requirement; auth journeys stay on the dev-server harness). |
| 32 | ☑ | 4-UAT | M | Hostile/edge persona journeys (ship-blocking per CP0 UAT depth): logged-out probing of protected APIs/pages, oversized/invalid inputs, back-button mid-flow — expect graceful handling, never a charge. |
| 33 | ☑ | 7-UX | S | Landing fee-comparison bar chart renders empty at 375px (labels+axis only, no bars) — Recharts plot area collapses after long category labels. Polish (caption carries the meaning). |
| 34 | ☑ | 7-UX | S | Chapter numeral system inconsistent across pages (/qualify=§I, /billing=§IV, /faq=§IV, /validation=§VI) — duplicates break the one-document conceit. Polish. |
