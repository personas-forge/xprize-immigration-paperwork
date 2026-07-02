# Ship Loop — state

## Context refresher  <!-- keep ≤15 lines, updated after EVERY item -->
- App: immigration-concierge — O-1A qualification→drafting funnel w/ token billing (Polar) + attorney review. Stack: Next.js 16 App Router + Store(Firestore/PGlite) + Firebase auth; profile `stack-xprice.md` applied.
- Ship bar: public launch w/ real payments. Cadence: MARATHON (CP only when blocked or every 4th milestone). UAT depth: all journeys + edge cases.
- Scorecard: 1.Build 🟢 2.Func 🔴 3.Tests 🟡 4.UAT 🔴 5.Billing 🔴 6.Sec 🟡 7.UX 🟡 8.Ops 🔴
- Branch: ship-loop/readiness-2026-07-02 (main is release-automation-managed; never work on main).
- Milestone 1 "UAT harness" ☑ COMPLETE (items 12,13,14) + Gate M1 all green (2026-07-02): typecheck✓ lint✓ tests 477✓ build✓ uat 18/18✓ billing A2/A3✓.
- UAT: `npm run uat` (18/18, ~80s). Fake claude CLI e2e/uat/fake-claude.mjs; ordered chain uat-01 signup/qualify/draft, uat-02 billing, uat-03 case lifecycle.
- Milestone 2 "Money correctness" ☑ COMPLETE (items 1,2,3,4,9,22) + Gate M2 green (2026-07-02): typecheck✓ lint✓ tests 492✓ build✓ uat 20/20✓ (incl. uat-04: lost-response retry = 2 server runs, ONE debit).
- Milestone 3 "Ops & honest surfaces" ☑ COMPLETE (6,7,16,17,18,29) + Gate M3 green: typecheck✓ lint✓ 492✓ build✓ uat 20/20✓; /api/health + branded 404 verified live.
- Milestone 4 ☑ COMPLETE (19,20,25,26,31,32; 23 resized S→M and deferred to CP1) + Gate M4 green: typecheck✓ lint✓ 492✓ build✓ uat 24/24✓ smoke:prod 6/6✓.
- Scorecard now: 1🟢 2🔴(awaits #5/#21 decisions) 3🟡 4🟡 5🟡 6🟡 7🟡 8🔴(awaits #15 deploy).
- Milestone 5 "Ship-blockers" ☑ COMPLETE (5,21,15,24; commit 73e7f0b) + Gate M5 green: typecheck✓ lint✓ 492✓ build✓ smoke 6/6✓ uat 24/24✓.
- Scorecard: NO 🔴 LEFT — 1🟢 2🟡 3🟡 4🟡 5🟡 6🟡 7🟡 8🟡. CP2 due when blocked or after M8.
- Milestone 6 "Test depth + polish": 10 ☐ + 27 ☐ (delegated to agent: PGlite ledger tests, session/review-action tests), 8 ☐ (RFE/categorize save-fail rescue parity — me), 28 ☐ (screenshot sweep), 11 deprioritized (webhook behaviors already UAT-pinned e2e; unit seam would need injection refactor).
- NEXT ACTION: launch test-depth agent (items 10+27), then implement item 8 (extend /api/draft/save-style rescue or auto-reclaim on saveFailed for RFE + categorize).

## Scorecard
| # | Dimension | Score | Evidence (cmd → result, date) | Top gaps |
|---|-----------|-------|-------------------------------|----------|
| 1 | Build & types | 🟢 | `npm run typecheck` exit 0; `npm run lint` exit 0; `npm test` 465/465 pass 0 skip; `npm run build` exit 0 (all 2026-07-02) | none |
| 2 | Functional completeness | 🔴 | Route audit (agent, 2026-07-02): 15 pages + 18 API routes inventoried | E-sign/USCIS filing is a recorded STUB while landing/FAQ advertise real filing; dead dashboard buttons (Open petition letter / Voice intake); dashboard masthead+criteria+tasks are mock fixtures; Enterprise CTA = sales@example.com; no robots.ts |
| 3 | Tests | 🟡 | `npm test` 477/477 green (2026-07-02, gate M1); +12 (pickCents, relay-revenue camel payloads) | Still untested: firestore-store, pglite-store ledger ops, tokens/guard, webhook route handler, review sign/file actions, auth/session |
| 4 | Simulated UAT | 🟡 | `npm run uat` 18/18 green (2026-07-02, gate M1): signup grant, qualify/draft/categorize/guidance/rfe debits, failure-reclaim, paywall, purchase webhook, refund, vault, tracking, attorney filing, RFE studio, account | Runs on dev server not prod build (dev-auth prod-gated — permanent deviation); hostile/edge persona partial (no logged-out probing, oversized inputs, back-button journeys); best-path/section/critique ops lack individual journeys |
| 5 | Billing value | 🟡 | Gate M2 (2026-07-02): uat 20/20 — A2 exact debits + failure-reclaim, A3 paywall/purchase/refund, uat-04 lost-response retry debits ONCE; items 1,2,3,4,22 fixed + guard matrix (485→492 tests) | OPEN: RFE/categorize save-fail keeps charge w/o rescue (item 8, UI warns honestly); live Polar sandbox checkout/webhook unverified (A3.3 🟡 note); costOf unknown-op light-tier fallback kept deliberately |
| 6 | Auth & security | 🟡 | Security audit (agent, 2026-07-02): deny-all Firestore rules match admin-only design; no store bypasses; no secrets in repo; webhook signature-verified | TOKENS_BYPASS not hard-gated to non-prod (kills auth on inline AI paths); auth coupled to metering; unsigned forgeable /c/[token] cert; in-memory rate limiter (multi-instance); no unauthenticated-probe evidence yet |
| 7 | UX/UI polish | 🟡 | UI audit (agent, 2026-07-02): feature components have loading/error/paywall/empty states + double-submit guards | No not-found.tsx / global-error.tsx anywhere (3 real notFound() paths incl. public share links); SiteHeader overflows at 375px (no mobile menu); dead masthead buttons; login error not role="alert"; no screenshot-sweep evidence yet |
| 8 | Ops readiness | 🔴 | Ops audit (agent, 2026-07-02) | NO deploy config (no Dockerfile/vercel.json/firebase.json; rules undeployable); no error reporting; no health endpoint; LLM routes lack maxDuration; 8 undocumented env vars + dead documented ones (DATABASE_URL, NEXT_PUBLIC_APP_URL); CLAUDE.md stale `test:e2e` ref |

## Price table  <!-- from billing audit; billing-and-uat.md A1 -->
| Op | Price | Code path | Promised value | A2 assertions |
|----|-------|-----------|----------------|---------------|
| categorize | 1 | api/evidence/categorize/route.ts:44 | Doc classified into O-1A criterion + facts, persisted to vault w/ exhibit no. | pending |
| guidance | 1 | api/guidance/route.ts:39 | 3–6 sentence USCIS form-field guidance + disclaimer | pending |
| qualify | 3 | api/qualify/route.ts:35 | Scored criteria + likelihood + gaps; creates case | pending |
| qualify (best-path) | 3 | api/qualify/best-path/route.ts:25 | All live programs scored/ranked + recommendation | pending |
| draft_section | 5 | features/drafting/draftOperation.ts:92 (focus) | One regenerated section merged + persisted as new version | pending |
| draft_section (critique) | 5 | api/draft/critique/route.ts:15 | Per-section score + weakness + rewrite | pending |
| rfe | 5 | api/rfe/route.ts:47 | RFE response sections, persisted as version | pending |
| rfe (forecast) | 5 | api/rfe/forecast (forecastOperation.ts:46) | Ranked USCIS-challenge forecast | pending |
| draft | 12 | api/draft/route.ts:22 (no focus) | Full petition draft, persisted, advances Intake→Drafting | pending |

Free: /api/qualify/preview*, /api/draft/save (rescue). Grants: signup 150 (verified-email-gated). Bundles: starter 500/$5, builder 2000/$15, pro 8000/$48, scale 30000/$150, monthly 2500/$19.
Bypass flags: TOKENS_BYPASS=1 (metering off), RATE_LIMIT_DISABLED=1, NEXT_PUBLIC_DEV_AUTH=1 (non-prod hard-gated), /api/dev/grant-tokens (non-prod+no-Firestore+bypass only).

## Current milestone
Milestone 1 — "UAT harness" — items: 12, 13, 14 (+ Verification Gate)
Gate results (this milestone): typecheck – / lint – / tests – / build – / uat – / billing –
Boot baseline (2026-07-02): typecheck ✓ / lint ✓ / tests ✓ 465 / build ✓ / uat – / billing –

## Checkpoint history
- CP0 (boot, 2026-07-02): bar=public launch, cadence=marathon, focus=UAT harness (12–14), UAT depth=all+edge. Next CP: when blocked or after Milestone 4.
