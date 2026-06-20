/**
 * Pure derivation of a case's client-facing roadmap — the "what's done / what's
 * next" progress stepper. Maps the case status (plus whether evidence/draft
 * exist) onto an ordered set of pipeline stages with done/current/upcoming
 * states. No React, no data access — unit-testable.
 */

export type StageState = "done" | "current" | "upcoming";

export interface RoadmapStage {
  key: string;
  label: string;
  state: StageState;
}

const STAGES: readonly { key: string; label: string }[] = [
  { key: "qualified", label: "Qualified" },
  { key: "evidence", label: "Evidence" },
  { key: "drafted", label: "Drafted" },
  { key: "review", label: "Attorney review" },
  { key: "filed", label: "Filed" },
  { key: "decision", label: "Decision" },
];

// Stage indices, for the monotonic "current stage" computation.
const EVIDENCE = 1;
const DRAFTED = 2;
const REVIEW = 3;
const DECISION = 5;
const ALL_DONE = STAGES.length;

/**
 * Derive the roadmap for a case. Status is the source of truth for the
 * post-submission stages; before submission, the evidence/draft flags pick out
 * the current pre-filing step. Everything before `current` is done; everything
 * after is upcoming.
 */
export function caseRoadmap(
  status: string,
  opts: { hasEvidence: boolean; hasDraft: boolean },
): RoadmapStage[] {
  let current: number;
  if (status === "Approved") {
    current = ALL_DONE; // every stage complete
  } else if (status === "Filed") {
    current = DECISION; // filed; awaiting the USCIS decision
  } else if (status === "Attorney Review") {
    current = REVIEW;
  } else {
    // Intake / Drafting: advance through the pre-submission steps as work lands.
    // A draft is the strongest signal — it carries past Evidence even when the
    // vault is empty, so Evidence is never shown "current" once a draft exists
    // (UAT 2026-06-20 F4 / fam-track-01).
    current = opts.hasDraft ? REVIEW : opts.hasEvidence ? DRAFTED : EVIDENCE;
  }

  return STAGES.map((stage, i) => ({
    key: stage.key,
    label: stage.label,
    state: i < current ? "done" : i === current ? "current" : "upcoming",
  }));
}
