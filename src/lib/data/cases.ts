/**
 * Data layer — cases / petitions.
 *
 * Single boundary between the UI and the source of case data. `getCases()` is
 * now backed by the real `Store` (the signed-in user's persisted cases — see
 * ./saved-cases), surfaced through a "use server" action so the client case
 * list can await it without importing the server-only store. The remaining
 * helpers are still in-memory fixtures for the single live case-file demo, but
 * consumers only ever see typed async functions — so swapping a body for a DB
 * query or a server action is a one-file change with no UI churn.
 */
import {
  caseFacts as liveCaseFacts,
  criteria as liveCriteria,
  outstandingTasks as liveTasks,
  petitionExcerpt as livePetitionExcerpt,
} from "@/features/case-file/data";
import {
  type CaseFact,
  type CaseTask,
  type Criterion,
  type PetitionCase,
} from "@/features/case-file/types";
import { getCases } from "./saved-cases";

export { getCases };

/** Tiny async shim so swapping in a real fetch later is a no-op for callers. */
function resolve<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/** A single case by id, scoped to the signed-in user, or `null`. */
export async function getCaseById(id: string): Promise<PetitionCase | null> {
  const list = await getCases();
  return list.find((c) => c.id === id) ?? null;
}

/** The criteria rows for the live case file. */
export function getCriteria(): Promise<readonly Criterion[]> {
  return resolve(liveCriteria);
}

/** The petitioner header facts for the live case file. */
export function getCaseFacts(): Promise<readonly CaseFact[]> {
  return resolve(liveCaseFacts);
}

/** Outstanding tasks for the live case file. */
export function getOutstandingTasks(): Promise<readonly CaseTask[]> {
  return resolve(liveTasks);
}

/** The petition letter excerpt for the live case file. */
export function getPetitionExcerpt(): Promise<string> {
  return resolve(livePetitionExcerpt);
}
