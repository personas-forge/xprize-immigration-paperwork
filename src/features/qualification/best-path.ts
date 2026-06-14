/**
 * Best-path recommender (moonshot #7).
 *
 * Instead of forcing the applicant to guess ONE classification up front, this
 * scores a single profile against EVERY live program in one pass and ranks them
 * by how strong/fast a path each is, recommending the best route with a
 * one-line rationale ("You clear O-1A 5/8 today; EB-1A needs one more criterion
 * but is a green card").
 *
 * Pure (no network/React/env): it reuses the existing keyless `mockQualification`
 * per pack and the SAME `summarizeCriteria` threshold math the case-file table
 * relies on, so the ranking can never disagree with a per-program report. The
 * route wires this to the deterministic preview; a model-backed multi-pack
 * scoring is a future extension over the same shapes.
 */

import { DISCLAIMER } from "@/lib/result";
import { type ModelSource } from "@/lib/llm/label";
import { summarizeCriteria, type CriteriaSummary } from "@/features/case-file/criteria";
import { type Criterion } from "@/features/case-file/types";
import { packFor, type Classification } from "./packs";
import { livePrograms } from "./jurisdictions";
import { mockQualification, type QualifyAssessment } from "./qualification";

export { DISCLAIMER };

/** Programs that are a path to PERMANENT residence (green card), not just a
 *  nonimmigrant visa — surfaced in the rationale because it changes the value. */
const GREEN_CARD_PROGRAMS: ReadonlySet<Classification> = new Set(["EB-1A"]);

/** One program's screening, with the threshold math the ranker sorts on. */
export interface ProgramScore {
  classification: Classification;
  /** Human label from the pack (for the comparison header). */
  label: string;
  /** Total criteria in the pack (the denominator, e.g. 8 for O-1A). */
  criteriaCount: number;
  /** Minimum qualifying criteria this pack needs. */
  threshold: number;
  assessment: QualifyAssessment;
  summary: CriteriaSummary;
  /** qualifying − threshold (≥0 ⇒ clears on current evidence). */
  margin: number;
  /** Criteria still needed to reach threshold (0 when met). */
  gapsToThreshold: number;
  /** Whether this program is a green-card path. */
  greenCard: boolean;
}

export interface BestPathRecommendation {
  classification: Classification;
  rationale: string;
}

export interface BestPathResult {
  /** Every live program, ranked best-first. */
  programs: ProgramScore[];
  recommendation: BestPathRecommendation;
  disclaimer: string;
  source: ModelSource;
}

/** The request the recommender needs — same profile/name as a single screening,
 *  minus the classification (it scores ALL of them). */
export interface BestPathRequest {
  profile: string;
  name: string;
}

/** Score one profile against one program's pack. */
export function scoreProgram(
  req: BestPathRequest,
  classification: Classification,
): ProgramScore {
  const pack = packFor(classification);
  const assessment = mockQualification({ ...req, classification });
  const summary = summarizeCriteria(
    assessment.criteria as unknown as readonly Criterion[],
    pack.threshold,
  );
  const margin = summary.qualifying - pack.threshold;
  return {
    classification,
    label: pack.label,
    criteriaCount: pack.criteria.length,
    threshold: pack.threshold,
    assessment,
    summary,
    margin,
    gapsToThreshold: Math.max(0, pack.threshold - summary.qualifying),
    greenCard: GREEN_CARD_PROGRAMS.has(classification),
  };
}

/** Score the profile against EVERY live program. */
export function scoreAllPrograms(req: BestPathRequest): ProgramScore[] {
  return livePrograms().map((c) => scoreProgram(req, c));
}

/**
 * Rank programs best-first: clears-threshold first, then by qualifying margin,
 * then by fewest gaps to close, then by likelihood — a deterministic total order
 * (ties break on classification name so the result is stable).
 */
export function rankPrograms(scores: readonly ProgramScore[]): ProgramScore[] {
  return [...scores].sort((a, b) => {
    const aMeets = a.summary.meetsThreshold ? 1 : 0;
    const bMeets = b.summary.meetsThreshold ? 1 : 0;
    if (aMeets !== bMeets) return bMeets - aMeets;
    if (a.margin !== b.margin) return b.margin - a.margin;
    if (a.gapsToThreshold !== b.gapsToThreshold) return a.gapsToThreshold - b.gapsToThreshold;
    if (a.assessment.likelihood !== b.assessment.likelihood) {
      return b.assessment.likelihood - a.assessment.likelihood;
    }
    return a.classification.localeCompare(b.classification);
  });
}

/** A one-line, plain-language rationale for the recommended program. */
export function rationaleFor(top: ProgramScore): string {
  const green = top.greenCard ? " It is also a green card (permanent residence)." : "";
  if (top.summary.meetsThreshold) {
    return (
      `You clear ${top.classification} on your current evidence ` +
      `(${top.summary.qualifying}/${top.criteriaCount} criteria, needs ${top.threshold}).` +
      green
    );
  }
  const n = top.gapsToThreshold;
  return (
    `${top.classification} is your closest path — ${top.summary.qualifying}/${top.criteriaCount} ` +
    `criteria today, ${n} more criteri${n === 1 ? "on" : "a"} to reach the ${top.threshold} needed.` +
    green
  );
}

/**
 * The full recommendation: score every program, rank them, and tag the top one
 * with a rationale. Deterministic and always carries the disclaimer.
 */
export function recommendBestPath(
  req: BestPathRequest,
  source: ModelSource = "mock",
): BestPathResult {
  const programs = rankPrograms(scoreAllPrograms(req));
  const top = programs[0];
  return {
    programs,
    recommendation: { classification: top.classification, rationale: rationaleFor(top) },
    disclaimer: DISCLAIMER,
    source,
  };
}
