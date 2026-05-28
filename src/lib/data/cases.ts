/**
 * Data layer — cases / petitions.
 *
 * Single boundary between the UI and the source of case data. Today every
 * function returns in-memory mock data, but consumers only ever see typed
 * async functions — so swapping the body for a database query, a USCIS case
 * API, or a server action is a one-file change with no UI churn. Keep all
 * mock fixtures and all "how do we fetch a case" logic behind this module.
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

/**
 * The portfolio of petition cases the case-list view renders. The first row
 * is the live mock file (O1-241) the dashboard detail view drills into; the
 * rest give the list something to search, filter, and sort across.
 */
const cases: readonly PetitionCase[] = [
  {
    id: "o1-241",
    fileNumber: "O1-241",
    petitioner: "Dr. Anya Krishnan",
    classification: "O-1A",
    status: "Drafting",
    approvalLikelihood: 92,
    targetFileDate: "2026-06-12",
    attorney: "J. Park, Esq.",
  },
  {
    id: "o1-238",
    fileNumber: "O1-238",
    petitioner: "Mateo Alvarez",
    classification: "O-1B",
    status: "Attorney Review",
    approvalLikelihood: 84,
    targetFileDate: "2026-06-03",
    attorney: "J. Park, Esq.",
  },
  {
    id: "eb1-104",
    fileNumber: "EB1-104",
    petitioner: "Wei Chen",
    classification: "EB-1A",
    status: "Intake",
    approvalLikelihood: 71,
    targetFileDate: "2026-07-20",
    attorney: "R. Osei, Esq.",
  },
  {
    id: "o1-233",
    fileNumber: "O1-233",
    petitioner: "Priya Nair",
    classification: "O-1A",
    status: "Filed",
    approvalLikelihood: 88,
    targetFileDate: "2026-05-09",
    attorney: "R. Osei, Esq.",
  },
  {
    id: "o1-219",
    fileNumber: "O1-219",
    petitioner: "Tomás Becker",
    classification: "O-1B",
    status: "Approved",
    approvalLikelihood: 96,
    targetFileDate: "2026-03-28",
    attorney: "J. Park, Esq.",
  },
];

/** Tiny async shim so swapping in a real fetch later is a no-op for callers. */
function resolve<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/** Every petition case in the portfolio. */
export function getCases(): Promise<readonly PetitionCase[]> {
  return resolve(cases);
}

/** A single case by id, or `null` when it does not exist. */
export function getCaseById(id: string): Promise<PetitionCase | null> {
  return resolve(cases.find((c) => c.id === id) ?? null);
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
