# Code Refactor — Domain Event Bus
> Total: 5 (C0/H2/M2/L1)

Scope: `src/lib/events/{bus,store-events,types,index,provenance}.ts` + `subscribers/{attorney-notify,audit-log}.ts` + their `.test.ts`. (`subscribers/analytics.ts` listed in the task does NOT exist on disk; nothing references it — no finding, just noted.) Grounding respected: `toAuditRecord` reuse, bounded provenance window, `resolveNotifyFn` fallback, dormant `registerAuditLog`, and barrels are all intentional and NOT flagged.

## 1. `EvidenceUploaded.name` is a dead payload field — emitted but read nowhere
- **Severity**: High
- **Category**: dead-code
- **File**: src/lib/events/types.ts:43 (declaration) + src/lib/events/store-events.ts:115 (population)
- **Scenario**: `EvidenceUploaded` declares `name: string` (types.ts:43) and the Store decorator populates it from `doc.name` (store-events.ts:115). No consumer ever reads it. Grep across the whole tree for any reader of the event's `name`:
  - `Grep "event\.name|\.name\b"` in `src/lib/events` → the ONLY hit is the write at `store-events.ts:115`; zero reads.
  - `toAuditRecord`'s `EvidenceUploaded` branch (audit-log.ts:47–56) projects `documentId / exhibit / criterion / source` and deliberately omits `name`, so provenance/audit never see it.
  - `attorney-notify` only handles `CaseStatusChanged`; the subscribers/store-events tests assert the full event shape but no path consumes `name` downstream.
- **Root cause**: The field was added to the event contract but the single projection (`toAuditRecord`) that turns events into durable records never adopted it, so it became a write-only field.
- **Impact**: A documented-but-unused field on the discriminated union and on the hot publish path. Misleads readers into thinking document names are auditable/notifiable when they are silently dropped; widens the event surface for no consumer. Every `addCaseDocument` mutation copies a string that goes nowhere.
- **Fix sketch**: Either (a) remove `name` from `EvidenceUploaded` and the `store-events.ts:115` payload (smallest, honest), or (b) if document names *should* be in the audit trail, add `name` to the `EvidenceUploaded` branch of `toAuditRecord` so it actually lands in provenance. Pick one; today's state is the worst of both. Drop the now-unused `name` from the subscribers test fixture if (a).

## 2. `CaseStatusChanged` publish payload is duplicated across two Proxy branches
- **Severity**: High
- **Category**: duplication
- **File**: src/lib/events/store-events.ts:61–68 and src/lib/events/store-events.ts:77–84
- **Scenario**: `setCaseStatus` (lines 61–68) and `transitionCase` (lines 77–84) each hand-build a `CaseStatusChanged` event with the same five-field shape (`type/at/caseId/status/receiptNumber/guarded`), differing only in `guarded: false` vs `guarded: true` and where `caseId/status/receiptNumber` come from. Both literals must stay byte-for-byte in sync with the `CaseStatusChanged` interface in types.ts.
- **Root cause**: No constructor/factory for the event; each call site assembles the literal inline.
- **Impact**: Real divergence risk — if `CaseStatusChanged` gains a field (or `at` sourcing changes), one branch can be updated and the other forgotten, producing two subtly different "same" events. This is exactly the class of duplication the severity rubric calls out (duplicated logic that can drift).
- **Fix sketch**: Add a small local builder, e.g. `const caseStatusChanged = (caseId, status, receiptNumber, guarded): CaseStatusChanged => ({ type: "CaseStatusChanged", at: now(), caseId, status, receiptNumber, guarded });` and call it from both branches. One source for the shape; the two branches keep only their distinct args.

## 3. Two independent 5-second timeout constants with no shared meaning
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/events/bus.ts:36 (`DEFAULT_HANDLER_TIMEOUT_MS = 5_000`) and src/lib/events/subscribers/attorney-notify.ts:39 (`WEBHOOK_TIMEOUT_MS = 5000`)
- **Scenario**: The bus caps each handler at 5 s; the attorney-notify webhook independently aborts its fetch at 5 s. `Grep "5000|5_000|TIMEOUT_MS"` in `src/lib/events` returns exactly these two declarations. They are conceptually coupled — the webhook timeout MUST be ≤ the handler timeout or the bus reports "timed out" while the fetch is still running, yet nothing in code expresses or enforces that relationship, and they're even written with different numeric literal styles (`5_000` vs `5000`).
- **Root cause**: Each module picked its own magic number; the ordering invariant lives only in a human's head.
- **Impact**: A future edit to one (e.g. bumping the bus timeout to 10 s, or the webhook to 8 s) silently breaks the "webhook ≤ handler" relationship, producing confusing double-reported failures (`subscriber timed out` AND `NOT DELIVERED`). Two values that should move together can drift apart.
- **Fix sketch**: Derive the webhook timeout from, or assert it against, the bus default — e.g. export `DEFAULT_HANDLER_TIMEOUT_MS` and set `WEBHOOK_TIMEOUT_MS` slightly below it, or at minimum normalise the literal style and add a one-line comment in attorney-notify stating it must stay under the bus handler timeout. Smaller than #1/#2, hence Medium.

## 4. `index.ts` singleton comment claims `EventBus.clear()` is the test-reset path, but no test uses it that way
- **Severity**: Medium
- **Category**: cleanup
- **File**: src/lib/events/index.ts:17–19
- **Scenario**: The comment states: "tests that want a clean bus construct `new EventBus()` directly (and use `EventBus.clear()`); nothing exercises this singleton across test cases." Grep shows every test constructs a fresh `new EventBus()` per case (bus.test.ts, store-events.test.ts, subscribers.test.ts, provenance.test.ts); `bus.clear()` is invoked in exactly ONE place — the `"clear() removes all subscribers"` unit test (bus.test.ts:143) that *tests* `clear`, not as a reset between unrelated cases. So the parenthetical "(and use `EventBus.clear()`)" describes a workflow that isn't real.
- **Root cause**: Comment drifted from the actual test strategy (per-case fresh instances), conflating "there is a `clear()` method" with "tests use `clear()` to reset the singleton."
- **Impact**: Misleading documentation at the most-read seam in the subsystem (the singleton factory). A reader could believe a singleton-reset convention exists and write tests against it; the truth is the opposite (fresh instance per test). Low-risk but actively misinforming.
- **Fix sketch**: Trim the parenthetical to match reality, e.g. "tests that want a clean bus construct `new EventBus()` directly; nothing resets this singleton across cases." Keeps the (correct) point that there's intentionally no teardown export.
## 5. `at` ISO-8601 emit time is documented in three places, defined nowhere shared
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/events/types.ts:11 + src/lib/events/store-events.ts:42–44 (`wallClock`) + repeated `at: now()` in all four publish branches (store-events.ts:63,79,98,113)
- **Scenario**: `at` is described as "ISO-8601 emit time" in the types.ts header (line 11), produced by `wallClock = () => new Date().toISOString()` (store-events.ts:44), and threaded as `at: now()` into each of the four publish literals. The "must be ISO-8601" contract is restated in prose but the four `at: now()` repetitions are a minor pattern echo of the same per-event timestamp stamping.
- **Root cause**: Per-branch literal construction (same root as #2) means the timestamp call is copy-pasted four times rather than stamped once.
- **Impact**: Cosmetic — folding the `at` stamping into the single event-builder from finding #2 would eliminate three of the four `now()` call sites and make "every event is stamped with one clock read" structurally obvious rather than convention. No behavioural issue today.
- **Fix sketch**: Resolve as a natural by-product of #2 — once a `caseStatusChanged()` builder (and optionally a tiny `stamp(partial)` helper for the other two event types) owns `at: now()`, the four scattered `at: now()` literals collapse. Purely tidy-up; lowest priority.
