# Ship Loop — state

## Context refresher  <!-- keep ≤15 lines, updated after EVERY item -->
- App: immigration-concierge — O-1A qualification→drafting funnel w/ token billing (Polar) + attorney review. Stack: Next.js 16 App Router + Store(Firestore/PGlite) + Firebase auth; profile `stack-xprice.md` applied.
- Ship bar: public launch w/ real payments. Cadence: MARATHON (CP only when blocked or every 4th milestone). UAT depth: all journeys + edge cases.
- Scorecard: 1.Build 🟢 2.Func 🔴 3.Tests 🟡 4.UAT 🔴 5.Billing 🔴 6.Sec 🟡 7.UX 🟡 8.Ops 🔴
- Branch: ship-loop/readiness-2026-07-02 (main is release-automation-managed; never work on main).
- Milestone 1 "UAT harness": item 12 ☑, 13 ☑ (billing journey 8/8; fixed 2 prod webhook bugs — camelCase reads killed proportional clawback + revenue relay), 14 ◐ (vault/RFE/tracking/account journeys), then Verification Gate.
- UAT runs via `npm run uat` (12/12 green, 46s). Fake claude CLI at e2e/uat/fake-claude.mjs; ordered journey chain uat-01, uat-02, …
- NEXT ACTION: item 14 — journeys: evidence vault (categorize 1 token, refile, soft-delete), case tracking (roadmap/status), account (export JSON, marketing pref), attorney review (submit→sign/file stub→RFE studio). Then Phase 3 Verification Gate.

## Scorecard
| # | Dimension | Score | Evidence (cmd → result, date) | Top gaps |
|---|-----------|-------|-------------------------------|----------|
| 1 | Build & types | 🟢 | `npm run typecheck` exit 0; `npm run lint` exit 0; `npm test` 465/465 pass 0 skip; `npm run build` exit 0 (all 2026-07-02) | none |
| 2 | Functional completeness | 🔴 | Route audit (agent, 2026-07-02): 15 pages + 18 API routes inventoried | E-sign/USCIS filing is a recorded STUB while landing/FAQ advertise real filing; dead dashboard buttons (Open petition letter / Voice intake); dashboard masthead+criteria+tasks are mock fixtures; Enterprise CTA = sales@example.com; no robots.ts |
| 3 | Tests | 🟡 | `npm test` 465/465 green (2026-07-02); 58 test files | Highest blast-radius modules UNtested: firestore-store, pglite-store, tokens/guard, polar/webhook route, review sign/file actions, auth/session |
| 4 | Simulated UAT | 🔴 | e2e audit (agent, 2026-07-02): 3 specs | Only public keyless funnel, on `next dev` (not prod build), TOKENS_BYPASS=1, no DB/auth; zero journeys for auth, billing, vault, RFE, review, account |
| 5 | Billing value | 🔴 | Billing audit (agent, 2026-07-02); no A2/A3 machine evidence yet | Double-charge on real retry (server Idempotency-Key infra exists, NO client sends it); metered mock billed full price when LLM unconfigured (no reclaim); checkout w/o Store → money taken, 0 tokens minted, webhook 200; RFE/categorize charged-but-lost on save-fail (no rescue) |
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
