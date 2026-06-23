/**
 * Store → event-bus bridge (ADR-0007).
 *
 * `withEvents(store, bus)` returns a transparent decorator over the `Store`
 * persistence boundary: every method delegates to the wrapped driver, but the
 * three mutations that represent domain milestones also `publish()` a typed
 * event AFTER the write succeeds (never on a failed/no-op write). The Store
 * interface and every call site are untouched — the decorator is applied once,
 * centrally, in `getStore()`.
 *
 *   transitionCase                 → CaseStatusChanged
 *   saveDraft                      → DraftGenerated
 *   addCaseDocument                → EvidenceUploaded
 *
 * A Proxy (binding methods to the original target) preserves whatever `this`
 * the concrete driver relies on, so this works for both the Firestore object
 * literal and the PGlite class instance.
 *
 * DELIVERY CONTRACT (recorded — ADR-0007): the write COMMITS FIRST, then
 * `publish()` runs in a SEPARATE, non-transactional step. Delivery is therefore
 * BEST-EFFORT / AT-MOST-ONCE: a crash (serverless freeze/OOM, a deploy) in the
 * window AFTER the commit but before/within `publish` LOSES the event with no
 * trace — a missing audit/provenance line and a missing attorney notification,
 * with zero signal. This is an accepted limitation of the in-process bus, NOT a
 * guarantee: NO consumer may treat the bus as the source of truth, and the
 * persisted Store row (not the event) is authoritative. Achieving at-least-once
 * would require a durable outbox written inside the same commit as the mutation
 * plus a relay that drains it — deliberately out of scope here; see event-bus
 * findings #2/#3. (`bus.publish` also swallows individual handler failures —
 * handlers are isolated — so a thrown sink doesn't roll back the committed write.)
 */

import type {
  AddDocumentInput,
  DraftSection,
  Store,
  TransitionCaseInput,
} from "../db/store";
import type { EventBus } from "./bus";
import type { CaseStatusChanged } from "./types";

/** Injectable clock — defaults to wall-clock ISO time; tests pin it. */
export type Clock = () => string;

const wallClock: Clock = () => new Date().toISOString();

/** Build a CaseStatusChanged event — one factory for the shape (the `guarded`
 *  arg stays a parameter for any future second publisher). */
function caseStatusChanged(
  at: string,
  caseId: string,
  status: string,
  receiptNumber: string | undefined,
  guarded: boolean,
): CaseStatusChanged {
  return { type: "CaseStatusChanged", at, caseId, status, receiptNumber, guarded };
}

export function withEvents(
  store: Store,
  bus: EventBus,
  now: Clock = wallClock,
): Store {
  return new Proxy(store, {
    get(target, prop, receiver) {
      switch (prop) {
        case "transitionCase":
          return async (input: TransitionCaseInput): Promise<boolean> => {
            const applied = await target.transitionCase(input);
            // Only a transition that actually moved the case is a domain event;
            // a failed compare-and-set is a no-op and must stay silent.
            if (applied) {
              await bus.publish(
                caseStatusChanged(now(), input.caseId, input.toStatus, input.receiptNumber, true),
              );
            }
            return applied;
          };

        case "saveDraft":
          return async (
            caseId: string,
            sections: readonly DraftSection[],
            source: string,
          ): Promise<number> => {
            const version = await target.saveDraft(caseId, sections, source);
            await bus.publish({
              type: "DraftGenerated",
              at: now(),
              caseId,
              version,
              source,
              sectionCount: sections.length,
            });
            return version;
          };

        case "addCaseDocument":
          return async (input: AddDocumentInput) => {
            const doc = await target.addCaseDocument(input);
            await bus.publish({
              type: "EvidenceUploaded",
              at: now(),
              caseId: input.caseId,
              documentId: doc.id,
              criterion: doc.criterion,
              exhibit: doc.exhibit,
              source: doc.source,
            });
            return doc;
          };

        default: {
          const value = Reflect.get(target, prop, receiver);
          // Bind methods back to the original target so the driver's own `this`
          // (PGlite instance state) is preserved; pass through non-functions.
          return typeof value === "function" ? value.bind(target) : value;
        }
      }
    },
  });
}
