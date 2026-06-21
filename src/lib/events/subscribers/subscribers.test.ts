import assert from "node:assert/strict";
import { test } from "node:test";

import { EventBus } from "../bus";
import type {
  CaseStatusChanged,
  DraftGenerated,
  EvidenceUploaded,
} from "../types";
import { registerAuditLog, toAuditRecord, type AuditRecord } from "./audit-log";
import {
  registerAttorneyNotify,
  resolveNotifyFn,
  shouldNotify,
  toNotification,
  type AttorneyNotification,
} from "./attorney-notify";

const AT = "2026-06-04T00:00:00.000Z";

const statusEvent = (status: string, guarded = false): CaseStatusChanged => ({
  type: "CaseStatusChanged",
  at: AT,
  caseId: "c1",
  status,
  guarded,
});
const draftEvent: DraftGenerated = {
  type: "DraftGenerated",
  at: AT,
  caseId: "c1",
  version: 2,
  source: "gemini",
  sectionCount: 4,
};
const evidenceEvent: EvidenceUploaded = {
  type: "EvidenceUploaded",
  at: AT,
  caseId: "c1",
  documentId: "d1",
  name: "f.pdf",
  criterion: "Awards",
  exhibit: "Exhibit 1",
  source: "mock",
};

// ── audit-log ────────────────────────────────────────────────────────────────

test("audit projects each event type onto its detail fields", () => {
  assert.deepEqual(toAuditRecord(draftEvent), {
    event: "DraftGenerated",
    caseId: "c1",
    at: AT,
    detail: { version: 2, source: "gemini", sectionCount: 4 },
  });
  assert.deepEqual(toAuditRecord(evidenceEvent).detail, {
    documentId: "d1",
    exhibit: "Exhibit 1",
    criterion: "Awards",
    source: "mock",
  });
});

test("audit subscriber records every event through the injected sink", async () => {
  const bus = new EventBus();
  const records: AuditRecord[] = [];
  registerAuditLog(bus, (r) => records.push(r));

  await bus.publish(statusEvent("Filed"));
  await bus.publish(draftEvent);
  await bus.publish(evidenceEvent);

  assert.deepEqual(
    records.map((r) => r.event),
    ["CaseStatusChanged", "DraftGenerated", "EvidenceUploaded"],
  );
});

// ── attorney-notify ──────────────────────────────────────────────────────────

test("resolveNotifyFn: no webhook URL → console default (does not POST)", async () => {
  let posted = false;
  const sink = resolveNotifyFn({}, { fetchImpl: (async () => ((posted = true), new Response("", { status: 200 })) ) as unknown as typeof fetch });
  await sink({ caseId: "c1", status: "Filed", at: AT, reason: "x" });
  assert.equal(posted, false, "with no URL configured nothing is POSTed");
});

test("resolveNotifyFn: webhook URL set → POSTs notification + recipients; non-2xx throws", async () => {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;
  const sink = resolveNotifyFn(
    { ATTORNEY_NOTIFY_WEBHOOK_URL: "https://hook.example/notify", ATTORNEY_EMAILS: "a@firm.com,b@firm.com" },
    { fetchImpl },
  );
  await sink({ caseId: "c1", status: "RFE", at: AT, reason: "status update" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://hook.example/notify");
  assert.deepEqual((calls[0].body as { recipients: string[] }).recipients, ["a@firm.com", "b@firm.com"]);
  assert.equal((calls[0].body as { caseId: string }).caseId, "c1");

  // a non-2xx must throw so registerAttorneyNotify logs NOT-DELIVERED
  const failing = resolveNotifyFn(
    { ATTORNEY_NOTIFY_WEBHOOK_URL: "https://hook.example/notify" },
    { fetchImpl: (async () => new Response("", { status: 500 })) as unknown as typeof fetch, recipients: () => [] },
  );
  await assert.rejects(() => Promise.resolve(failing({ caseId: "c1", status: "Filed", at: AT, reason: "x" })));
});

test("shouldNotify matches the notify-worthy statuses case-insensitively", () => {
  assert.equal(shouldNotify("In Review"), true);
  assert.equal(shouldNotify("  filed "), true);
  assert.equal(shouldNotify("Intake"), false);
  assert.equal(shouldNotify("Drafting"), false);
});

test("toNotification returns null for non-notify statuses", () => {
  assert.equal(toNotification(statusEvent("Drafting")), null);
  const n = toNotification(statusEvent("Filed", true));
  assert.deepEqual(n, {
    caseId: "c1",
    status: "Filed",
    at: AT,
    reason: "guarded transition",
  });
});

test("attorney-notify fires the sink only for notify-worthy transitions", async () => {
  const bus = new EventBus();
  const sent: AttorneyNotification[] = [];
  registerAttorneyNotify(bus, (n) => sent.push(n));

  await bus.publish(statusEvent("Drafting")); // ignored
  await bus.publish(statusEvent("Filed")); // notified
  await bus.publish(draftEvent); // wrong type — ignored

  assert.equal(sent.length, 1);
  assert.equal(sent[0].status, "Filed");
});

// ── integration: both default subscribers on one bus ─────────────────────────

test("audit + attorney coexist on one bus", async () => {
  const bus = new EventBus();
  const audit: AuditRecord[] = [];
  const notified: AttorneyNotification[] = [];
  registerAuditLog(bus, (r) => audit.push(r));
  registerAttorneyNotify(bus, (n) => notified.push(n));

  await bus.publish(statusEvent("Submitted"));
  await bus.publish(evidenceEvent);

  assert.equal(audit.length, 2);
  assert.equal(notified.length, 1);
});
