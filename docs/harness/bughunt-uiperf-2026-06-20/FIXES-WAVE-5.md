# Bug Hunter + UI Perfectionist — Fix Wave 5: Eval-harness false-green

> 1 commit, 4 findings closed (2 Critical, 2 High). Closes the LAST 2 criticals.
> Baseline preserved: tsc 0 → 0, tests 395 pass (run.ts is a script, not in the
> unit suite — the exit-code guards were smoke-tested directly). Lint clean.
> Mental model: *the gate that guards everything else must not lie — a green exit
> must prove the model answered and every deterministic invariant held.*

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `3c321db` | llm-eval #1 (C), #2 (C), #3 (H), #4 (H) | scripts/llm-eval/run.ts |

## What was fixed

1. **Hard FAILs didn't fail CI (#1, Critical).** Only `errored` (a thrown
   pipeline) was wired to the exit code, so a run where every scenario answered
   but violated a deterministic FAIL invariant (dropped/altered UPL DISCLAIMER,
   wrong-classification leak, engine fell to mock) had `errored === 0` and exited
   0 — passing CI while reporting hard violations. Now
   `if (fail > 0 || errored > 0) exitCode = 1`.
2. **Empty scenario set = clean pass (#2, Critical).** A filter matching nothing
   (`--site qualfy` typo, `--ids Q99`) produced `records = []`, "0 hard failures",
   exit 0 — indistinguishable from a real green while testing NOTHING. Now exits
   2 on an empty set, and rejects unknown `--ids` tokens.
3. **No-engine run exited 0 (#3, H).** A null engine ran all 30 scenarios on the
   template (no model call) and still exited 0. Now fails fast (exit 2, like
   smoke.ts) when no engine is configured.
4. **`--repeat` swallowed bad args + over-reported coverage (#4, H).** `0`/`-3`/
   `foo` silently coerced to one pass, and the headline counted passes as
   scenarios. Now rejects a non-positive/NaN `--repeat` (exit 2) and reports
   "N scenarios ×M passes" distinctly.

## Verification

Smoke-tested the exit paths directly (each exits **2** before any model call):

| Invocation | Exit |
|---|---|
| `--site nope` (unknown site → empty set) | 2 |
| `--repeat 0` | 2 |
| `--ids ZZ99` (unknown id) | 2 |
| no engine configured | 2 |

`tsc --noEmit`: 0. The `fail > 0 → exit 1` path needs a live engine producing a
FAIL gate to exercise end-to-end, but the logic is a one-line, read-verified
change.

## Patterns established (catalogue items 15-16)

15. **An eval's exit code must reflect every tier it checks, not just crashes.**
    Wiring only thrown pipelines to the exit code lets deterministic-invariant
    failures pass green — the worst false confidence for a quality gate.
16. **Zero work done ≠ success.** An empty result set (bad filter, no engine,
    dropped config) must be a distinct non-zero exit, never indistinguishable
    from "everything passed."

## What remains

llm-eval #5 (sentence-count heuristic fooled by `U.S.`/`C.F.R.`/`e.g.`, M) —
DEFERRED: an in-progress masking fix introduced a NUL byte into the
single-sourced `adjudication-gates.ts`, so it was reverted to keep that gate
clean; revisit with a tokenizer-based approach. Waves 6-8 per INDEX (a11y,
reliability, UI polish — no remaining criticals).
