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

// ── Model-backed best-path (LLM-1 / UAT T1) ──────────────────────────────────
// The keyless recommendBestPath above scores by KEYWORD and can under-read a
// non-default profile (a film director read as a business "critical role", a
// composer's lead role missed, a chef/athlete invisible). When a model is
// configured (the authenticated path), this prompt asks the model to read the
// WHOLE record against every live pack and recommend a path WITH cross-
// classification reasoning — including EB-1A's higher final-merits / green-card
// trade-off (the OA-QV-01 gap). Same BestPathResult shape, so nothing downstream
// changes; on any model failure the orchestrator falls back to the keyword mock.

/** Build the model prompt: every live pack's criteria + the comparison ask. */
export function buildBestPathPrompt(req: BestPathRequest): string {
  const lines: string[] = [
    "You are an informational immigration-screening assistant. The applicant has",
    "NOT chosen a visa category — read their whole background and recommend which",
    "U.S. extraordinary-ability path fits best, comparing the options. This is the",
    "FIRST screen, so choosing the right path matters most.",
    "",
    "STRICT RULES:",
    "1. GENERAL INFORMATIONAL screening only — never legal advice, never a legal",
    "   eligibility determination, never a certain prediction of the USCIS outcome.",
    "2. Score ONLY from what the applicant describes. Invent nothing.",
    "3. An attorney of record must review everything before anything is filed.",
    "4. Read the WHOLE record — do NOT keyword-match. A film director's lead",
    "   creative role, a composer's score, a chef's culinary recognition, an",
    "   athlete's podiums and coaching are real evidence even when the wording",
    "   doesn't match a criterion label.",
    "5. EB-1A is a GREEN CARD (permanent residence), judged on a HIGHER 'final",
    "   merits' totality bar than the O-1 nonimmigrant visas — say so when it is in",
    "   play; never present it as a free bonus.",
    "",
    "The live programs and their criteria:",
  ];
  for (const c of livePrograms()) {
    const pack = packFor(c);
    lines.push(
      `• ${c} — ${pack.label} (needs ${pack.threshold} of ${pack.criteria.length}):`,
      `    ${pack.criteria.map((x) => x.name).join("; ")}`,
    );
  }
  lines.push(
    "",
    "For EACH program, count how many of ITS criteria the applicant clearly meets",
    "(Met or Strong) and give a one-line read. Then recommend the single best path",
    "with a 2–3 sentence rationale that COMPARES the options (why this one over",
    "the others) and notes the EB-1A higher-bar / green-card trade-off when relevant.",
    "",
    "Return STRICT JSON ONLY (no prose, no markdown), shaped exactly:",
    "{",
    '  "programs": [',
    '    { "classification": "<exact code, e.g. O-1A>", "qualifying": <integer>, "read": "<one line>" }',
    "    // one per program listed above",
    "  ],",
    '  "recommendation": { "classification": "<one of the codes>", "rationale": "<2-3 sentences>" }',
    "}",
    "",
    `Applicant: ${req.name}`,
    "Described background:",
    req.profile,
    "",
    "Return the JSON now.",
  );
  return lines.join("\n");
}

/** Tolerant JSON slice — the model may wrap the object in prose/fences. */
function sliceJson(raw: string): string {
  const a = raw.indexOf("{");
  const b = raw.lastIndexOf("}");
  return a >= 0 && b > a ? raw.slice(a, b + 1) : raw;
}

/**
 * Coerce the model's best-path JSON into a BestPathResult, or null if unusable
 * (→ the orchestrator reclaims the charge and falls back to the keyword mock).
 * The LIVE programs are the source of truth: we build a ProgramScore for every
 * one (the model's `qualifying` count clamped to the pack size), rank with the
 * SAME `rankPrograms` math the case-file relies on, and honor the model's
 * recommendation + cross-pack rationale.
 */
export function parseBestPathResponse(
  raw: string,
  _req: BestPathRequest,
): BestPathResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sliceJson(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const modelPrograms = Array.isArray(obj.programs) ? obj.programs : null;
  const rec = obj.recommendation as Record<string, unknown> | undefined;
  if (!modelPrograms || !rec) return null;

  const qualifyingByCode = new Map<string, number>();
  for (const p of modelPrograms) {
    const o = (p ?? {}) as Record<string, unknown>;
    const code = String(o.classification ?? "");
    const q = Number(o.qualifying);
    if (code) qualifyingByCode.set(code, Number.isFinite(q) ? q : 0);
  }

  const scores: ProgramScore[] = livePrograms().map((c) => {
    const pack = packFor(c);
    const qualifying = Math.max(
      0,
      Math.min(pack.criteria.length, qualifyingByCode.get(c) ?? 0),
    );
    const summary: CriteriaSummary = {
      total: pack.criteria.length,
      qualifying,
      partial: 0,
      meetsThreshold: qualifying >= pack.threshold,
    };
    return {
      classification: c,
      label: pack.label,
      criteriaCount: pack.criteria.length,
      threshold: pack.threshold,
      assessment: {
        criteria: [],
        likelihood: Math.min(95, Math.round((qualifying / pack.criteria.length) * 100)),
        gaps: [],
      },
      summary,
      margin: qualifying - pack.threshold,
      gapsToThreshold: Math.max(0, pack.threshold - qualifying),
      greenCard: GREEN_CARD_PROGRAMS.has(c),
    };
  });

  const ranked = rankPrograms(scores);
  const recommended =
    ranked.find((p) => p.classification === String(rec.classification ?? "")) ?? ranked[0];
  const rationale =
    typeof rec.rationale === "string" && rec.rationale.trim().length > 0
      ? rec.rationale.trim()
      : rationaleFor(recommended);
  return {
    programs: ranked,
    recommendation: { classification: recommended.classification, rationale },
    disclaimer: DISCLAIMER,
    source: "claude",
  };
}
