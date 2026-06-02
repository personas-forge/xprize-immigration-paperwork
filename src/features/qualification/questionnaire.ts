/**
 * Structured eligibility questionnaire — the deterministic, offline-testable
 * front door to the qualification funnel.
 *
 * The screening engine (`qualification.ts`) accepts only a free-text profile
 * scored by the LLM. This module adds a GUIDED path: a per-classification set
 * of yes / no / unsure questions DERIVED from the criteria packs (`packs.ts`),
 * so users who can't write a strong bio still get screened and downstream
 * form-prep gets a deterministic eligibility signal.
 *
 * Design contract (ADR-001):
 *  - Questions are DERIVED from `packFor()` — packs.ts stays the single source
 *    of truth for criteria + threshold. This module never duplicates criteria.
 *  - LIVE programs only (`isLiveProgram`): planned/unknown classifications
 *    return `null`, never a silent O-1A fallback (wrong-product screening is
 *    harmful).
 *  - Every public output carries the shared `DISCLAIMER` (UPL safeguard).
 *  - `answersToProfile` bridges answers into a `profile` string the existing
 *    `/api/qualify` engine consumes unchanged.
 *
 * No network, no React, no `process.env`. Pure and unit-testable.
 */

import { DISCLAIMER } from "@/features/guidance/guidance";
import { type Classification, packFor, type PackCriterion } from "./packs";
import { isLiveProgram } from "./jurisdictions";

/** One yes/no/unsure question, derived from a single pack criterion. */
export interface EligibilityQuestion {
  /** Stable id derived from the criterion name — matches qualification.ts ids. */
  id: string;
  /** The pack criterion this question screens for. */
  criterion: string;
  /** Plain-language yes/no phrasing of the criterion. */
  prompt: string;
  /** Actionable hint (the criterion's gap copy) for an unsure/no answer. */
  hint: string;
}

/** A complete questionnaire for one live classification. */
export interface Questionnaire {
  classification: Classification;
  label: string;
  threshold: number;
  questions: EligibilityQuestion[];
  disclaimer: string;
}

export type Answer = "yes" | "no" | "unsure";
/** Answers keyed by `EligibilityQuestion.id`. */
export type Answers = Record<string, Answer>;

export type Verdict = "likely-eligible" | "borderline" | "insufficient";

/** Deterministic scoring of a set of answers against the pack threshold. */
export interface EligibilityOutcome {
  classification: Classification;
  metCount: number;
  unsureCount: number;
  threshold: number;
  verdict: Verdict;
  metCriteria: string[];
  unmetCriteria: string[];
  unsureCriteria: string[];
  disclaimer: string;
}

/**
 * Stable id from a criterion name. MUST match `idFor` in qualification.ts so a
 * questionnaire answer maps to the same criterion the screening engine scores.
 */
function idFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Plain-language yes/no phrasing of a criterion. */
function promptFor(criterion: PackCriterion): string {
  return `Do you have evidence of ${criterion.name.toLowerCase()}?`;
}

/**
 * Build the questionnaire for a LIVE classification — one question per pack
 * criterion, in pack order. Returns `null` for planned or unknown programs
 * (never a silent O-1A fallback).
 */
export function buildQuestionnaire(classification: string): Questionnaire | null {
  if (!isLiveProgram(classification)) return null;
  const pack = packFor(classification);
  const questions: EligibilityQuestion[] = pack.criteria.map((c) => ({
    id: idFor(c.name),
    criterion: c.name,
    prompt: promptFor(c),
    hint: c.gap,
  }));
  return {
    classification: pack.classification,
    label: pack.label,
    threshold: pack.threshold,
    questions,
    disclaimer: DISCLAIMER,
  };
}

/**
 * Score answers against the pack threshold into a deterministic outcome.
 * Returns `null` for planned/unknown programs.
 *
 * An answer is read per question id; unknown ids in `answers` are ignored, and
 * a missing/`"no"` answer counts as unmet. Verdict:
 *   - met >= threshold                  → likely-eligible
 *   - met + unsure >= threshold         → borderline
 *   - otherwise                         → insufficient
 */
export function scoreQuestionnaire(
  answers: Answers,
  classification: string,
): EligibilityOutcome | null {
  const questionnaire = buildQuestionnaire(classification);
  if (questionnaire === null) return null;

  const metCriteria: string[] = [];
  const unsureCriteria: string[] = [];
  const unmetCriteria: string[] = [];

  for (const q of questionnaire.questions) {
    const answer = answers[q.id];
    if (answer === "yes") metCriteria.push(q.criterion);
    else if (answer === "unsure") unsureCriteria.push(q.criterion);
    else unmetCriteria.push(q.criterion);
  }

  const metCount = metCriteria.length;
  const unsureCount = unsureCriteria.length;
  const { threshold } = questionnaire;

  let verdict: Verdict;
  if (metCount >= threshold) verdict = "likely-eligible";
  else if (metCount + unsureCount >= threshold) verdict = "borderline";
  else verdict = "insufficient";

  return {
    classification: questionnaire.classification,
    metCount,
    unsureCount,
    threshold,
    verdict,
    metCriteria,
    unmetCriteria,
    unsureCriteria,
    disclaimer: DISCLAIMER,
  };
}

/**
 * Synthesize a `profile` string from the yes/unsure answers, suitable as
 * `QualifyRequest.profile` for the existing `/api/qualify` engine. Returns ""
 * when nothing was answered yes/unsure (or for a non-live program). When at
 * least one criterion is answered the result is >= 40 chars (the engine's
 * `MIN_PROFILE`).
 */
export function answersToProfile(answers: Answers, classification: string): string {
  if (!isLiveProgram(classification)) return "";
  const pack = packFor(classification);

  const sentences: string[] = [];
  for (const c of pack.criteria) {
    const answer = answers[idFor(c.name)];
    if (answer === "yes") {
      sentences.push(`I have evidence of ${c.name.toLowerCase()}: ${c.evidence}`);
    } else if (answer === "unsure") {
      sentences.push(`I may have some evidence of ${c.name.toLowerCase()}.`);
    }
  }
  if (sentences.length === 0) return "";

  return `Background screened for ${pack.label}. ${sentences.join(" ")}`;
}
