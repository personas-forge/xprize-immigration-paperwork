/**
 * Integration tests for the review data layer against the REAL PGlite store.
 *
 * `transitionCase` is the only sanctioned case-status mutator: its compare-and-
 * set plus same-transaction event append is what makes a stale tab, a double
 * click, or a crafted double-POST unable to double-file a case, re-mint a
 * receipt, or desync the append-only review log from the case status. Those
 * guarantees live in SQL (a guarded UPDATE … RETURNING and the event inserts in
 * ONE transaction), so they are pinned here against the embedded Postgres, not
 * a mock. The next/headers-bound authorization gates layered on top live in
 * `features/review/actions.ts` and are NOT tested here (that module can't load
 * under tsx — see owner-only-gate.test.ts and actions.test.ts for its seams).
 *
 * Harness (same trick as pglite-store.test.ts): PGLITE_PATH points at a FRESH
 * temp dir and DB_DRIVER pins the pglite driver BEFORE any module is imported,
 * so `getStore()` resolves the embedded Postgres and never touches a
 * developer's ./.pglite. One PGlite per process; a fresh case per test keeps
 * the cases independent. Going through `getStore()` (rather than the raw
 * driver) exercises the same domain-events-wrapped store production code uses.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PGLITE_PATH = mkdtempSync(join(tmpdir(), "immigration-reviews-"));
process.env.DB_DRIVER = "pglite";

const { addReviewEvent, getReviewEvents, transitionCase } = await import("./reviews");
const { getStore } = await import("@/lib/db/store");

const resolved = await getStore();
if (!resolved) throw new Error("DB_DRIVER=pglite must resolve the PGlite store");
const store = resolved;

let seq = 0;
/** A fresh case per test (created in status 'Intake'); unique users/cases keep
 *  tests independent inside the one shared PGlite. */
async function newCase(): Promise<string> {
  const created = await store.createCaseWithCriteria({
    userId: `reviews-test-user-${seq}`,
    fileNumber: `O1-9${String(seq++).padStart(3, "0")}`,
    petitioner: "Test Petitioner",
    classification: "O-1A",
    approvalLikelihood: 70,
    criteria: [],
  });
  return created.id;
}

type Transition = Parameters<typeof transitionCase>[0];

/** The submit-for-review transition exactly as `submitForReview` shapes it. */
function submit(caseId: string): Transition {
  return {
    caseId,
    fromStatuses: ["Intake", "Drafting"],
    toStatus: "Attorney Review",
    events: [
      {
        authorId: "applicant-1",
        authorRole: "applicant",
        kind: "submitted",
        body: "Submitted to the attorney of record for review.",
      },
    ],
  };
}

/** The sign-and-file transition exactly as `attorneySignAndFile` shapes it:
 *  one CAS from Attorney Review → Filed that records the receipt and appends
 *  the signed + filed pair atomically. */
function signAndFile(caseId: string, receipt: string, demo: boolean): Transition {
  return {
    caseId,
    fromStatuses: ["Attorney Review"],
    toStatus: "Filed",
    receiptNumber: receipt,
    events: [
      {
        authorId: "attorney-1",
        authorRole: "attorney",
        kind: "signed",
        body: "Petition signed by the attorney of record.",
      },
      {
        authorId: "attorney-1",
        authorRole: "attorney",
        kind: "filed",
        body: demo ? "Recorded a DEMO filing (not actually filed with USCIS)." : "Filed with USCIS.",
        metadata: { receipt, demo },
      },
    ],
  };
}

test("transitionCase applies a legal transition and appends its events atomically", async () => {
  const caseId = await newCase();
  assert.equal(await transitionCase(submit(caseId)), true);
  const stored = await store.getCaseAnyOwner(caseId);
  assert.equal(stored?.status, "Attorney Review");
  // The event lands in the SAME write as the status flip — the review thread
  // is the audit trail of who moved the case, so it may never lag the status.
  const events = await getReviewEvents(caseId);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "submitted");
  assert.equal(events[0].authorRole, "applicant");
  assert.equal(events[0].body, "Submitted to the attorney of record for review.");
});

test("transitionCase is compare-and-set: a stale precondition fails and appends NOTHING", async () => {
  // The stale-tab replay: a second "submit for review" arrives after the case
  // already moved. The CAS must refuse the flip AND withhold the events — a
  // phantom second 'submitted' row would desync the audit log from reality,
  // which is exactly what the same-transaction design exists to prevent.
  const caseId = await newCase();
  assert.equal(await transitionCase(submit(caseId)), true);
  assert.equal(await transitionCase(submit(caseId)), false);
  assert.equal((await getReviewEvents(caseId)).length, 1);
  assert.equal((await store.getCaseAnyOwner(caseId))?.status, "Attorney Review");
});

test("sign-and-file records the receipt and both events; a replay cannot double-file or replace the receipt", async () => {
  const caseId = await newCase();
  assert.equal(await transitionCase(submit(caseId)), true);
  assert.equal(await transitionCase(signAndFile(caseId, "EAC2412345678", false)), true);

  const filed = await store.getCaseAnyOwner(caseId);
  assert.equal(filed?.status, "Filed");
  // What sign-and-file claims to record, it recorded: the receipt on the case…
  assert.equal(filed?.receiptNumber, "EAC2412345678");
  // …and the signed+filed pair in the thread. The pair is inserted in the same
  // transaction, so it shares a created_at — assert membership, not intra-pair
  // order (created_at is the only sort key).
  const events = await getReviewEvents(caseId);
  assert.deepEqual(
    events.map((e) => e.kind).sort(),
    ["filed", "signed", "submitted"].sort(),
  );
  const filedEvent = events.find((e) => e.kind === "filed");
  assert.ok(filedEvent);
  // The receipt is duplicated into the event metadata with the demo flag — the
  // UI distinguishes a genuine USCIS receipt from a demo one by THIS record.
  assert.deepEqual(filedEvent.metadata, { receipt: "EAC2412345678", demo: false });

  // A replay from a second tab arrives with a freshly-minted DIFFERENT receipt:
  // the case is no longer in Attorney Review, so nothing may apply — the real
  // receipt survives and the log gains no duplicate signed/filed rows. This is
  // the "can't double-file" guarantee attorneySignAndFile leans on.
  assert.equal(await transitionCase(signAndFile(caseId, "WAC0000000000", false)), false);
  assert.equal((await store.getCaseAnyOwner(caseId))?.receiptNumber, "EAC2412345678");
  assert.equal((await getReviewEvents(caseId)).length, 3);
});

test("an empty fromStatuses list can never apply", async () => {
  // Guards the explicit no-source-statuses escape hatch: an empty allowlist
  // must be a semantic no-op, not an unconditioned UPDATE (or a SQL error from
  // an empty IN ()). Whatever the case's current status, nothing may move.
  const caseId = await newCase();
  assert.equal(
    await transitionCase({ caseId, fromStatuses: [], toStatus: "Filed", events: [] }),
    false,
  );
  assert.equal((await store.getCaseAnyOwner(caseId))?.status, "Intake");
});

test("concurrent double-file: exactly one transition wins and one receipt is recorded", async () => {
  // Two tabs race to file the same case with different receipts. The guarded
  // UPDATE runs inside a transaction, so exactly one CAS applies; the loser
  // must neither append its events nor replace the winner's receipt — a case
  // with two 'filed' records or a swapped receipt is a legal-workflow corruption.
  const caseId = await newCase();
  assert.equal(await transitionCase(submit(caseId)), true);
  const receipts = ["EAC1111111111", "WAC2222222222"];
  const outcomes = await Promise.all(
    receipts.map((r) => transitionCase(signAndFile(caseId, r, true))),
  );
  assert.equal(outcomes.filter(Boolean).length, 1);
  const stored = await store.getCaseAnyOwner(caseId);
  assert.equal(stored?.receiptNumber, receipts[outcomes.indexOf(true)]);
  assert.equal((await getReviewEvents(caseId)).length, 3); // submitted + ONE signed/filed pair
});

test("addReviewEvent appends to the thread; getReviewEvents reads oldest-first, scoped by case", async () => {
  // Free-form notes (addReviewNote) append OUTSIDE any transition — the thread
  // must still read back in conversation order, and one case's notes must
  // never bleed into another's.
  const caseId = await newCase();
  await addReviewEvent({
    caseId,
    authorId: "applicant-1",
    authorRole: "applicant",
    kind: "note",
    body: "First note.",
  });
  await addReviewEvent({
    caseId,
    authorId: "attorney-1",
    authorRole: "attorney",
    kind: "note",
    body: "Second note.",
  });
  const events = await getReviewEvents(caseId);
  assert.deepEqual(events.map((e) => e.body), ["First note.", "Second note."]);
  assert.deepEqual(events.map((e) => e.authorRole), ["applicant", "attorney"]);
  assert.deepEqual(await getReviewEvents(await newCase()), []);
});
