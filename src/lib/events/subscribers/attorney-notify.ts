/**
 * Attorney-notification subscriber (ADR-0007).
 *
 * Reacts to `CaseStatusChanged` and turns the milestones an attorney must act
 * on (a case entering review, an RFE arriving, a filed decision) into a
 * notification intent. The actual delivery channel (email/queue) is injected as
 * a `NotifyFn` sink so this module stays pure and testable; the default logs.
 *
 * Which statuses warrant a nudge is intentionally data-driven (`NOTIFY_ON`) so
 * the vocabulary can grow without touching the bus or the Store.
 */

import { attorneyAllowlist } from "@/lib/auth/roles";
import { type EventBus, DEFAULT_HANDLER_TIMEOUT_MS } from "../bus";
import type { CaseStatusChanged } from "../types";

export interface AttorneyNotification {
  caseId: string;
  status: string;
  at: string;
  reason: string;
}

export type NotifyFn = (notification: AttorneyNotification) => void;

/**
 * Statuses (case-insensitive) that should ping an attorney. Free-form case
 * statuses are validated in app code; this set is the notify-worthy subset.
 */
export const NOTIFY_ON: ReadonlySet<string> = new Set(
  ["In Review", "Submitted", "RFE", "Filed", "Decision"].map((s) =>
    s.toLowerCase(),
  ),
);

const defaultNotify: NotifyFn = (n) =>
  console.info(`[attorney-notify] ${n.caseId} → ${n.status} (${n.reason})`);

// Must stay UNDER the bus handler timeout so the fetch aborts before the bus
// reports this subscriber as timed out (else a slow webhook double-reports
// failure: "subscriber timed out" AND "NOT DELIVERED"). Derived, not a second
// magic 5000, so the ordering invariant can't silently break.
const WEBHOOK_TIMEOUT_MS = DEFAULT_HANDLER_TIMEOUT_MS - 500;

/**
 * Resolve the ACTIVE delivery sink. When an operator sets
 * `ATTORNEY_NOTIFY_WEBHOOK_URL`, each notification is delivered for real by POSTing
 * it as JSON (provider-agnostic — point it at Resend/SendGrid/Slack/Zapier or a
 * custom relay) with the configured attorney recipients + an optional
 * `ATTORNEY_NOTIFY_WEBHOOK_TOKEN` bearer header; a non-2xx or a 5s timeout THROWS
 * so `registerAttorneyNotify` logs the NOT-DELIVERED line (and a future durable
 * outbox can replay it). With no URL configured it falls back to the console
 * default (local dev / unconfigured) — so the seam ships functional but inert
 * until an operator wires a channel. `env`/`deps` are injectable for tests.
 */
export function resolveNotifyFn(
  env: Record<string, string | undefined> = process.env,
  deps: { fetchImpl?: typeof fetch; recipients?: () => string[] } = {},
): NotifyFn {
  const url = env.ATTORNEY_NOTIFY_WEBHOOK_URL?.trim();
  if (!url) return defaultNotify;
  const token = env.ATTORNEY_NOTIFY_WEBHOOK_TOKEN?.trim();
  const doFetch = deps.fetchImpl ?? fetch;
  const recipientsOf = deps.recipients ?? (() => attorneyAllowlist(env));
  return async (n) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...n, recipients: recipientsOf() }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`attorney-notify webhook returned ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  };
}

/** True when a status transition is one an attorney should be told about. */
export function shouldNotify(status: string): boolean {
  return NOTIFY_ON.has(status.trim().toLowerCase());
}

export function toNotification(
  event: CaseStatusChanged,
): AttorneyNotification | null {
  if (!shouldNotify(event.status)) return null;
  return {
    caseId: event.caseId,
    status: event.status,
    at: event.at,
    reason: event.guarded ? "guarded transition" : "status update",
  };
}

/** Attach the attorney-notify subscriber to a bus. Returns its unsubscribe fn. */
export function registerAttorneyNotify(
  bus: EventBus,
  notify: NotifyFn = defaultNotify,
) {
  return bus.on("CaseStatusChanged", async (event) => {
    const notification = toNotification(event);
    if (!notification) return;
    try {
      await notify(notification);
    } catch (err) {
      // A lost nudge on a deadline-relevant milestone (RFE/Decision/Filed) must be
      // VISIBLE and DISTINCT from the bus's generic "[events] handler failed" line
      // so it can be alerted on / replayed. (A durable outbox is the real fix;
      // this at least makes the loss observable instead of success theater.)
      console.error(
        `[attorney-notify] NOT DELIVERED — case ${notification.caseId} → ${notification.status} (${notification.reason})`,
        err,
      );
    }
  });
}
