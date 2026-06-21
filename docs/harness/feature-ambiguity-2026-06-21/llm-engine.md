# LLM Engine & Observability — Feature Scout + Ambiguity Guardian

> Context #18 · Group: AI Infrastructure & Evaluation
> Total: 5 findings

## 1. No timeout on the production Gemini call — a hung request can pin a paid generation forever
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/lib/llm/engines.ts:99` (`callGemini` → `m.generateContent(prompt)`)
- **Observation**: The Claude CLI path has an explicit `CLAUDE_TIMEOUT_MS = 180_000` with a process-tree kill (engines.ts:103, 160-163), and the LightTrack telemetry POSTs are time-boxed at 2000ms (lighttrack.ts:224, cost-telemetry.ts:47). But the production engine — Gemini — `await`s `m.generateContent(prompt)` with no timeout, no `AbortSignal`, and no upstream wrapper. The charge-then-reclaim flow in `operation.ts:335-348` `await`s `llm.generate(...)` with no deadline either. If the Gemini SDK call hangs (network stall, upstream slowness), the route hangs: the user has already been charged, the request holds a connection, and nothing falls back to the mock. The asymmetry (one engine guarded, the other not) is an undocumented assumption that the SDK "always returns."
- **Proposal**: Wrap `generateContent` in a `Promise.race` against a configurable deadline (e.g. `GEMINI_TIMEOUT_MS`, default ~60s for `fast`, longer for `tier:"long"`), rejecting on expiry so the existing `operation.ts` catch reclaims the charge and serves the mock. Record the chosen constant and its rationale next to `CLAUDE_TIMEOUT_MS`.
- **Value / Risk-if-ignored**: A single slow upstream call silently degrades every paid AI route to an indefinite hang with the token already debited — the worst combination of "billed" + "no result" + "no reclaim." Bounding it converts a hang into the already-handled reclaim+mock path.
- **Effort**: S

## 2. No retry/backoff on transient model errors — one blip burns straight to the deterministic mock
- **Lens**: feature-scout
- **Priority**: High
- **Category**: functionality
- **File**: `src/lib/ai/operation.ts:326-352`; `src/lib/llm/client.ts:62-145`
- **Observation**: `executeAiOperation` calls `llm.generate()` exactly once; any throw (Gemini 429/503, a transient socket reset, a safety-block) is caught at operation.ts:349, the charge is reclaimed, and the route serves the deterministic template (`source:"mock"`). The engines themselves (client.ts geminiClient / claudeClient) have no retry either — they track an `error` event and rethrow. So a momentary rate-limit or a single empty-candidates response permanently downgrades that user's qualification/draft/RFE result to a non-AI template, even though a retry 1-2s later would have succeeded.
- **Proposal**: Add bounded retry-with-jittered-backoff for *transient* classes (HTTP 429/500/503, network errors, empty candidates) inside the engine wrapper — e.g. 2 retries, exponential backoff capped at the per-tier deadline from finding #1. Keep non-transient errors (auth, safety refusal) non-retried. Surface attempts/outcome to `trackLlm` so retry rate is observable.
- **Value / Risk-if-ignored**: This is a metered, paid product where the AI output *is* the value; silently falling to a template on a recoverable blip both wastes the (reclaimed) intent and hands the user a worse deliverable than they paid for. Retry is the single highest-leverage reliability addition.
- **Effort**: M

## 3. The output guard is length-only and non-blocking, so malformed JSON from a JSON route is never caught at the guard layer
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/lib/llm/guards.ts:33` (`LLM_OUTPUT_GUARD = { minWords: 1, maxChars: 50000 }`); `src/lib/llm/guards.ts:44-46`
- **Observation**: `withGuards` runs `lt.trackGuard(output, rules, ...)` and only `console.warn`s on a violation — the output is returned byte-for-byte regardless (guards.ts:44-47, documented "NON-BLOCKING"). The single shared rule checks only non-empty + ≤50000 chars; the richer `guard()` engine supports `json`/`jsonKeys` (lighttrack.ts:149-164) but the app opts out "by design" (guards.ts:22-32). The consequence: for the JSON routes (qualify/draft/rfe/evidence), a model emitting a 200-word prose refusal or a truncated `{` passes the guard cleanly, and the *only* thing that catches it is each route's `spec.guard` calling `extractJson` and returning null downstream (operation.ts:357-374). The guard verdict never influences the reclaim/fallback decision — its `ok`/`violations` are discarded except for a warn. The `maxChars:50000` cap is also an undocumented magic number with no recorded reasoning (a long-letter `tier:"long"` draft could plausibly exceed it and get flagged, yet still be returned).
- **Proposal**: Either (a) document explicitly that JSON validity is intentionally delegated to per-route `extractJson` and the guard is observability-only, recording *why* 50000 was chosen and confirming it exceeds the longest legitimate `tier:"long"` output; or (b) thread a per-route `GuardRules` (`json:true, jsonKeys:[...]`) through `withGuards` so JSON routes validate structure at the guard, feeding the verdict into the existing reclaim+mock path instead of discovering the problem only at `extractJson`.
- **Value / Risk-if-ignored**: A reader reasonably assumes "output guards" gate unsafe output; today they gate length only, and a wrong/garbled JSON response is detected late and inconsistently. The unrecorded 50k cap risks a false flag on legitimate long letters.
- **Effort**: M

## 4. Surface the resolved model + config and add cost/latency telemetry that doesn't zero out on the Claude path
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: user_benefit
- **File**: `src/lib/llm/config.ts:38` (default `gemini-3-flash-preview`); `src/lib/llm/client.ts:113-131` (Claude path tracks `inputTokens:0, outputTokens:0`)
- **Observation**: The production default model is a hardcoded `"gemini-3-flash-preview"` — a *preview* id baked into code, overridable only via `GEMINI_MODEL`/`GEMINI_DRAFT_MODEL` env (config.ts:37-40), with no surfacing of which model actually resolved for a given request beyond the `source:"gemini"` label (label.ts). On the Claude CLI path, `trackLlm` is always emitted with `inputTokens:0, outputTokens:0` because text-mode CLI gives no usage (client.ts:118-130), so any margin/cost dashboard reading those events sees Claude as free — a misleading zero rather than an explicit "usage unknown" signal.
- **Proposal**: (1) Pin the production model to a stable (non-preview) id or make the preview choice a recorded decision; expose the resolved model id (and tier) on the response/telemetry so operators can confirm what ran. (2) On the Claude path, tag the event with a `usage:"unmetered-cli"` marker (or omit usage) so cost dashboards distinguish "zero cost" from "cost unknown."
- **Value / Risk-if-ignored**: Shipping on a preview model is a stability/billing risk that can change behavior under you; zero-token Claude events quietly corrupt margin reporting. Both undercut the observability story this layer is supposed to provide.
- **Effort**: S

## 5. The multimodal `requiresImages` downgrade is silent — an image op falls back to text-only Gemini (or mock) with no signal
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: trade-off
- **File**: `src/lib/llm/engines.ts:53-59` (`selectEngine` → `requiresImages` branch)
- **Observation**: When `requiresImages:true` and the configured engine is `claude`, `selectEngine` silently swaps to Gemini if `GEMINI_API_KEY` is set, else returns `null` (engines.ts:55-57). Nothing is logged or tracked, and the caller can't tell whether its image operation actually got an image-capable engine or was quietly downgraded to a text-only fallback / mock. The doc (llm-engines.md:32-37) notes "no operation sends images today; this guards the future Document AI / OCR work" — so this is a forward-looking guard whose failure mode is exactly the kind that bites silently later: a future evidence/OCR route runs, gets `null` or a text-only path, and produces a confident-but-image-blind result with no breadcrumb.
- **Proposal**: When `selectEngine` downgrades or drops an engine because of `requiresImages`, emit a one-line warn and/or a `trackLlm`-style event (e.g. `status:"error"`, reason `images-unsupported-engine`) so the downgrade is observable. Document the intended caller contract: must an image op refuse rather than silently run text-only when no image engine is available?
- **Value / Risk-if-ignored**: Costs nothing today (no image ops), but the moment Document AI/OCR ships, a misconfigured engine yields image-blind output indistinguishable from a real analysis — a wrong result in a legal-petition context with zero trace.
- **Effort**: S
