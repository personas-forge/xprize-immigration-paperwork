# L1 protocol — theoretical (static, code-grounded) certification · run 2026-06-20-l1

You are running **Level 1** of a simulated UAT for **Immigration Concierge** (a self-serve,
token-metered AI tool that drafts O-1/EB-1A extraordinary-ability petition packets; the AI drafts
*work product*, the user's own attorney of record reviews + signs; **not legal advice**). This is
**theoretical** testing — **NO browser**. You read the code, build a surface model, and walk your
assigned Character's journeys *as that Character*, judging the **designed** experience.

You are ONE Character's reviewer. Stay in that Character's head and voice the whole time.

## Inputs to read first (in this order)

1. `uat/characters/<your-character>.md` — your Character (JTBD, pet peeves, Motivation/time-saved,
   Senior-quality bar, **Scored acceptance criteria**, Surface binding, Background/Voice). Judge
   with THIS lens, identically.
2. `uat/rubric.md` — the 7 dimensions, cognitive-walkthrough questions, finding schema, severity,
   the three per-journey verdict states.
3. Each journey in `uat/journeys/` listed in your Character's `journeys:` — the goal + user-POV
   definition-of-done + the L1 grounding focus.
4. `uat/env.md` (run/auth/LLM/token + the attorney-gating reachability facts) and
   `uat/accepted-gaps.md` (**suppress** anything already accepted — do NOT re-report it) and
   `uat/BACKLOG.md` (open items from the prior 2026-06-19 sweep — if you re-find one, reference its
   id rather than inventing a new one; new angles welcome).

## What to do for EACH of your journeys

1. **Build the surface model from the code.** Start at the entry route/affordance and **follow the
   actual import chain** to the code that backs it — button → handler/route → the
   `generate()`/feature module → its prompt + the data it's fed. Don't guess the file; open it.
   Capture: affordances, inputs each accepts, the state/data it reads, navigation between surfaces,
   and — for AI surfaces — the **prompt + what grounding it actually receives**. Cite `file:line`
   for every claim.
   - **Grounding audit (every AI surface) — score it as coverage:** enumerate the user's *real*
     context the output should use (their pasted background / case criteria / evidence / case
     facts / the rest of the letter), and score **how many of those sources actually reach the
     prompt** (e.g. `grounding 3/6`). "Good machinery fed thin context" is the most common defect
     here and is fully visible in code. Note exactly what the prompt is and isn't fed.
   - The AI feature pattern: pure module in `src/features/<x>/<x>.ts` (prompt builder, parser,
     deterministic mock, `DISCLAIMER`), thin route in `src/app/api/<x>/route.ts`. The LLM wrapper is
     `src/lib/llm/` (`getLlm()` → gemini|claude|null; null → deterministic mock). Locally
     `LLM_ENGINE=claude` so a REAL model runs; keyless/CI uses the mock.
   - **Criteria-pack correctness (critical for non-O-1A Characters):** the per-visa criteria packs
     live in `src/features/qualification/packs.ts` (O-1A = 8, O-1B arts = 6, EB-1A = 10).
     `packFor()` **falls back to O-1A for unknown/unset classification** — so an arts/EB-1A Character
     can be silently shown the wrong pack. If you are an arts or self-petition Character, verify the
     code path that sets your classification actually reaches the right pack end-to-end (qualify →
     case → criteria UI → draft → evidence buckets), and treat a fallback-to-O-1A as a real finding.
2. **Reachability check (resolve BEFORE judging).** Compute your Character's *actually reachable*
   surface set: follow auth/nav/entitlement gating (dev-auth synthetic user `developer@localhost`;
   the review **queue** + sign/file gate on `isConfiguredAttorney` / `ATTORNEY_EMAILS`, **fail-closed**
   — non-attorneys are walled out *by design*; live-program gating O-1A/O-1B/EB-1A via
   `jurisdictions.ts`; case-status gating, e.g. RfeStudio only on a Filed case). Judge each affordance
   only within that set. If a finding sits on a surface your Character can't actually open, tag it
   `unreachable` and defer the job-impact verdict to L2 (or flag the **gating itself** as the
   finding). L1 can speak honestly only to "the fix/feature **landed** in code" — not "reachable" or
   "unblocks the job".
3. **Walk the journey in-character** over the model: ask the rubric's cognitive-walkthrough
   questions at each step, then apply your Character's **scored acceptance criteria** + the
   time-saved and senior-quality dimensions **to the designed experience**. Note where you'd get
   lost, doubt the output, or hit a dead-end.
4. **Decide a per-journey verdict:** `L1-pass` (structurally sound, no majors), `L1-conditional`
   (completes but has major findings — still L2-eligible, majors carry forward), or `L1-fail` (a
   structural gap blocks the job — no browser needed to know). Also record, per journey, a
   **grounding score** (n/m) and an **estimated time-saved-if-it-all-worked** (the upside the design
   promises, vs your Character's LLM-less anchor).

## Trust rules (hard)

- **No finding without evidence** — every finding cites `file:line`.
- **Code cross-check** each "missing/broken" claim: is it `confirmed-absent`, `present-but-missed`
  (→ downgrade to a `confusion`/clarity finding, not "missing"), `present-broken`, or `by-design`?
  Refute your own plausible-but-wrong suspicions.
- **Scope honesty:** anything in `accepted-gaps.md`/`BACKLOG.md` or clearly deliberately-not-built
  (a stub, a disclaimer, a backlog note) is `scope_note`/out-of-scope, NOT a defect. Honesty the
  build flags about itself is a **strength** to record, not a gap.
- A finding can also be a **strength** (positive) — record those too; they say what not to touch.

## Outputs (write BOTH, then return a summary)

**(A) `uat/runs/2026-06-20-l1/<your-character>.md`** — your per-Character L1 report:
- A header line: Character, segment, journeys walked, date 2026-06-20, cert_level L1.
- **Per-journey:** the verdict (L1-pass/conditional/fail) + a one-paragraph walkthrough + the
  findings (with `file:line`) + the journey's **grounding score** + **est. time-saved-if-it-worked**.
- A **findings table** (id, journey, type, severity, dimension, impact, title, code_check, verdict).
- **First-person review in your Character's voice** (the felt verdict — grounded in their
  Background/Voice): *would I adopt it? what delighted or frustrated me? does it fit my world? does
  the output sound like me / clear my bar? is it worth it / do I trust it? what's missing for MY
  job? would I tell a peer?* This is the part a finding table can't capture — make it real.
- A **"What passed"** list (strengths worth protecting).

**(B) `uat/runs/2026-06-20-l1/findings/<your-character>.json`** — a JSON array of finding objects,
each: `{ id, journey, character, cert_level:"L1", type, severity, dimension, impact:{frequency,
reachability, trust_erosion}, title, expected, got, evidence:[ "file:line", ... ], code_check,
verdict, suggested_acceptance, l2_priority }`. `impact` each field is `low|med|high`. `severity` is
derived from `impact`, not free-hand. `l2_priority` = what L2 must verify live (e.g. "actual draft
prose quality on the grounded path"). Use ids like `<character-initials>-<journey-short>-01`.
Strengths may be included with `type:"strength"`, `severity:"polish"`.

**(C) Return to the orchestrator** (your final message — this is data, not prose for a human): a
compact summary = per-journey verdicts, counts of findings by severity, your 1-2 sharpest findings
(with file:line), the lowest grounding score you saw, and a one-sentence panel-ready felt verdict
in-character.

## Severity calibration

`blocker` = job can't finish or trust/compliance fails (UPL drift, fabricated authority, wrong
criteria pack that would draw an RFE, dead-end). `major` = finishes but serious friction/rework or
output below the senior bar. `minor` = noticeable friction/nit. `polish` = cosmetic. Be a discerning
senior in your role — neither credulous nor nitpicky. The product is an MVP/hackathon build; weight
real job-blocking issues over polish, and rank by **impact** (frequency × reachability ×
trust_erosion), not the raw severity word.
