# env.md — reproducible start state + fixtures (the per-app file)

How to reach a known, reproducible state for **L2** (live browser). L1 needs none of this — it
reads code only. Per-app values here; the driver mechanics are universal (see `driver/`).

## Stack

- **Framework:** Next.js 16 (App Router) · React 19 · TypeScript 6 (strict)
- **UI language:** English (en-US)
- **Persistence:** **PGlite** (embedded Postgres, zero-infra) at `./.pglite` — already wired.
- **Auth:** **dev-auth** synthetic user — no login screen, no cloud. Visiting any authed route
  (`/dashboard`, `/dashboard/cases/[id]`, `/dashboard/review`) just works as
  `developer@localhost` (`DEV_USER`, id `00000000-0000-4000-8000-000000000001`).
- **LLM engine:** **real Claude via the local CLI** (`LLM_ENGINE=claude`, `claude -p
  --output-format text --model sonnet`). Uses the local subscription — no API key, no
  per-token billing. This is what makes L2's senior-quality judgement meaningful (vs the
  deterministic mock). Local-only (Cloud Run has no interactive login); does **not** do images.

## Required `.env.local` (already set — verify before driving)

```
NEXT_PUBLIC_DEV_AUTH=1        # synthetic dev user + selects pglite
DB_DRIVER=pglite             # explicit (overrides the auto-pick)
PGLITE_PATH=./.pglite        # local store
LLM_ENGINE=claude            # real AI via CLI  ← the key UAT switch
CLAUDE_CLI_PATH=claude       # binary on PATH (verified: v2.1.183)
CLAUDE_CLI_MODEL=sonnet      # sonnet | haiku | opus
# Optional for unmetered click-through (see Token economy below):
# TOKENS_BYPASS=1
```

Verify the engine before a run: `printf 'Reply with exactly: PONG' | claude -p --output-format text --model sonnet` → `PONG`.

## Run recipe

```
npm run dev            # Next dev server → http://localhost:3000  (NEXT_PUBLIC_APP_URL)
```

- **Base URL:** `http://localhost:3000`. (The Playwright e2e suite uses port **3003** with its
  own keyless+bypass webServer — don't confuse it with the UAT dev server.)
- **Server lifecycle:** reuse an already-running dev server; else start it in the background and
  poll for `200` before driving. If it wedges (hang / `ECONNREFUSED` / stale bundler cache,
  often after a `git checkout` swapped files under it): kill the port, delete `.next`, restart,
  re-poll.
- **AI latency budget:** real Claude via the CLI takes ~**15–130 s** per AI op (a full petition
  draft is "long" and the slowest). Budget for it; an early client-timeout is itself a finding,
  not an excuse to abort.

## Token economy (two modes — pick per journey)

The dev user gets a **one-time `FREE_SIGNUP_GRANT` of 150 tokens**, then AI is metered
(`qualify`=3, `draft`=12, `draft_section`/`rfe`=5, `categorize`=1, `guidance`=light). 150 tokens
is only a handful of full drafts.

- **Real-economy mode (default):** leave `TOKENS_BYPASS` unset. Authentic — required to test the
  **paywall / "out of tokens"** journey and the billing CTA. Top-ups need Polar, but you can mint
  dev tokens: `POST /api/dev/grant-tokens {amount}` — **only reachable when `TOKENS_BYPASS=1`**,
  so to actually use it you're already in bypass mode.
- **Unmetered mode:** set `TOKENS_BYPASS=1` → every AI feature free-passes, so you can click
  through all drafting/evidence/RFE journeys without depleting the grant. Use this for the
  *quality*-focused journeys; switch it off to test the *economy* itself.

## Fixtures (preflight before driving — a Character with no fixture is untestable, not passing)

There is **no seed script**; fixtures are produced through the real UI flow, which is itself the
happy path several journeys walk. Create them once per run:

| Fixture | How to create | Needed by |
|---|---|---|
| **A real case (status Drafting)** | `/qualify` → pick a visa (O-1A) → paste a background → submit → "Open case file" | J2 draft, J3 evidence, J7 track |
| **A case in Attorney Review** | on the case detail, `ReviewPanel` → "Submit for review" | J4 attorney review |
| **A Filed case** | in the review queue / panel, attorney "Sign & file" (enter a receipt #) | J5 RFE, J7 |
| **A share token** | `/qualify` positive result → the "Letters Patent" share affordance → `/c/[token]` (token encodes the result; no DB) | J8 share |
| **Attorney actions unlocked** | set `ATTORNEY_EMAILS=developer@localhost` — the review **queue** + sign/file actions gate on `isConfiguredAttorney` (**fail-closed**: empty list denies everyone, `roles.ts:40`); `isAttorney`'s demo-unlock only covers own-case UI affordances, not the queue. **L1 caught this** (the prior "leave it empty" premise was wrong). | J4, J5 |
| **Tokens to spend** | `TOKENS_BYPASS=1` (unmetered) **or** rely on the 150 grant for a few ops | all AI journeys |

> Lifecycle the fixtures exercise: Intake/Drafting → submit → **Attorney Review** → (request
> changes ↺ Drafting | sign & file → **Filed**) → record decision → **Approved**. Walking J1→J4
> in order naturally produces every status.

## Driver quickstart (L2)

From repo root (Git Bash, so the leading-slash route isn't mangled):

```
# Static surface: navigate → screenshot + ARIA + text (+ optional one click)
MSYS_NO_PATHCONV=1 BASE_URL=http://localhost:3000 SHOT_DIR=uat/runs/<id>/shots \
  node uat/driver/drive.mjs /qualify qualify-landing

# AI surface: fill inputs → click generate → poll until the model result settles,
# optionally asserting the output echoes a supplied real entity (the grounding check)
MSYS_NO_PATHCONV=1 BASE_URL=http://localhost:3000 SHOT_DIR=uat/runs/<id>/shots \
  node uat/driver/drive-ai.mjs /qualify qualify-run --expect "<a real name/term you fed in>"
```

Gotchas (all bit the pilot): use `MSYS_NO_PATHCONV=1`; `locator.ariaSnapshot()` (not the removed
`page.accessibility.snapshot()`); don't wait on `networkidle` (HMR socket never idles) — use
`domcontentloaded` + a short settle; selectors must be role/language-aware.
