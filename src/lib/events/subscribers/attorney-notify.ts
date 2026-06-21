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

import type { EventBus } from "../bus";
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
