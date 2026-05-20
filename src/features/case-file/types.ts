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
