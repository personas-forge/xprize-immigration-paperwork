> Total: 5 | Critical: 0 | High: 1 | Medium: 3 | Low: 1
> Context: USCIS Form-Field Guidance
> Lens mix: bug-hunter 3, ui-perfectionist 2

## 1. Guidance route skips the live UPL / legal-advice gate that `runAdjudication` supports for it
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: Compliance / UPL safety-gate not wired
- **File**: src/app/api/guidance/route.ts:36-69 (no `adjudicate`); src/lib/llm/adjudication-gates.ts:399-401 (`case "guidance"`)
- **Scenario**: A user types a leading situation ("am I going to get approved for O-1A?"). Gemini answers with outcome/advice language ("you will likely qualify…", "you should file…"). The response ships to the panel with no risk flag.
- **Root cause**: `executeAiOperation` only runs the live adjudication gate when the spec provides an `adjudicate` callback. The `rfe` and `qualify` routes both wire `adjudicate: runAdjudication(...)` (rfe/route.ts:130, qualify/route.ts:72). The guidance route omits it entirely — yet `runAdjudication` has an explicit `case "guidance"` that runs `disclaimerGate` + `legalAdviceGate` (the UPL tripwire: `matchedAdvice`/`affirmsOutcomeGuarantee`). The one safeguard the engine built for guidance is never invoked on the guidance path.
- **Impact**: Of the five AI routes, guidance is the most exposed to "tell me what to do" prompts, yet it is the only token-charged route whose model output bypasses live UPL screening. The static `DISCLAIMER` is still attached (data contract holds), but advice/outcome language is shown to the user unflagged — the exact UPL risk the disclaimer exists to mitigate, with no `AdjudicationBadge` warning and no `risk: "blocked"`.
- **Fix sketch**: Add `adjudicate: (guidance, input, source, body) => runAdjudication({ operation: "guidance", classification: "", source, result: body, inputText: \`${input.fieldLabel} ${input.situation}\`, outputText: guidance })` to the guidance spec (mirroring qualify), and surface the returned report in `FieldGuidancePanel` via `AdjudicationBadge` as the other studios do.

## 2. The prompt's "3–6 short sentences" constraint is unenforced on the live output
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: Output-constraint not validated (eval/live drift)
- **File**: src/features/guidance/guidance.ts:111 (constraint); src/app/api/guidance/route.ts:56-59 (`guard` only checks non-blank); src/lib/llm/adjudication-gates.ts:201 (`sentenceCount` exists, unused for guidance)
- **Scenario**: Gemini ignores rule 4 and returns 12 sentences with headings/preamble. `guard` only trims and rejects blank, so the verbose, non-conformant answer is billed and rendered as-is.
- **Root cause**: The concise-sentence constraint lives only as prose inside the prompt. The repo already ships a deterministic `sentenceCount(text)` helper, but it is wired into no guidance check (live or eval) — nothing counts the sentences of the live guidance output, so the constraint is advisory only.
- **Impact**: Quality drift on a paid, legal-adjacent surface: a long, headed, preamble-laden answer reads more like authoritative legal advice than the intended terse informational note, undercutting the UPL posture and the panel's compact layout. The "eval gate counts sentences" expectation is not actually applied to this output.
- **Fix sketch**: In `guard`, return null (→ reclaim + mock) or trim-to-N when `sentenceCount(text)` is outside 3–8 (small tolerance over the prompt's 6); or add a `warn` gate to the guidance adjudication branch so a too-long answer is flagged rather than silently shipped.

## 3. Client trusts the server-echoed `disclaimer`; on the 500 path the UPL string is dropped
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: Error-path / disclaimer rendering
- **File**: src/features/guidance/components/FieldGuidancePanel.tsx:98-109, 243
- **Scenario**: The orchestrator's last-resort mock itself throws and returns `{ error: "generation_failed", disclaimer: DISCLAIMER }` with HTTP 500. The panel takes the `!res.ok` branch, shows the generic red error box, and the `disclaimer` field in that body is never rendered.
- **Root cause**: `DisclaimerStamp` is rendered only in the `done` and `paywall` branches, sourced from `result.disclaimer` (the server echo). The 500 body deliberately carries the disclaimer (UPL invariant in `operation.ts:341`), but the client discards it, and the rendered done-state disclaimer is whatever the server sent rather than the locally-imported `DISCLAIMER` constant — a tampered/empty server value would render verbatim.
- **Impact**: On the rare hard-failure path the UPL safeguard the orchestrator went out of its way to attach is not shown. More broadly, rendering the *server-supplied* disclaimer string (vs the client's own `DISCLAIMER` import, which is already in scope and used on the paywall path) means the panel can't guarantee the exact UPL wording on the result it displays.
- **Fix sketch**: Render `DisclaimerStamp` from the locally-imported `DISCLAIMER` constant (already imported, line 9) on the done state, matching the paywall branch; and surface the disclaimer on the error branch too so the not-legal-advice notice is never absent from a guidance interaction.

## 4. Loading and result regions have no live-region announcement for assistive tech
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: Accessibility (no aria-live / role=status / aria-busy)
- **File**: src/features/guidance/components/FieldGuidancePanel.tsx:201, 240-260
- **Scenario**: A screen-reader user submits, hears nothing while "Generating…" runs, and gets no announcement when the guidance text and its disclaimer appear — they must blindly hunt for the new content.
- **Root cause**: The result skeleton (`GuidanceResultSkeleton`) and the `done` guidance block render with no `aria-live="polite"`/`role="status"` wrapper and no `aria-busy` on the submit region. Grepping the whole `features/` tree shows no `aria-live`/`role="status"` usage at all — the pattern is simply absent. The error and paywall alerts do carry `role="alert"`, but the success path (the primary outcome) is silent.
- **Impact**: On a UPL-sensitive surface, a non-sighted user can miss both the generated guidance and, critically, the not-legal-advice disclaimer that is supposed to be unmissable. WCAG 4.1.3 (Status Messages) failure.
- **Fix sketch**: Wrap the loading + done region in a single `<div role="status" aria-live="polite" aria-busy={status === "loading"}>`, and add an `sr-only` announcement (e.g. "Guidance ready — informational only, not legal advice") so the disclaimer's existence is spoken.

## 5. Situation textarea has no length cap or counter; over-limit is a wasted round-trip
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: Input affordance / responsive feedback
- **File**: src/features/guidance/components/FieldGuidancePanel.tsx:171-178; src/features/guidance/guidance.ts:34,75-81
- **Scenario**: A user pastes a long case history (>4000 chars). They submit, wait, and get the flat red "Input is too long." error with no indication of how long is allowed or how much to trim.
- **Root cause**: The server enforces `MAX_FIELD = 4000` and returns a 400, but the textarea sets no `maxLength` and shows no character counter or inline hint, so the only feedback is a post-submit error with no actionable number.
- **Impact**: Minor friction and a confusing dead-end on an otherwise polished panel; the user can't self-correct without guessing. (Charge happens after parse, so no tokens are lost — hence Low.)
- **Fix sketch**: Add `maxLength={4000}` to the textarea plus a small live "N / 4000" counter under it (and ideally to the form/field selects' free-text equivalents), so the limit is visible before submit and the over-limit state is unreachable.
