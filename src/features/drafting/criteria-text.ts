/**
 * Shared input-normalization + criterion-line formatting for the petition
 * Drafting Studio and the RFE responder (twins). Keeping the common field caps
 * and the per-criterion bullet format in one place stops the two paid endpoints'
 * citation-discipline rendering from drifting apart.
 *
 * The request *shapes* legitimately differ (RFE adds `rfeText`, different
 * required-field rules), so each feature keeps its own `parse*Request`. The
 * per-criterion rendering IS shared, though: the `criterionLine` format and the
 * `SHARED_FILING_RULES`/`STRICT_JSON_PREAMBLE` compliance scaffolding live here,
 * and the `criteriaLines` flat-map that wraps `criterionLine` + exhibit bullets
 * is shared from `drafting.ts` (where the exhibit renderer lives). Both features
 * call them so the two paid endpoints' citation discipline can't drift.
 *
 * `str` is the generic untrusted-string coercion; it now lives in the shared
 * `@/lib/validation` (it serves the evidence parser too) and is re-exported here
 * so the draft/RFE/forecast/critique importers keep importing it unchanged.
 */

import { str } from "@/lib/validation";

export { str };

/** Field caps shared by the drafting and RFE request validators. */
export const MAX_PETITIONER = 200;
export const MAX_TEXT = 4000;
export const MAX_CRITERIA = 32;

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
 * The compliance/filing rules shared VERBATIM by the petition-draft STRICT-RULES
 * block and the RFE-response one (rules 2/3/4): draft-not-legal-advice, formal
 * USCIS tone, and the no-case-law instruction. This is a legal/compliance
 * contract that MUST stay in lockstep across both paid LLM endpoints — a
 * hardening edit (e.g. tightening the case-law rule for a regulatory change) made
 * once must reach BOTH prompts. Each builder keeps its own feature-specific rule 1
 * + data-marker rule 5 around these. The byte-for-byte text is pinned by the
 * `buildDraftPrompt`/`buildRfePrompt` content tests.
 */
export const SHARED_FILING_RULES: readonly string[] = [
  "2. This is a DRAFT for attorney review — never legal advice, never final.",
  "3. Formal, professional tone suitable for a USCIS filing.",
  "4. Do NOT cite case law or court decisions (no named cases or reporter",
  "   citations). Citing the governing statute or regulation is fine; the",
  "   attorney of record will add any case-law authorities.",
];

/** The strict-JSON envelope preamble shared verbatim by the draft, critique, RFE,
 *  and forecast prompt builders (the `{ … }` shape line differs per builder and
 *  stays inline). Single-sourced so the "no markdown, no prose" contract can't
 *  drift across the metered LLM endpoints. */
export const STRICT_JSON_PREAMBLE =
  "Return STRICT JSON ONLY (no markdown, no prose), shaped exactly:";

/**
 * True when any criterion carries vault exhibits — the predicate that GATES the
 * citation rule in every prompt (draft, single-section, RFE), so the inline/demo
 * path with no vault keeps its exhibit-free prompt. Single-sourced here so a
 * change to the gate (e.g. an empty-array guard) can't drift one prompt into
 * silently dropping the "never invent an exhibit" rule while still listing them.
 */
export function criteriaHaveExhibits(
  criteria: readonly { exhibits?: readonly unknown[] }[],
): boolean {
  return criteria.some((c) => c.exhibits && c.exhibits.length > 0);
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
