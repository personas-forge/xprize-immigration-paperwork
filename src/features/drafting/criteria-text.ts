/**
 * Shared input-normalization + criterion-line formatting for the petition
 * Drafting Studio and the RFE responder (twins). Keeping `str`, the common
 * field caps, and the per-criterion bullet format in one place stops the two
 * paid endpoints' citation-discipline rendering from drifting apart.
 *
 * The request *shapes* legitimately differ (RFE adds `rfeText`, different
 * required-field rules), so each feature keeps its own `parse*Request` and
 * `criteriaLines` wrapper — only these leaf helpers are shared.
 */

/** Field caps shared by the drafting and RFE request validators. */
export const MAX_PETITIONER = 200;
export const MAX_TEXT = 4000;
export const MAX_CRITERIA = 32;

/** Coerce an untrusted value to a trimmed, length-capped string ("" if absent). */
export function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** The scored-criterion shape both prompt builders render from. */
export interface CriterionLineInput {
  name: string;
  status: string;
  evidence: string;
  rationale: string;
}

/**
 * Normalize an untrusted `criteria` value into scored-criterion inputs: cap the
 * count, drop non-objects, coerce + length-cap each field, drop unnamed rows.
 * The trust-boundary caps for paid LLM input live HERE, shared by the draft, RFE,
 * and forecast parsers (which previously each inlined this exact block), so a
 * hardening change lands once.
 */
export function parseCriteriaArray(value: unknown): CriterionLineInput[] {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .slice(0, MAX_CRITERIA)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      name: str(c.name, 120),
      status: str(c.status, 20),
      evidence: str(c.evidence, MAX_TEXT),
      rationale: str(c.rationale, MAX_TEXT),
    }))
    .filter((c) => c.name !== "");
}

/**
 * Render one scored criterion as a prompt bullet:
 * `- name [status]: evidence — rationale`. This exact format is what the
 * prompts depend on for citation discipline, so both features must share it.
 */
export function criterionLine(c: CriterionLineInput): string {
  return (
    `- ${c.name} [${c.status}]: ${c.evidence || "(no specific evidence provided)"}` +
    (c.rationale ? ` — ${c.rationale}` : "")
  );
}

/**
 * Market-bar framing — appended to BOTH the petition-draft and the RFE-response
 * prompts (single-sourced HERE so the two paid endpoints can't drift). It raises
 * the output to specialist-attorney work product along the dimensions a Tiger
 * drill (2026-06-23) measured as the value lever: argue the FINAL-MERITS ("very
 * top of the field") standard explicitly, frame every metric against FIELD NORMS
 * for a non-expert adjudicator (not bare adjectives), and argue accomplished,
 * independently-corroborated impact. On a k=4 ablation it lifted the draft
 * +$948/petition and the RFE +$2,415/response (both non-overlapping vs baseline)
 * with ZERO fabrication — the no-fabrication discipline (draft/RFE Rule 1) still
 * binds, and is restated here. `kind` selects the single op-specific bullet:
 * comparable-evidence for a fresh letter, point-by-point-name-the-evidence for an
 * RFE rebuttal.
 */
export function marketBarFraming(kind: "letter" | "rfe"): string[] {
  const opener =
    kind === "rfe"
      ? "BAR — argue at the standard of a specialist immigration attorney's RFE rebuttal:"
      : "BAR — argue at the standard of a specialist immigration attorney's work product:";
  const opSpecific =
    kind === "rfe"
      ? [
          "- Address the SPECIFIC deficiency the notice raises POINT BY POINT, and NAME the exact",
          '  on-record evidence that rebuts each point — never assert "the record establishes" without',
          "  naming what does.",
        ]
      : [
          "- Where a regulatory criterion does not readily fit the beneficiary's field, make a",
          "  disciplined COMPARABLE-EVIDENCE argument: name the criterion, why it does not apply, and",
          "  the mirroring evidence that satisfies its intent.",
        ];
  return [
    opener,
    "- Argue the FINAL-MERITS standard explicitly: not only that the qualifying criteria are met,",
    "  but a separate narrative that the beneficiary is within the small percentage at the very top",
    "  of the field (the totality) — not a checklist of met criteria.",
    "- Frame every metric against FIELD NORMS for a non-expert adjudicator — how it compares to",
    "  others at the top of the field — rather than bare adjectives ('renowned', 'leading').",
    ...opSpecific,
    "- Argue ACCOMPLISHED, independently-corroborated impact recognized across the field — never",
    "  promise or potential. Invent nothing (the no-fabrication rule still binds).",
  ];
}
