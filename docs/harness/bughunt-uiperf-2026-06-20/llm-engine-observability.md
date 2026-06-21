> Total: 5 | Critical: 0 | High: 2 | Medium: 3 | Low: 0
> Context: LLM Engine & Observability
> Lens mix: bug-hunter 5, ui-perfectionist 0

This context is pure server/backend (no `.tsx`), so per the brief the scan skews fully to bug-hunter (5/5). The files read: `client.ts`, `config.ts`, `engines.ts` (the real model-call mechanics, imported by `client.ts`), `json.ts`(+test), `label.ts`, `guards.ts`(+test), `llm.test.ts`, `lighttrack.ts`, `cost-telemetry.ts`, `docs/llm-engines.md`, plus consumers `lib/ai/operation.ts` and `features/qualification/qualification.ts` to trace how `extractJson`/`source` flow through the paid pipeline.

## 1. Unsanitised `claudeBin()` interpolated into a `shell: true` command string

- **Severity**: High
- **Lens**: bug-hunter
- **Category**: command-construction / broken-on-Windows / latent injection
- **File**: src/lib/llm/engines.ts:112-120 (with config.ts:43-45)
- **Scenario**: `runClaudeCli` builds `` `${claudeBin()} -p --output-format text --model ${claudeModel()}` `` and runs it with `shell: true`. `claudeModel()` is deliberately sanitised (`config.ts:50` strips everything but `[A-Za-z0-9._-]`, with the comment "Sanitised — it goes into argv"). `claudeBin()` returns `CLAUDE_CLI_PATH ?? "claude"` with **no sanitisation**, yet it is interpolated into the very same shell string. The code comment even asserts "the only interpolated value is the sanitised model id" — which is factually wrong; the bin path is interpolated too.
- **Root cause**: Two values go into one `shell: true` string; only one is sanitised. The default `claude` is safe, but the moment an operator sets a real path the assumption breaks.
- **Impact**: (a) **Breaks on the most common Windows install path** — `CLAUDE_CLI_PATH=C:\Program Files\nodejs\claude.cmd` tokenises at the space, so the shell tries to run `C:\Program` → spawn fails → every Claude-engine call throws → silently reclaims + downgrades to `source:"mock"` for the whole session, with no operator-visible cause. (b) Since the value reaches a shell unquoted, any metacharacter in operator config (`;`, `&&`, `$()`, backticks) is executed — a latent command-injection sink that the surrounding comment claims is impossible.
- **Fix sketch**: Quote the bin in the shell string (`"${claudeBin()}"`), or better drop `shell:true` and pass an argv array (`spawn(claudeBin(), ["-p","--output-format","text","--model",claudeModel()])`) with the model already sanitised; on Windows resolve `.cmd` explicitly rather than relying on the shell. Update the now-incorrect comment.

## 2. Gemini safety-block / empty-candidates throw skips cost telemetry (margin under-count)

- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: observability / billing accuracy / silent failure
- **File**: src/lib/llm/client.ts:62-86 (callGemini at engines.ts:99-100)
- **Scenario**: When Gemini returns a response with no usable text part (safety block / `finishReason: SAFETY` / recitation / empty candidates), the SDK's `r.response.text()` **throws**. In `engines.ts:100` that throw escapes `callGemini` before `client.ts` ever runs `void trackLlm(...)` (lines 76-82). The throw propagates up to `operation.ts:321`, which reclaims the charge and returns the mock — correct for the user, but...
- **Root cause**: The cost/latency emission is placed *after* the call returns successfully; the failure path (a real, latency-incurring, possibly token-consuming Gemini round-trip) emits nothing, unlike the Claude path which has an explicit `catch` that emits `status:"error"` telemetry (client.ts:109-119).
- **Impact**: Safety-blocked / empty Gemini calls — exactly the calls you most want to see in observability — are invisible to LightTrack: no latency, no error status, no provider/model row. Margin and failure-rate dashboards undercount Gemini errors, and a spike in safety blocks is undetectable. (User isn't billed, so this is observability/accuracy, not a charge bug.)
- **Fix sketch**: Wrap the Gemini `generate` body in try/catch mirroring the Claude path: on throw, `void trackLlm({ provider:"google", model, inputTokens:0, outputTokens:0, latencyMs: Date.now()-startedAt, status:"error" })` then rethrow. Measuring latency requires capturing `startedAt` in `client.ts` (or having `callGemini` return latency even on failure).

## 3. `extractJson` fence regex can capture the wrong (non-JSON) code block → false null

- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: JSON extraction / edge case
- **File**: src/lib/llm/json.ts:12-13
- **Scenario**: The extractor first matches `` /```(?:json)?\s*([\s\S]*?)```/i `` and, if it matches, searches **only inside that first fence** (`candidate = fenced[1]`). A model that emits any earlier non-JSON fenced block wins the match. E.g. output: a `` ```text … ``` `` reasoning block (or a ```` ```sql ```` snippet), followed by the real `` ```json {…} ``` ``. The non-greedy `[\s\S]*?` locks onto the *first* fence pair, so `candidate` is the text/sql block, `indexOf("{")` finds nothing (or finds a brace inside prose that never balances), and the function returns `null` — even though valid JSON is plainly present later in the string.
- **Root cause**: "First fence" is assumed to be "the JSON fence". The brace-balancing loop that follows is robust, but it only ever sees the contents of whichever fence matched first.
- **Impact**: Whenever the model prepends any other code block, qualification/drafting/rfe/evidence silently fall back to the deterministic mock (`qualification.ts:194-197`) — the user pays nothing extra (charge reclaimed) but gets template output labelled `source:"mock"` while the model actually answered correctly. Quality regression that's invisible unless someone reads the raw text. The existing tests only cover a single ` ```json ` fence and bare/prose objects, so this slips through.
- **Fix sketch**: Prefer a fence whose body actually contains `{`: iterate all fence matches (global regex) and pick the first whose captured group contains a `{`; if none, fall back to scanning the full `text`. Cheaper alternative: if the first-fence candidate yields no balanced object, retry the brace scan against the full `text`. Add a test for "non-JSON fence precedes the JSON fence".

## 4. `claude -p` timeout under `shell: true` can leak an orphaned grandchild

- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: process lifecycle / resource leak / timing
- **File**: src/lib/llm/engines.ts:112-138
- **Scenario**: `spawn(command, { timeout: 180_000, shell: true })`. With `shell:true` the child Node tracks is the **shell**, and `claude` is the shell's grandchild. On the 180s timeout Node sends SIGTERM to the shell; the shell may die while the long-running `claude` grandchild keeps executing (no process-group kill). Node then fires `close` with a signal/`null` code → the promise rejects with `claude CLI exited with code null` — but the grandchild process (and its CPU/subscription usage) lingers. On Windows the SIGTERM-to-shell semantics are weaker still.
- **Root cause**: Timeout enforcement targets the shell wrapper, not the actual model process; no `detached` + negative-PID group kill, and no explicit kill on the grandchild.
- **Impact**: Under model hangs or a flood of slow prompts, orphaned `claude` processes accumulate on the host, consuming memory/CPU and (since it's the local subscription login) racking up real usage with nothing awaiting the result. The caller already moved on to the mock. Local-dev/tooling engine, so blast radius is bounded, but it's a genuine leak under the exact condition the 180s guard is meant to handle.
- **Fix sketch**: Spawn `detached:true` and on timeout/`close`-by-signal kill the whole process group (`process.kill(-child.pid, "SIGKILL")`), or avoid `shell:true` (argv form, see #1) so Node tracks the real `claude` PID directly and its `timeout` kill lands on the right process.

## 5. Whitespace/empty model output is returned as a "successful" engine result before falling to mock

- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: silent failure / guard non-blocking
- **File**: src/lib/llm/guards.ts:39-48; engines.ts:132 (`resolve(out.trim())`); client.ts:62-86
- **Scenario**: A model can return an empty or whitespace-only completion (Gemini `text()` returning `""`, or `claude -p` exiting 0 with no stdout → `out.trim() === ""`). `withGuards` runs `LLM_OUTPUT_GUARD` (`minWords:1`), sees the violation, **`console.warn`s, and returns the empty string unchanged** (guards are non-blocking by design). The empty string flows back into `operation.ts:307`; the route's `guard(raw,…)` then calls `extractJson("")` → `null` → mock fallback (qualification.ts:195). So the *outcome* is safe — but the guard verdict that detected the real problem is discarded.
- **Root cause**: The guard is observability-only; nothing downstream consumes its `g.ok` verdict to short-circuit. Whether an empty completion becomes a mock depends entirely on each route's `guard()` happening to also reject empty/short text via `extractJson`. A future route whose `guard` returns a non-null value for empty input (e.g. a guidance route that accepts free text) would surface a blank, `source:"engine"`-labelled, **billed** response.
- **Root cause (secondary)**: The richer `guard()` capabilities (`json`, `jsonKeys`) are deliberately unused (guards.ts:22-32), so the guard layer can't enforce "must be parseable JSON" on the JSON routes — that contract lives only in each feature's ad-hoc parser.
- **Impact**: Today: a noisy `console.warn` on every empty completion but correct mock fallback. Latent: the guard's failure signal can't gate billing/labeling, so the "never bill a mock / never label empty as model" invariant is enforced incidentally by `extractJson`, not by the guard that was built to enforce it. One non-JSON route added later silently breaks it.
- **Fix sketch**: Have `withGuards` (or the orchestrator) treat a failed guard verdict as an unusable response on the engine path — e.g. surface `g.ok` so `operation.ts` can reclaim + mock when the guard fails, instead of relying on each route's parser to reject empty text. At minimum, tighten `LLM_OUTPUT_GUARD` per JSON route (`json:true`) so emptiness is caught uniformly rather than per-feature.
