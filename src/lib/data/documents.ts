/**
 * Data layer — evidence-vault documents.
 *
 * Same swappable boundary: typed async accessors over mock fixtures now, an
 * object store / Document AI pipeline later. Feeds the case checklist export.
 */
import { type CaseDocument } from "@/features/case-file/types";

const documents: readonly CaseDocument[] = [
  { id: "d1", name: "Curriculum vitae", exhibit: "Ex. 1", status: "Received", owner: "Anya" },
  { id: "d2", name: "ICML 2024 Best Paper certificate", exhibit: "Ex. 1", status: "Received", owner: "Anya" },
  { id: "d3", name: "Patent grant US11,432,118", exhibit: "Ex. 5", status: "Received", owner: "Anya" },
  { id: "d4", name: "Citation report (412 citations)", exhibit: "Ex. 6", status: "Received", owner: "Concierge" },
  { id: "d5", name: "Recommendation letter — 5th", exhibit: "Ex. 9", status: "Pending", owner: "Anya" },
  { id: "d6", name: "Passport scan", exhibit: "Ex. 10", status: "Needs review", owner: "Anya" },
  { id: "d7", name: "Employment verification & salary", exhibit: "Ex. 8", status: "Received", owner: "Concierge" },
];

function resolve<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/** Every document in the evidence vault for the live case file. */
export function getDocuments(): Promise<readonly CaseDocument[]> {
  return resolve(documents);
}
