> Total: 5 | Critical: 0 | High: 2 | Medium: 2 | Low: 1
> Context: RFE Response Drafting
> Lens mix: bug-hunter 3, ui-perfectionist 2

## 1. Forecast charges 5 tokens, then returns an empty radar for an all-"None" / no-relied-on petition
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: token billing / charge-without-output
- **File**: src/features/rfe/forecastOperation.ts:109-124 (inline) + src/features/rfe/rfe.ts:410-428 (mockRfeForecast) + src/lib/ai/operation.ts:263-320 (charge-before-mock)
- **Scenario**: A user clicks "Forecast RFE risk" on a case (or inline payload) whose criteria are all `None` — or all blank-status — so nothing is relied-on. The inline `parse` gate only rejects `criteria.length === 0`; an array of `None` criteria passes. The orchestrator charges 5 tokens at stage 4, then at stage 5 (no engine, or `tryParseRfeForecast`→null) calls `mockRfeForecast`, which filters to `isRelied` and yields `[]`. `build` returns `{ challenges: [] }`. The radar renders "No relied-on criteria to forecast yet." — after the debit.
- **Root cause**: The "is there anything to forecast?" check (`isRelied` filter) lives downstream of the charge, and the pre-charge `parse` validates only array length, not that at least one criterion is relied-on. The responder has the analogous shape but its mock always emits opening+fallback+closing, so it never returns truly empty; the forecast genuinely can.
- **Impact**: The user pays the heavy `rfe` op price for a zero-row result with no actionable output. On a real petition this is rare, but a mis-scored case (everything `None`) burns tokens and shows an empty card — a money-truth violation (charged-for-nothing) that erodes trust on a paid path.
- **Fix sketch**: In `forecastOperation.parse`, after building `req`, reject (400, no charge) when `req.criteria.every((c) => !isRelied(c.status))` with a message like "No relied-on criteria to forecast — score at least one Met/Strong/Partial." Apply on both the inline and DB legs. Export `isRelied` (or a `hasReliedCriteria(req)` helper) from rfe.ts for reuse.

## 2. RfeStudio "Regenerate" button is NOT disabled during the in-flight charged call (only the synchronous ref guards)
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: disabled-state / double-submit affordance
- **File**: src/features/rfe/components/RfeStudio.tsx:189-195 + 105-112
- **Scenario**: After a first draft (`status === "done"`), the button label becomes "Regenerate response". The user clicks it; `status` flips to `"loading"` so `disabled={status === "loading"}` engages — but a second, near-instant click in the SAME render (before React commits `loading`) is stopped only by `busyRef.current`. That ref guard is correct and prevents a double POST, but the button never visibly disables on that first click, and during a slow regenerate the rendered control depends entirely on `status` having committed. The Forecast and Reinforce buttons share the identical `disabled={status === "loading"}` / `disabled={reinforcing !== null}` pattern.
- **Root cause**: The visible disabled state is derived from async React state (`status`), while the actual race protection is the synchronous `busyRef`. The two are not kept in lockstep — the ref blocks the request but does not drive the `disabled` attribute, so there is a one-render window where the button looks live but is inert.
- **Impact**: No double-charge (the ref holds), but a confusing UX: a click during the gap appears to do nothing (no spinner, no disable), inviting frantic re-clicks on a control the user believes costs tokens. Low-risk functionally; real polish gap on a money button.
- **Fix sketch**: Disable on the ref OR the status: track an in-flight boolean in state set synchronously alongside `busyRef`, and use `disabled={busy || status === "loading"}`. Simplest: add `const [busy, setBusy] = useState(false)`, set it true/false in `generate`'s try/finally, and OR it into every paid button's `disabled`.

## 3. Forecast DB path is hardcoded owner-only (`email: null`) — the attorney-of-record can forecast nothing the responder lets them draft
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: access gate / capability divergence
- **File**: src/features/rfe/forecastOperation.ts:70 vs src/app/api/rfe/route.ts:73
- **Scenario**: The RFE responder builds `CaseAccess = { userId, email: user.email ?? null }`, so `resolveCase` can authorize an explicitly allow-listed attorney of record (the intended cross-tenant leg). The forecast spec builds `CaseAccess = { userId: user.id, email: null }` — email is hardcoded `null`. An attorney who can draft an RFE response on a case gets 403 from the Risk Radar for the same case.
- **Root cause**: Copy divergence: the forecast `parse` did not thread `user.email` into `CaseAccess`, collapsing the configured-attorney leg. This is fail-CLOSED (more restrictive, never a demo fall-through), so it is NOT a regression of the known anti-pattern — but it is an inconsistent capability surface for the same role on the same case.
- **Impact**: Attorneys of record lose the pre-filing Risk Radar on cases they otherwise fully service; surprising 403s and a feature-parity gap between two sibling paid ops. No security hole (it errs toward denial).
- **Fix sketch**: Use `{ userId: user.id, email: user.email ?? null }` in `forecastOperation.parse`, matching route.ts. If forecast is intentionally owner-only, document that decision in the spec header so the divergence is deliberate, not accidental.

## 4. RfeStudio has no empty-criteria guidance — a case with zero/all-"None" criteria silently drafts a contentless boilerplate response
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: empty state / missing guidance
- **File**: src/features/rfe/components/RfeStudio.tsx:176-199 + src/features/rfe/rfe.ts:275-285 (mockRfe fallback)
- **Scenario**: The studio renders the textarea + "Draft RFE response" with no awareness of how many addressable criteria exist. If the case has no criteria (or all `None`), `mockRfe` emits only opening + the generic "Additional evidence" placeholder + closing — a response that addresses none of the petition's actual strengths. The UI gives the user no signal that the result will be hollow before they spend 5 tokens.
- **Root cause**: The component never inspects `criteria` for addressable content; it only validates `rfeText` length client-side. There is no empty/low-signal pre-flight state distinct from the normal idle state.
- **Impact**: User pays for a near-empty draft and only discovers it after the charge. On a real filed case there are usually criteria, but the qualify→draft flow can produce all-`None`/Partial-only states, making this reachable. Sibling concern to finding #1 on the responder side.
- **Fix sketch**: Compute `addressableCount` from `criteria` (Met/Strong/Partial) in the studio; when it is 0, show an inline hint near the button ("This case has no scored criteria to reinforce yet — add evidence first") and consider disabling Draft, mirroring how DraftStudio surfaces `undrafted` criteria.

## 5. Forecast error state offers no retry path and discards the disclaimer; Reinforce token cost shown as bare "5"
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: error UX / polish / clarity
- **File**: src/features/rfe/components/RfeRiskRadar.tsx:111-118, 122, 156-158
- **Scenario**: On a forecast failure the radar shows a static "Could not forecast RFE risk — please try again." alert but the only retry is the main "Forecast RFE risk" button, which is rendered above and still labeled for a fresh run — fine, but the error block has no inline retry affordance and (unlike RfeStudio) no `aria-live` continuity beyond `role="alert"`. Separately, the Reinforce button shows token cost as a bare `5` chip with no unit, where the primary Forecast button shows "5 tokens" — inconsistent cost labeling on adjacent paid actions.
- **Root cause**: Minor UX inconsistency between the two sibling controls; the Reinforce chip drops the "tokens" word that the Forecast chip carries, and the error path relies on the user re-finding the top button.
- **Impact**: Cosmetic. A user could misread the bare "5" on Reinforce as a count/rank rather than a token cost; the error path is recoverable but slightly clumsy. No correctness or billing impact.
- **Fix sketch**: Make the Reinforce chip read "5 tokens" (or add an aria-label "Costs 5 tokens") to match Forecast; optionally add a small inline "Try again" button inside the error alert that re-invokes `forecast()`.
