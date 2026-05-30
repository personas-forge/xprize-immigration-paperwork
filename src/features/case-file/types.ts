export type CriterionStatus = "Met" | "Strong" | "Partial";

export interface Criterion {
  id: string;
  name: string;
  status: CriterionStatus;
  evidence: string;
  exhibit: string;
}

export interface CaseTask {
  id: string;
  label: string;
  owner: string;
}

export interface CaseFact {
  label: string;
  value: string;
}

/**
 * Lifecycle of a petition file, mirroring the five PetitionStepper stages.
 * Kept as a string-literal union so the UI filter and the status helpers
 * stay in lockstep with the data layer.
 */
export type CaseStatus =
  | "Intake"
  | "Drafting"
  | "Attorney Review"
  | "Filed"
  | "Approved";

/** USCIS classification a petition is filed under. */
export type VisaClassification = "O-1A" | "O-1B" | "EB-1A";

/**
 * A petition case as surfaced by the data layer. This is the richer shape the
 * case-list UI (search / filter / sort / export) consumes; the single live
 * mock case file is one row of this.
 */
export interface PetitionCase {
  id: string;
  /** Human file number, e.g. "O1-241". */
  fileNumber: string;
  petitioner: string;
  classification: VisaClassification;
  status: CaseStatus;
  /** Approval likelihood, 0–100, as scored from the evidence vault. */
  approvalLikelihood: number;
  /** ISO date (yyyy-mm-dd) the petition targets for filing. */
  targetFileDate: string;
  attorney: string;
}

/** A USCIS form the product can assemble guidance for. */
export interface UscisForm {
  id: string;
  /** Official form number, e.g. "I-129". */
  number: string;
  title: string;
  /** Field labels a petitioner commonly needs guidance on. */
  commonFields: string[];
}

/**
 * A trimmed, client-safe summary of a persisted case (the DB-backed cases a
 * user creates via the qualification flow). Plain data — safe to pass from a
 * server component into the client dashboard without importing the server-only
 * data layer.
 */
export interface SavedCaseSummary {
  id: string;
  fileNumber: string;
  petitioner: string;
  classification: string;
  status: string;
  approvalLikelihood: number;
}

export type DocumentStatus = "Received" | "Pending" | "Needs review";

/** A document/exhibit in the evidence vault. */
export interface CaseDocument {
  id: string;
  name: string;
  exhibit: string;
  status: DocumentStatus;
  owner: string;
}
