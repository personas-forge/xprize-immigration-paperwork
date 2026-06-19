# UAT overlay — Immigration Concierge

This is the **app-specific overlay** for the portable `/uat` skill (the engine lives in
`.claude/skills/uat.md`). It holds everything that is true about *this* app: who the
real users are (`characters/`), the jobs they come to do (`journeys/`), how we judge
(`rubric.md`), how to reach a reproducible start state (`env.md`), and the known-accepted
baseline (`accepted-gaps.md`).

> **What this tests:** is the product *good enough for a real O-1 petitioner / immigration
> professional to finish their job* — not "does the code do what we told it to" (that's the
> unit + e2e suites). It catches missing pieces, quality/fit gaps, and journey-level failure
> where every step passes its own test yet the user still can't finish.

## The app in one paragraph

**Immigration Concierge** is a self-serve, token-metered AI tool that drafts an O-1 / EB-1A
extraordinary-ability petition packet — the work a firm bills **$8k–$15k** and **2–3 months**
to assemble — from the beneficiary's own evidence (CV, GitHub, press, publications), structured
across the **eight regulatory criteria** (8 CFR §214.2(o)(3)(iii)). The AI drafts *work product*;
the user's **own attorney of record** reviews, signs, and files it. The tool is **not a law firm
and gives no legal advice** (a non-negotiable UPL safeguard — every AI payload carries the
single `DISCLAIMER`). US market, federal/nationwide; UK is next. See repo `README.md`,
`docs/`, and the memory notes.

## Two-level certification (chronological)

- **L1 — Theoretical (static, code-grounded, no browser).** Build a *surface model* from the
  code (routes → affordances → the handler → the `generate()` call → its prompt + grounding) and
  walk each journey *in-character* over it. Catches structural failure (missing features,
  dead-ends, thin grounding) cheaply and **mass-parallel across Characters**. → cert **L1**.
- **L2 — Empirical (live browser, serial).** Only for journeys that earned L1. Drive the real
  app (`npm run dev`, pglite, **real Claude via the CLI engine** — see `env.md`) and confirm
  the path holds *and* the live AI output clears the senior-quality bar on the **grounded**
  path. → cert **L2**.

`L1's blind spot is reachability`: it can confirm a fix *landed* in code but not that *this*
Character can actually open the surface (nav gating, plan, fixture). Keep **landed ≠ reachable ≠
unblocks-the-job** distinct; reachability + job-unblocking are L2's to confirm.

## How to run

```
/uat run --l1          # cheap, broad, mass-parallel theoretical sweep (start here)
/uat run               # full L1 → L2 on survivors
/uat run --l2          # live only (assumes past L1)
/uat run --acceptance  # re-run frozen acceptance gates (L2)
```

Environment + fixtures: **`env.md`** (the per-app file). Drivers for L2: `driver/drive.mjs`
(navigate + screenshot + ARIA + one click) and `driver/drive-ai.mjs` (fill → generate → poll
until the model result settles, with an optional grounding assertion).

## Character file template

```markdown
---
name: <slug>
role: <real role from THIS app's target group>
segment: beneficiary | operator | prospect-buyer
surface_binding: [ <routes/modules this Character actually reaches> ]
journeys: [ <journey slugs this Character runs> ]
references: [ <deciding research URLs> ]
---

# <Name> — <one-line who>

**Background / lived experience:** <history, tools they've been burned by, who they answer to,
what's at stake>
**Voice:** <how they actually talk>

**Jobs-to-be-done:** ...
**What good looks like:** ...
**Pet peeves:** ...

**Motivation (time-saved):** the job the traditional, LLM-less way takes <X>; the app should
save <Y>. If it doesn't save meaningful time — or is *slower* — that is a finding.

**Senior-quality bar:** the AI output must be at least as good as I'd produce as a senior in my
role. <what a senior would reject>.

**Scored acceptance criteria (applied identically every run):**
1. [ ] ...
2. [ ] ...
```

## Artifacts

`runs/<date-slug>/` holds `findings.json`, `report.md`, the per-Character first-person reviews
(`<character>--<journey>.md` or `<character>.md`), and `SUMMARY.md` for multi-Character runs.
Screenshots under `runs/*/shots/` are gitignored.
