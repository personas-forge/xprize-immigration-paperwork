# Code Refactor Scan — LLM Evaluation Harness

> Total: 4 (C0 / H2 / M1 / L1)

## 1. Engine-selection logic triplicated across config.ts, scripts/llm-eval/engine.ts, and e2e/engine.ts
- **Severity**: high
- **Category**: duplication
- **File**: e2e/engine.ts:6-16 (also scripts/llm-eval/engine.ts:34-42, canonical in src/lib/llm/config.ts:25-34)
- **Scenario**: A developer changes how an engine is chosen (e.g. adds a new `LLM_ENGINE` alias, or changes the "explicit gemini needs a key" rule). The canonical `resolveEngine()` in `src/lib/llm/config.ts` is updated and its unit test (`src/lib/llm/llm.test.ts`) passes, but the two harness copies silently keep the old behavior — so the e2e/eval gates assert against a stale notion of which engine is active.
- **Root cause**: The engine-precedence rule (explicit `claude`/`claude-cli`/`claude-code` wins keyless → else `gemini` when `GEMINI_API_KEY` is set → else fallback) exists in THREE places. `src/lib/llm/config.ts:25` is the source of truth (with the unit-test pin). `e2e/engine.ts:6-16` hand-rolls the *same* precedence into `EXPECTED_SOURCE` (note the duplicated alias list `claude` / `claude-cli` / `claude-code` at line 8, mirroring config.ts:28). `scripts/llm-eval/engine.ts:34-42` reuses `resolveEngine` (good) but layers its own copy of the `requiresImages`→gemini downgrade.
- **Impact**: Engine-selection rules can drift between what the product does and what the safety net asserts. The e2e copy is the riskiest: it imports nothing from config.ts, so a config change produces ZERO compile error here and the spec quietly verifies the wrong `source`.
- **Verification**: Confirmed `e2e/engine.ts` has no import from `@/lib/llm/config` (it reads `process.env` directly); grep of `resolveEngine|claude-cli|claude-code` shows the alias list literally duplicated in config.ts:28 and e2e/engine.ts:8. `scripts/llm-eval/engine.ts:19` does import `resolveEngine` but re-states the image downgrade. `EXPECTED_SOURCE`/`EXPECTED_BADGE`/`AI_TIMEOUT` are all consumed (llm-routes.api.spec.ts, qualify-draft.ui.spec.ts) — not dead, just duplicated logic.
- **Fix sketch**: Have `e2e/engine.ts` derive its expectation from the canonical resolver: `import { resolveEngine } from "@/lib/llm/config"` and compute `EXPECTED_SOURCE = resolveEngine() ?? "mock"`, then map to the badge. The `@/` alias already resolves under the harness (smoke.ts relies on it), and Playwright runs via tsconfig paths. That deletes the hand-rolled `EXPECT_CLAUDE` block and makes the alias list single-source.

## 2. scripts/llm-eval/engine.ts duplicates the entire client.ts engine bodies and has already drifted (missing stdin error guard)
- **Severity**: high
- **Category**: duplication
- **File**: scripts/llm-eval/engine.ts:34-96 (vs src/lib/llm/client.ts:56-164)
- **Scenario**: `client.ts` added `child.stdin.on("error", reject)` (client.ts:155) specifically to stop the Claude CLI promise hanging for the full 180s timeout when the child closes its stdin pipe on an auth failure. The eval harness copy (`runClaudeCli`, engine.ts:73-96) does NOT have that handler — so a keyless/auth-failed Claude CLI during `npm run eval:llm` can hang ~180s per scenario instead of failing fast, exactly the bug client.ts fixed.
- **Root cause**: `engine.ts` is a deliberate `server-only`-free *copy* of client.ts (it says so at engine.ts:1-13, "Keep in sync with src/lib/llm/client.ts"). The copy reproduces `getLlm`, `geminiClient`, `claudeClient`, `runClaudeCli` almost verbatim, but the manual sync has lapsed: the stdin error handler, the LightTrack observability, the Gemini SDK singleton/memoization (client.ts:75-81), and the `temperature` option (client.ts:35-44, 93) are all absent.
- **Impact**: "Keep in sync" comments do not enforce sync. The harness now exercises a *different* engine implementation than production — including a known hang the product already patched — undermining the whole point of running scenarios "through the REAL product code path." The missing `temperature` also means the eval can never exercise the `temperature: 0` qualify hardening the docs (EVALUATION.md F2b) call out.
- **Verification**: Diffed the two files. client.ts:155 `child.stdin.on("error", reject)` has no counterpart in engine.ts (its close/error handlers stop at engine.ts:87-88). `lt.track*`, `withGuards`, `geminiSdk()` memoization, and `temperature` appear only in client.ts. The harness `geminiClient` re-news `GoogleGenerativeAI` per call (engine.ts:49) where client.ts memoizes.
- **Fix sketch**: Two viable paths. (a) Minimal: extract `runClaudeCli` + the bare engine factories into a small shared `src/lib/llm/engines.ts` that has NO `server-only` import, then have both client.ts (wrapping with guards/LightTrack) and the eval engine.ts import it — eliminating the verbatim copy. (b) If a full shared module is too invasive, at minimum port the stdin error guard and add a unit/type assertion that the two `runClaudeCli` bodies match. Prefer (a); it dissolves this finding and #1's eval half.

## 3. The "no off-wrapper model calls" invariant is asserted by docs but not enforced; harness engine is a parallel wrapper
- **Severity**: medium
- **Category**: structure
- **File**: scripts/llm-eval/EVALUATION.md:29-31, scripts/llm-eval/README.md:19-21
- **Scenario**: Both docs claim "All six funnel through one wrapper (src/lib/llm/client.ts). No off-wrapper model calls exist." But `scripts/llm-eval/engine.ts` is itself a second wrapper that calls `@google/generative-ai` and spawns `claude` directly (engine.ts:48-49, 73-96). A reader trusts the doc's "one wrapper" claim while the harness contradicts it.
- **Root cause**: The harness must avoid `import "server-only"` (client.ts:1), and the team solved that by cloning the wrapper rather than factoring the `server-only` guard out of a shared core (see finding #2). The docs describe the *intended* product invariant but read as if it applies repo-wide, which it does not.
- **Impact**: Low runtime risk, but the documentation overstates the architecture and will mislead the next person auditing model-call surfaces. It also rationalizes the copy in #2 as acceptable.
- **Verification**: EVALUATION.md:29 and README.md:19 both assert the single-wrapper invariant; grep for `GoogleGenerativeAI`/`spawn` shows a second concrete engine implementation in scripts/llm-eval/engine.ts. The claim is true for `src/` but false once the harness is in scope.
- **Fix sketch**: Once #2's shared core lands, the statement becomes true and needs no edit. Until then, add one clause to both docs: "(the eval/e2e harness re-exposes the same engines without the `server-only` guard for `tsx`/Playwright; it is intentionally the only other call site)." Cheap honesty fix; pairs with #2.

## 4. README "Files" list omits run-time outputs note drift and EVALUATION.md headline counts are point-in-time
- **Severity**: low
- **Category**: cleanup
- **File**: scripts/llm-eval/EVALUATION.md:11-13
- **Scenario**: EVALUATION.md leads with a hard-coded headline "236 gate checks · 232 ✓ / 1 ✗ / 3 ⚠". Gate counts are derived live by run.ts:218-228 and change whenever scenarios/gates change (e.g. the `*-caselaw-review` gates were added after this run, per F3). A reader treats the headline as the current state.
- **Root cause**: A snapshot of one historical run was pasted into prose as if it were a standing fact, with no "as of <date>" qualifier on the number itself (the verification date is buried at line 171).
- **Impact**: Cosmetic/staleness only — no code effect. But it can mislead during review ("the eval says 1 failure") when the real figure depends on the current scenario+gate set.
- **Verification**: run.ts:218-228 computes `total/fail/warn/pass` dynamically; the README correctly describes outputs as git-ignored `out/report.md`. Only EVALUATION.md:11 hard-codes a count. The scenario count "30" is consistent with SCENARIOS (scenarios.ts: 10 qualify + 6 draft + 3 section + 4 rfe + 4 guidance + 3 evidence = 30).
- **Fix sketch**: Prefix the blockquote with "As of the 2026-05-31 authoritative run:" (the date already used at line 171), or reference `out/report.md` for current figures rather than restating a number that goes stale on every gate change.
