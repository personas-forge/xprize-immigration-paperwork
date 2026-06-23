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
