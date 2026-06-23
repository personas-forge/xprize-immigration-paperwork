/**
 * Pure logic for the multi-product qualification engine.
 *
 * Given a free-text profile (CV / bio / achievements) and a visa classification
 * it produces a SCREENING that maps the person onto that classification's
 * evidentiary criteria (see `packs.ts`), with a per-criterion status, the
 * evidence it keyed on, and a plain-language rationale — plus an overall
 * likelihood and the gaps to close.
 *
 * No network, no React, no `process.env`. The route wires these to Gemini (or
 * the deterministic fallback). Keeping them pure makes the non-negotiable
 * disclaimer, the JSON parsing, and the validation unit-testable.
 *
 * COMPLIANCE: every result carries the same `DISCLAIMER` as form-field
 * guidance. This is an INFORMATIONAL self-screening, never an eligibility
 * determination (UPL risk). The disclaimer is part of the data contract.
 */

import { DISCLAIMER } from "@/lib/result";
import { type ModelSource } from "@/lib/llm/label";
import { extractJson } from "@/lib/llm/json";
import { type Classification, packFor, criteriaNames } from "./packs";
import { isLiveProgram } from "./jurisdictions";

/** The eight O-1A criteria names, kept as a stable export (the default pack). */
export const O1A_CRITERIA = criteriaNames("O-1A");

/** A criterion score. "None" means no supporting evidence was found — it must
 *  render neutral (never green) and never counts toward the threshold. */
export type ScoreStatus = "Met" | "Strong" | "Partial" | "None";

const VALID_STATUSES: ReadonlySet<string> = new Set(["Met", "Strong", "Partial", "None"]);

export interface ScoredCriterion {
  /** Stable id derived from the criterion name (e.g. "awards"). */
  id: string;
  /** Across packs criterion names vary, so this is a plain string. */
  name: string;
  status: ScoreStatus;
  /** What in the profile supports this criterion ("" when nothing did). */
  evidence: string;
  /** Why the criterion was scored this way (plain language). */
  rationale: string;
}

/** The screening core, before the disclaimer/source envelope is attached. */
export interface QualifyAssessment {
  /** The classification this assessment was actually SCORED against. Pinned into
   *  the result so the read-out's threshold/denominator can never be derived from
   *  mutable form state that has since changed (see CriteriaReport). */
  classification: Classification;
  criteria: ScoredCriterion[];
  /** Overall approval likelihood, 0-100. Informational, not a guarantee. */
  likelihood: number;
  /** Short, actionable gaps to strengthen the case. */
  gaps: string[];
}

export interface QualifyResult extends QualifyAssessment {
  disclaimer: string;
  /** "mock" (template) or the engine that generated it ("gemini" | "claude"). */
  source: ModelSource;
}

export interface QualifyRequest {
  /** Free-text CV / bio / achievements. */
  profile: string;
  /** Petitioner name (used as the case label). */
  name: string;
  /** Visa classification to screen against (selects the criteria pack). */
  classification: Classification;
}

const MIN_PROFILE = 40;
const MAX_PROFILE = 12000;
const MAX_NAME = 200;

function idFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Validate and normalize an untrusted request body. Returns the cleaned request
 * or a human-readable error — never throws, so the route stays a thin switch.
 */
export function parseQualifyRequest(
  body: unknown,
): { ok: true; value: QualifyRequest } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const record = body as Record<string, unknown>;
  const profile = record.profile;
  const rawName = record.name;

  if (typeof profile !== "string" || profile.trim().length < MIN_PROFILE) {
    return {
      ok: false,
      error: `Describe your background in at least ${MIN_PROFILE} characters.`,
    };
  }
  if (profile.length > MAX_PROFILE) {
    return { ok: false, error: "That's too long — please trim your summary." };
  }
  const name =
    typeof rawName === "string" && rawName.trim() !== ""
      ? rawName.trim().slice(0, MAX_NAME)
      : "Applicant";
  // Only LIVE programs are accepted; planned jurisdictions are gated off here.
  const classification: Classification = isLiveProgram(record.classification)
    ? record.classification
    : "O-1A";

  return { ok: true, value: { profile: profile.trim(), name, classification } };
}

/**
 * The prompt sent to Gemini. It instructs the model to SCREEN the profile
 * against the classification's criteria and return STRICT JSON — informational
 * only, never a legal eligibility determination, attorney-of-record required.
 */
export function buildQualifyPrompt(req: QualifyRequest): string {
  const pack = packFor(req.classification);
  return [
    "You are an informational screening assistant for a U.S. immigration",
    "paperwork product. You assess how a person's described background maps onto",
    `the evidentiary criteria for a ${pack.classification} petition`,
    `(${pack.label}).`,
    "",
    "STRICT RULES — follow all of them:",
    "1. This is GENERAL INFORMATIONAL screening only. Never give legal advice,",
    "   never make a legal eligibility determination, never predict the USCIS",
    "   outcome as a certainty.",
    "2. Base every score ONLY on what the user actually describes. Do not invent",
    "   facts, awards, publications, or employers.",
    "3. An attorney of record must review everything before anything is filed.",
    "4. Score each criterion ONLY from evidence specific to THAT criterion. Do not",
    "   let evidence for one criterion also satisfy a different one unless the",
    "   description independently supports it (e.g. publications and citations are",
    "   scholarly authorship, not by themselves an original contribution).",
    "5. Judge each field by ITS OWN norms, not a sciences template: a behind-the-",
    "   scenes creative or organizational lead (a composer, editor, choreographer,",
    "   head chef, principal architect, head coach) can hold a lead/critical role;",
    "   an authored clinical guideline, technical standard, or widely-adopted",
    "   open-source can be an original contribution of major significance. Do NOT",
    "   under-score a non-default field for lacking papers/citations — but invent",
    "   nothing (Rule 2 still binds).",
    "",
    `The ${pack.classification} criteria (use these exact names):`,
    ...pack.criteria.map((c, i) => `${i + 1}. ${c.name}`),
    "",
    "For EACH criterion, assign a status:",
    '- "Met"     — clear, well-evidenced.',
    '- "Strong"  — strongly supported but could be reinforced.',
    '- "Partial" — some support, currently thin.',
    '- "None"    — no supporting evidence in what was described.',
    "",
    // Evidence-capture fidelity (Tiger L2 2026-06-23). The `evidence` field is
    // reused VERBATIM by a later drafting step that never sees this profile, so a
    // specific compressed away here is lost to the petition (the live run watched
    // an EB-1A flagship project + an O-1B press feature vanish at exactly this
    // seam). Instruct the model to PRESERVE the concrete specifics rather than
    // summarize — Rule 2 (invent nothing) still binds.
    'For each criterion, the "evidence" you record is REUSED VERBATIM by a later',
    "drafting step that does NOT see this description. So capture the SPECIFIC,",
    "load-bearing facts the applicant gave for THAT criterion — named entities,",
    "numbers, dates, venues, titles, awards, and metrics — not a short summary. A",
    "concrete fact you leave out here cannot appear in the petition. Invent nothing",
    '(Rule 2 still binds); keep "rationale" to one sentence.',
    "",
    "Return STRICT JSON ONLY (no prose, no markdown), shaped exactly:",
    "{",
    '  "criteria": [',
    '    { "name": "<criterion name>", "status": "Met", "evidence": "<the SPECIFIC facts for THIS criterion — names, numbers, dates, venues, awards, metrics>", "rationale": "<one sentence>" }',
    "    // ...one per criterion, in order",
    "  ],",
    '  "likelihood": <integer 0-100>,',
    '  "gaps": ["<short actionable gap>", "..."]',
    "}",
    "",
    `Applicant: ${req.name}`,
    "Described background:",
    req.profile,
    "",
    "Return the JSON now.",
  ].join("\n");
}

function clampLikelihood(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function coerceStatus(value: unknown): ScoreStatus {
  return VALID_STATUSES.has(value as string) ? (value as ScoreStatus) : "None";
}

/**
 * Normalize raw model output into a QualifyAssessment. Robust by design: a
 * malformed payload falls back to the deterministic mock, and the criteria are
 * always returned as the classification's full canonical set (in order),
 * filling any the model omitted with "None".
 */
export function parseQualifyResponse(
  text: string,
  req: QualifyRequest,
): QualifyAssessment {
  const parsed = extractJson(text);
  if (typeof parsed !== "object" || parsed === null) {
    return mockQualification(req);
  }
  const obj = parsed as Record<string, unknown>;
  const rawCriteria = Array.isArray(obj.criteria) ? obj.criteria : [];

  const byName = new Map<string, Record<string, unknown>>();
  for (const row of rawCriteria) {
    if (row && typeof row === "object") {
      const name = (row as Record<string, unknown>).name;
      if (typeof name === "string") byName.set(name.trim().toLowerCase(), row as Record<string, unknown>);
    }
  }

  const criteria: ScoredCriterion[] = packFor(req.classification).criteria.map((pc) => {
    const row = byName.get(pc.name.toLowerCase());
    return {
      id: idFor(pc.name),
      name: pc.name,
      status: coerceStatus(row?.status),
      evidence: typeof row?.evidence === "string" ? row.evidence.trim() : "",
      rationale: typeof row?.rationale === "string" ? row.rationale.trim() : "",
    };
  });

  const gaps = Array.isArray(obj.gaps)
    ? obj.gaps.filter((g): g is string => typeof g === "string" && g.trim() !== "").map((g) => g.trim())
    : [];

  return {
    classification: req.classification,
    criteria,
    likelihood: clampLikelihood(obj.likelihood),
    gaps,
  };
}

/**
 * Deterministic informational screening used when no GEMINI_API_KEY is set (the
 * secret-free build). Scores each of the classification's criteria by keyword
 * presence and derives a likelihood from the count.
 */
export function mockQualification(req: QualifyRequest): QualifyAssessment {
  const text = req.profile;
  const pack = packFor(req.classification);
  const criteria: ScoredCriterion[] = pack.criteria.map((pc) => {
    const hit = pc.match.test(text);
    return {
      id: idFor(pc.name),
      name: pc.name,
      status: hit ? ("Met" as ScoreStatus) : ("None" as ScoreStatus),
      evidence: hit ? pc.evidence : "",
      rationale: hit
        ? "Keyword evidence found in your summary; an attorney should verify it qualifies."
        : "No supporting evidence detected in your summary.",
    };
  });

  const qualifying = criteria.filter((c) => c.status === "Met" || c.status === "Strong").length;
  const likelihood = mockLikelihood(qualifying, pack.threshold, criteria.length);
  const gaps = pack.criteria.filter((pc) => !pc.match.test(text)).map((pc) => pc.gap);

  return { classification: req.classification, criteria, likelihood, gaps };
}

/**
 * Informational likelihood heuristic, DERIVED from the qualifying verdict so the
 * headline % can never contradict the "Meets / Below threshold" badge:
 *   - 0 qualifying           → 0% (no fabricated baseline chance)
 *   - below threshold        → 0-45% band, scaled by progress toward threshold
 *   - meets/exceeds threshold → 55-95% band, scaled by qualifying / total
 * The gap at 45/55 keeps a "Below threshold" verdict strictly under 50%.
 */
export function mockLikelihood(qualifying: number, threshold: number, total: number): number {
  if (qualifying <= 0 || threshold <= 0) return Math.max(0, Math.min(95, qualifying <= 0 ? 0 : 55));
  if (qualifying < threshold) {
    return Math.round((qualifying / threshold) * 45);
  }
  const extra = total > threshold ? (qualifying - threshold) / (total - threshold) : 1;
  return Math.round(55 + Math.max(0, Math.min(1, extra)) * 40);
}

/** Wrap an assessment in the response contract, always attaching the disclaimer. */
export function buildQualifyResult(
  assessment: QualifyAssessment,
  source: QualifyResult["source"],
): QualifyResult {
  return { ...assessment, disclaimer: DISCLAIMER, source };
}
