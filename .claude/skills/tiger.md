---
name: tiger
description: Hunts the highest-value surface of an LLM-powered app — the model call sites — and drives them to their economic potential. v2 adds the three things that made v1 findings shallow: (1) COMPETITION-GROUNDED value — web-research the incumbent + direct competitors so each call site is judged against the real MARKET bar and price, not an abstract "senior"; (2) a QUANTIFIED value model (value-model.md) that converts every call site and every defect into dollars/hours, so the backlog is ranked by $-leaked not vibes; (3) a `drill` mode — an automated loop that iterates ONE top call site (measure delivered $ live → diagnose the highest-$ gap → improve → re-measure) until the value curve plateaus ("maxed out"). Still: code-quality (Lens 1) and model-optimization (Lens 3) lenses, real model calls, an Obsidian vault as durable memory. Stack-agnostic engine; per-app specifics live in the repo's `tiger/` overlay. Invoke `/tiger init|scan|run|drill|benchmark|recall|backlog [args]`.
---

# Tiger v2 — hunt the LLM value, priced in dollars

> In an LLM app the model calls are the apex surface: they cost the most, vary the most, carry the most
> business value. Tiger stalks exactly those. **v2 fixes v1's flaw — findings that were code-true but
> value-shallow** (no competitive context, no dollar figure, one-shot not iterated). Now every finding is
> grounded against the real market and priced; and the top call sites are *drilled* in a loop until value
> is maxed. LLM-focused sibling of `/uat` — reuses its Character/JTBD/senior-bar method, scoped to prompts
> and outputs. Stack-agnostic engine; the per-app market, prices, and call sites live in `tiger/`.

## What's new in v2 (read this first)
1. **Competition grounding (research).** Before judging value, web-research the **incumbent** the app
   displaces (the human pro it stands in for — its cost/time/effort) and the **direct competitors**
   (price/positioning/quality claims). The judging bar becomes the **market bar** ("beat the incumbent's
   output / a competitor's tool"), not a vague senior. Cite sources. Persist to `value-model.md`.
2. **Quantified value (value-model.md).** A per-app model that turns each call site into $/hours and
   prices every defect as **$-leaked = value_ceiling × value_lost × P(fires)**. The backlog ranks by
   dollars, and the **value ledger** is a real model (promised vs delivered $), not a vibe.
3. **`drill` mode (loop-until-maxed).** Iterate ONE top call site: measure delivered value LIVE → diagnose
   the single highest-$ gap → apply an improvement → re-measure → repeat until marginal Δ$ per rung falls
   below threshold (or budget). Output the **value curve** + the residual ceiling.

> **Depth discipline (anti-shallow).** A value finding is INCOMPLETE unless it carries (a) a $ figure from
> the value model, (b) a market comparison (the incumbent or a named competitor), and (c) for a top
> finding, a LIVE measurement (a real generation judged against the market bar), not a static read.
> "Grounding 3/5" is a hypothesis; "$3.1k/use leaked, confirmed on a live output a domain expert had to
> substantially rework" is a finding.

## The Obsidian vault (durable memory)
`tiger/` is an Obsidian vault — markdown + YAML frontmatter + `[[wikilinks]]`. Each run reads the prior
vault, diffs, writes back. Files:
```
tiger/
  Tiger.md          # home / map-of-content: headline state + links
  config.md         # per-app: discovery globs, the model-invocation recipe, fixtures
  value-model.md    # v2: the researched competitive landscape + quantified $ model (first-class asset)
  call-sites/<id>.md   # one note per call site (the inventory; carries value_ceiling + $ findings)
  characters/<name>.md # durable output-scoped Characters (JTBD + market/senior bar)
  models/<model>.md    # per-model×thinking benchmark rollups
  sessions/<date>.md   # immutable run records (incl. drill value curves)
```

## The lenses
### Lens 1 — Code quality of the AI plumbing (static, cited)
Per call site, follow the import chain to the call and score, citing `file:line`: one **chokepoint**
wrapper? typed **schema + validate + normalize + self-repair**? **telemetry** (model/tokens/cost/latency/
attempts/repaired)? **cache/dedupe** by input-hash? rate-limit/quota? **prompt-bloat**? sensible
temperature/maxTokens? Emit code findings + concrete fixes.

### Lens 2 — Value, quantified against the MARKET (the v2 core)
1. **Research the market (web).** Establish, cited: the incumbent's cost/time/effort per use; the direct
   competitors (price, positioning, do-they-do-the-hard-part, quality claims); and the **bar the output
   must clear to win**. Write it to `value-model.md`.
2. **Build/refresh the value model.** `value_ceiling` per call site = the displaceable labor it actually
   performs (hours × the incumbent's blended rate, market-anchored). COGS is usually trivial → **value ≈
   quality**, so the optimization target is how *usable* the output is. Price it as a CONTINUOUS function
   of the judge's market_score (0–100), plus a domain risk-avoidance term:
   ```
   value_delivered = value_ceiling × usableFraction(score) + riskAvoidance(score)
   ```
   `usableFraction` must be **continuous / non-saturating** (a coarse light/moderate/substantial bucket
   map saturates — an 82 and a 94 then look identical in $, hiding the very gains a drill creates; this
   bit the first immigration drill). `riskAvoidance` prices the domain failure the output averts (a
   rejected filing, a tax penalty, a churned customer, a denied claim) × the probability a stronger
   output shaves off it. State every anchor as a conservative [EST]; tune as real rework/failure data
   arrives.
3. **L1 (theoretical):** per `character × call-site`, read the prompt + grounding and judge the *designed*
   output against the **market bar** + the value model. Score grounding n/m AND the $-leak hypothesis.
4. **L2 (empirical, the real evidence):** actually run the call with character inputs and judge the LIVE
   output against the market rubric → quality → rework → **$ delivered**. One confirmed live $ beats ten
   theoretical n/m. (See `init` learnings: subagent-as-engine recipe.)

### Lens 3 — Model optimization (alternative scenario)
Hold the prompt + character input fixed; run a **model × thinking matrix** (Agent `model`/`effort` params).
A separate judge (never the model under test) scores each cell against the market bar; record cost +
latency. Find the cheapest/fastest cell that still clears the bar (downgrade) or a stronger cell that lifts
$ enough to justify spend (upgrade). Write to `models/*` + the call-site `recommended_model`.

## Modes
- **`init`** — scaffold the vault + `config.md`; inventory every call site → `call-sites/*`; adapt
  Characters; **run the initial competition research → `value-model.md`**; write `Tiger.md`. No lens runs.
- **`scan`** — re-inventory, diff vs the vault (new/removed/prompt-or-schema drift), flag regressions. Cheap.
- **`run [--lens code|value|model|all] [--live]`** — the full pass. Default `--lens all`, L1; `--live` adds
  Lens-2 real generations + Lens-3 benchmark on the top call sites. Mass-parallel: one subagent per
  call-site (L1) and per character × call-site (L2). Writes a session note + refreshes notes + the
  **$-ranked backlog + value ledger**.
- **`drill <call-site> [--rungs N] [--samples K] [--budget $] [--engine model@effort]`** — *the v2 loop.*
  Iterate ONE high-value call site until value maxes:
  1. **Measure** delivered value LIVE (generate with a real character input → judge vs the market bar →
     rework → $ delivered vs the ceiling). **Sample K≥3 generations per rung** and average — a single
     judge score carries ±noise that can invert a rung-to-rung comparison (the immigration drill's k=1
     curve was optimistic; k=4 moved a "light/$3,293" rung to "moderate/$2,627" and only the *averaged*
     ladder gave a trustworthy GO).
  2. **Diagnose** the single highest-$ gap (what the market bar dings + what the value model says it costs).
  3. **Improve** — apply the next change (grounding/prompt/model). Keep an explicit **improvement ladder**
     (v0 baseline → vN), each rung one real lever, so the run is an ablation, not a guess. Prefer cheap
     levers first (a prompt change) and isolate them (hold the rest fixed) so a win is attributable.
  4. **Re-measure** → Δ$ for the rung. A win counts only if the rung distributions barely overlap.
  5. **Repeat** until marginal Δ$ < threshold (diminishing returns) or the budget/rung cap is hit.
  Output: the **value curve** (rung → quality, $ delivered), the winning configuration, and the **residual
  ceiling** (what still can't be closed without a bigger investment — name it honestly). A negative rung
  (a lever that *didn't* help — e.g. raw-evidence injection in immigration) is a first-class result: it
  kills a feature before it's built.
- **`benchmark <call-site>`** — Lens-3 only, deep, one call site.
- **`recall`** / **`backlog`** — summarize current state / (re)emit the $-ranked backlog from the vault.

## The deliverable
One **$-ranked backlog** (each item: lens · finding · `[[call-site]]` · **$ leaked / unlocked** · fix),
a **value ledger** (promised vs delivered $, rolled up from the value model), the **strengths to protect**,
and — for any `drill` — the **value curve** showing where each lever lands and where value maxes out. The
chat reply is the headline + sharpest findings, each with `file:line`/a live metric AND a dollar figure.

## Concurrency & trust
- Mass-parallel L1 + L2-L1. L2-live + Lens-3 + `drill` make real calls → cost-bounded, cache every cell in
  `models/*` keyed by (call-site, model, thinking, input-hash); never re-run an identical cell.
- **Evidence or it didn't happen:** static findings cite `file:line`; value findings cite a market source
  (`value-model.md`) AND a $ figure; top findings cite a LIVE generation + judge verdict.
- **Adversarial, separate judge** for value + model verdicts; the judge is NEVER the model under test;
  default "not better / not real" unless earned. Watch for fabrication explicitly (an invented specific
  caps integrity, and the no-fabrication discipline must survive any new framing a drill adds).
- **Honest ceilings:** name what a fix does NOT close ($ still leaking, the residual rework, the bigger
  lever deferred). A drill that plateaus must say what the next-tier investment would be (often DATA, not
  a prompt — e.g. a citable reference the output can ground comparative claims in).
- **Vault-write verification:** after any parallel scan/author, `ls` the dir, diff vs expected ids, backfill
  missing notes — don't trust a subagent's "wrote N" manifest.
- **Lens-3 / drill recipe that works:** one subagent per cell with the Agent tool's `model`/`effort` params,
  fed the tool's *real* reconstructed prompt + a fixed character input, returns schema JSON + a wall-clock
  latency proxy; judge with a separate model. No external keys needed. (Fable can be unavailable as a
  judge — fall back to a separate model that is NOT in the matrix under test.)

## Using v2 on a new app
1. `/tiger init` → inventory + adapt Characters + **first competition research → value-model.md**.
2. `/tiger run --live` → $-ranked backlog + value ledger from real generations.
3. `/tiger drill <top call site>` → push that one site up its value curve until it maxes; ship the winning
   levers; re-`run` to book the delta in the vault.
