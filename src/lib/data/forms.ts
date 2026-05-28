/**
 * Data layer — USCIS forms.
 *
 * Behind the same boundary as cases/documents: typed async accessors over
 * mock fixtures today, a real catalog (or USCIS form metadata service)
 * tomorrow. The form catalog drives the AI field-guidance panel's pickers.
 */
import { type UscisForm } from "@/features/case-file/types";

const forms: readonly UscisForm[] = [
  {
    id: "i-129",
    number: "I-129",
    title: "Petition for a Nonimmigrant Worker",
    commonFields: [
      "Part 2 — Basis for Classification",
      "Part 5 — Beneficiary Information",
      "Section O-1 — Extraordinary Ability",
      "Dates of Intended Employment",
    ],
  },
  {
    id: "i-907",
    number: "I-907",
    title: "Request for Premium Processing Service",
    commonFields: [
      "Part 2 — Information About the Request",
      "Receipt Number of the Related Petition",
    ],
  },
  {
    id: "i-140",
    number: "I-140",
    title: "Immigrant Petition for Alien Worker",
    commonFields: [
      "Part 2 — Petition Type (EB-1A)",
      "Part 6 — Basic Information About the Proposed Employment",
    ],
  },
];

function resolve<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/** Every USCIS form the product can produce guidance for. */
export function getForms(): Promise<readonly UscisForm[]> {
  return resolve(forms);
}

/** A single form by id, or `null` when unknown. */
export function getFormById(id: string): Promise<UscisForm | null> {
  return resolve(forms.find((f) => f.id === id) ?? null);
}
