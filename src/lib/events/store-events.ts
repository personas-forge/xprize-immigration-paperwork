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
 *   setCaseStatus / transitionCase → CaseStatusChanged
 *   saveDraft                      → DraftGenerated
 *   addCaseDocument                → EvidenceUploaded
 *
 * A Proxy (binding methods to the original target) preserves whatever `this`
 * the concrete driver relies on, so this works for both the Firestore object
 * literal and the PGlite class instance.
 */

import type {
  AddDocumentInput,
  DraftSection,
  Store,
  TransitionCaseInput,
} from "../db/store";
import type { EventBus } from "./bus";

/** Injectable clock — defaults to wall-clock ISO time; tests pin it. */
export type Clock = () => string;

const wallClock: Clock = () => new Date().toISOString();

export function withEvents(
  store: Store,
  bus: EventBus,
  now: Clock = wallClock,
): Store {
  return new Proxy(store, {
    get(target, prop, receiver) {
      switch (prop) {
        case "setCaseStatus":
          return async (
            caseId: string,
            status: string,
            receiptNumber?: string,
          ): Promise<void> => {
            await target.setCaseStatus(caseId, status, receiptNumber);
            await bus.publish({
              type: "CaseStatusChanged",
              at: now(),
              caseId,
              status,
              receiptNumber,
              guarded: false,
            });
          };

        case "transitionCase":
          return async (input: TransitionCaseInput): Promise<boolean> => {
            const applied = await target.transitionCase(input);
            // Only a transition that actually moved the case is a domain event;
            // a failed compare-and-set is a no-op and must stay silent.
            if (applied) {
              await bus.publish({
                type: "CaseStatusChanged",
                at: now(),
                caseId: input.caseId,
                status: input.toStatus,
                receiptNumber: input.receiptNumber,
                guarded: true,
              });
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
              name: doc.name,
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
