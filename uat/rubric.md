# Evaluation rubric — the lens every Character judges through

Method backbone: **Nielsen heuristic evaluation** + **cognitive walkthrough** (task-based,
new-user POV) + **jobs-to-be-done** acceptance. The point is *evaluative* judgement (is it good
enough to finish the job?), not *verification* (does the code do X?).

## The seven dimensions

| # | Dimension | The question |
|---|-----------|--------------|
| 1 | **completion** | Could the Character actually finish their job, end to end? |
| 2 | **effort** | How much friction / how many steps / how much re-work to get there? |
| 3 | **clarity** | Did they always know what to do next, what state they were in, what the output meant? |
| 4 | **trust** | Did it feel credible, compliant, safe to rely on (esp. legal accuracy + the UPL line)? |
| 5 | **missing** | What piece that the job *needs* simply isn't there? |
| 6 | **time-saved** | Did it beat the traditional LLM-less way by a meaningful margin (not slower)? |
| 7 | **senior-quality** | Is the AI output at least as good as a senior in that role would produce? |

Dimensions 6 + 7 are the Character-specific ones — scored against each Character's own
**Motivation** and **Senior-quality bar** and their **scored acceptance criteria**, applied
identically every run (that consistency is the harness).

## Cognitive-walkthrough questions (ask at every step, in-character)

1. Will the user try to achieve the right effect? (Is the next action obvious from their goal?)
2. Will they notice the correct affordance is available? (Is the button/input *perceivable*?)
3. Will they connect that affordance to the effect they want? (Does the label mean what they need?)
4. After acting, will they see progress toward their goal? (Is feedback legible + trustworthy?)

Getting lost, dead-ending, or doubting the output **is a finding**, even if every step
"technically works".

## AI-surface focus (this app's centre of gravity)

- **Grounding audit (L1's sweet spot):** does the prompt actually receive the user's *real*
  context (their CV / evidence / criteria / case facts), or only thin inputs or sample data?
  "Good machinery fed thin context" is the most common AI-product defect and is fully visible in
  code. Follow the import chain: affordance → handler → the `generate()` call → its prompt.
- **Senior-quality on the grounded path (L2's unique value):** a model/CI gate already covers the
  generic path; L2 must fill the *real* inputs and assert the live output actually *uses* them
  (names the supplied evidence, crosswalks the right criterion, reads like a senior drafter — not
  generic filler).
- **The UPL line is load-bearing:** the single `DISCLAIMER` must ride on every AI payload, and the
  product must never *act as* the attorney or give legal advice. A drift here is a `trust` blocker.

## Finding schema

```
{ id, journey, character, cert_level, type, severity, dimension,
  title, expected, got, evidence[], code_check, verdict, suggested_acceptance,
  resolution?, scope_note?, l2_priority? }
```

- `cert_level`: `L1` (theoretical/structural) | `L2` (empirical/live)
- `type`: `missing-feature | quality-gap | broken-flow | confusion | trust`
- `dimension`: `completion | effort | clarity | trust | missing | time-saved | senior-quality`
- `severity`: `blocker | major | minor | polish`
- `evidence[]`: L1 → `file:line` of the affordance/gap; L2 → screenshot / ARIA quote / `file:line`
- `code_check`: `confirmed-absent | present-but-missed | present-broken | by-design | n-a`
- `verdict`: `confirmed | refuted | uncertain` (adversarial pass; default refuted/uncertain unless evidence holds)
- `l2_priority` (L1 only): what L2 must verify live — e.g. "actual draft prose quality on the grounded path"
- A finding may also be a **strength** (positive) — those feed "What passed" + the synthesis and say what *not* to touch.

## Severity guide

- **blocker** — the job cannot be finished, or trust/compliance fails (e.g. UPL drift, the draft is unusable, a dead-end with no path forward).
- **major** — the job finishes but with serious friction, re-work, or quality below the senior bar.
- **minor** — noticeable friction or a quality nit that doesn't stop the job.
- **polish** — cosmetic / nice-to-have.

## Per-journey L1 verdict (three states — never collapse to pass/fail)

- **L1-pass** — structurally sound, no majors → clean to L2.
- **L1-conditional** — completes structurally but has major findings to fix; still L2-eligible, majors carry forward.
- **L1-fail** — a structural gap blocks the job; no browser needed to know it's broken; fix before L2.
