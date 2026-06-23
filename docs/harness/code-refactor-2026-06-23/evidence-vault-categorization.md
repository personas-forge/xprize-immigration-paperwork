# Code Refactor — Evidence Vault & Categorization
> Total: 5 (C0/H2/M2/L1)

> Note: the prompt's `src/lib/data/documents.ts` does not exist. The evidence data
> layer is `src/lib/data/evidence.ts` (analyzed). The categorize route was verified
> to route through `executeAiOperation` (`src/lib/ai/operation.ts`) — the
> auth→rate-limit→charge preamble is NOT copy-pasted, so it is correctly NOT flagged.

## 1. `parseCategorizeResponse` is dead production code (only its own test keeps it alive)
- **Severity**: High
- **Category**: dead-code
- **File**: src/features/evidence/evidence.ts:175-181
- **Scenario**: `parseCategorizeResponse(text, req, classification)` returns
  `tryParseCategorizeResponse(text, classification) ?? mockCategorize(req, classification)`.
  Grep across `src/` (`grep -rn parseCategorizeResponse`) shows the only references
  are: its definition, the barrel re-export (`index.ts:12`), and three uses inside
  its own `evidence.test.ts` (lines 11, 79, 86, 88). **No route, component, action,
  or non-test module calls it.** The live route (`api/evidence/categorize/route.ts`)
  deliberately wires the two halves SEPARATELY into the orchestrator —
  `guard: tryParseCategorizeResponse` and `mock: mockCategorize` — because it must
  distinguish a real model parse from a silent fallback (to reclaim the charge). The
  combined helper erases exactly that distinction, so production cannot use it.
- **Root cause**: The function predates the `tryParse…`/`mock` split that the
  charge-reclaim path required; once the route stopped calling it, the only thing
  exercising it became the test written against it.
- **Impact**: A public, exported, barrel-surfaced function that looks like the
  canonical "normalize a model response" entry point but is never used. New code may
  reach for it and reintroduce the very billing bug (`mock` billed as model output)
  the route split away from. ~7 LOC + a test that asserts dead behaviour.
- **Fix sketch**: Delete `parseCategorizeResponse`, its barrel export, and the two
  tests that target it (keep the `tryParseCategorizeResponse` + `mockCategorize`
  tests, which cover the live behaviour). If a combined helper is wanted for
  documentation, mark it `@deprecated` — but deletion is cleaner since the split
  semantics are the contract the route depends on.

## 2. `Ex. ${ord}` exhibit-label format is triplicated across both stores and the client
- **Severity**: High
- **Category**: duplication
- **File**: src/features/evidence/components/EvidenceVault.tsx:111 (+ src/lib/db/pglite-store.ts:766, src/lib/db/firestore-store.ts:623)
- **Scenario**: The persisted exhibit label is built as the literal
  `` `Ex. ${ord}` `` in **three** independent places — `pglite-store.ts:766`,
  `firestore-store.ts:623`, and the client `EvidenceVault.tsx:111`
  (`const nextExhibit = ` `` `Ex. ${nextOrdinal}` ``). The client even carries a
  comment admitting the coupling: *"Mirror the persisted 'Ex. N' format the stores
  assign (pglite/firestore `Ex. ${ord}`)…"* (lines 108-110). The client ALSO
  reverse-engineers the ordinal back out of the saved string with
  `parseInt(String(d.exhibit).replace(/\D/g, ""), 10)` (line 105) to compute the
  next optimistic number. Grep (`` grep -rn '`Ex\. \$\{' src `` and
  `grep -rn formatExhibit|EXHIBIT_PREFIX src`) confirms there is no shared
  `formatExhibit`/`EXHIBIT_PREFIX` helper.
- **Root cause**: The label-formatting rule (prefix `"Ex. "` + ordinal) was never
  given a single home; each producer (two store drivers + the optimistic client
  path) re-encodes it by hand.
- **Impact**: Divergence hazard. If the prefix is ever changed (e.g. `"Exhibit "`),
  any spot missed leaves the optimistic client ordinal reading differently from
  saved siblings — the exact mismatch the comment was added to prevent (evidence #2)
  — and the client's `/\D/g` re-parse silently breaks if the format gains digits.
- **Fix sketch**: Add `formatExhibit(ord: number): string` (and, if the client still
  needs the inverse, `parseExhibitOrdinal(label): number`) to the server-free
  `src/features/evidence/` surface (e.g. beside `types.ts`), and have both stores
  and the component call it. One definition of the exhibit label, used everywhere.

## 3. `evidence.ts` pulls `DISCLAIMER` through the back-compat re-export, not its canonical home
- **Severity**: Medium
- **Category**: structure
- **File**: src/features/evidence/evidence.ts:21
- **Scenario**: `import { DISCLAIMER } from "@/features/guidance/guidance";` then
  re-exports it (line 26). But `@/lib/result.ts:34-41` documents itself as the
  **canonical home** of `DISCLAIMER` ("relocated here from `@/features/guidance/guidance`
  per ADR-0011, byte-identical; `guidance` re-exports it for back-compat"), and
  `guidance.ts:32` only re-exports it. The sibling client component
  `EvidenceVault.tsx:7` already imports `DISCLAIMER` from the canonical
  `@/lib/result`. So the evidence module reaches the same string through a
  back-compat hop the rest of the feature avoids.
- **Root cause**: `evidence.ts` was written against the old guidance location and not
  repointed when ADR-0011 moved the canonical source to `@/lib/result`.
- **Impact**: No behavioural bug (byte-identical re-export), but it routes a
  compliance-critical constant through a layer explicitly labelled "back-compat,"
  obscuring the real dependency and keeping that re-export load-bearing. Inconsistent
  with the adjacent component reading from the documented home.
- **Fix sketch**: Change the import to `import { DISCLAIMER } from "@/lib/result";`
  (and likewise the `O1A_CRITERIA`/`criteriaNames` re-exports are from
  `@/features/qualification`, which is correct — leave those). Aligns the whole
  evidence feature on canonical import sources.

## 4. Magic `6` (sibling-name cap) hardcoded twice in `summarizeVaultBuckets`, while every neighbour bound is named
- **Severity**: Medium
- **Category**: cleanup
- **File**: src/features/evidence/evidence.ts:98-99
- **Scenario**: `summarizeVaultBuckets` caps how many sibling names it lists per
  bucket: `names.slice(0, 6)` then `names.length > 6 ? ` (+${names.length - 6} more)`.
  The literal `6` appears three times across two lines with no name. The module
  otherwise names every input/output bound — `MAX_NAME`, `MIN_CONTENT`,
  `MAX_CONTENT` (exported), and `MAX_FACTS = 6` (line 51) right above. (The two
  values are coincidentally both 6 but are unrelated caps — sibling-names-per-bucket
  vs facts-per-doc — so they must not be merged.)
- **Root cause**: The bucket-summary cap was added inline without lifting it to a
  named constant the way the surrounding bounds are.
- **Impact**: Low correctness risk, but the bare `6` reads as if it might be the
  same `MAX_FACTS` cap; the prompt-size bound it actually controls is invisible and
  un-greppable. Tuning it means editing three magic literals in lock-step.
- **Fix sketch**: `const MAX_BUCKET_NAMES = 6;` near the other bounds and use it in
  all three spots, so the prompt-bounding intent is named and changed in one place.

## 5. `.slice(0, 240)` fact-truncation length duplicated as a bare literal in two functions
- **Severity**: Low
- **Category**: cleanup
- **File**: src/features/evidence/evidence.ts:168, 199
- **Scenario**: Both `tryParseCategorizeResponse` (line 168, `.map((f) => f.trim().slice(0, 240))`)
  and `mockCategorize` (line 199, `.map((s) => s.slice(0, 240))`) clamp each
  extracted fact to 240 chars. The `240` is an unnamed literal in both — and these
  two paths are the model-parse and the deterministic-fallback halves of the SAME
  fact-extraction contract, so they are meant to truncate identically. `MAX_FACTS`
  is a named constant two lines above the first use; this per-fact length is not.
- **Root cause**: Per-fact length cap introduced inline in each function rather than
  shared.
- **Impact**: Cosmetic, but the two must stay in sync (model facts and mock facts
  should clamp the same), and a future change risks updating only one — making
  mock-vs-model facts truncate differently. Un-named, so the intent ("max fact
  length") isn't discoverable.
- **Fix sketch**: `const MAX_FACT_LEN = 240;` beside `MAX_FACTS` and reference it in
  both `.slice(0, MAX_FACT_LEN)` calls.
