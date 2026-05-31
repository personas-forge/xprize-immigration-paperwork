/**
 * Pure logic for the RFE (Request for Evidence) response drafter.
 *
 * After a petition is filed, USCIS may issue an RFE asking the petitioner to
 * substantiate specific criteria. Given the RFE notice text plus the petition's
 * scored criteria, this drafts a structured response addressing each point —
 * reinforcing the criteria with the evidence already on record.
 *
 * Twin of the drafting module: pure (no network/React/env), so the disclaimer,
 * citation discipline, and JSON parsing are unit-testable. The route wires it to
 * Gemini or the deterministic fallback.
 *
 * COMPLIANCE: an RFE response is WORK PRODUCT FOR THE ATTORNEY OF RECORD to
 * review and sign — never legal advice, never final. The prompt forbids
 * inventing evidence (citation discipline). Every result carries `DISCLAIMER`.
 */

import { DISCLAIMER } from "@/features/guidance/guidance";
import { type DraftSection } from "@/features/drafting";
import { type ModelSource } from "@/lib/llm/label";

export { DISCLAIMER };
export type { DraftSection as RfeSection };

export interface RfeCriterion {
  name: string;
  status: string;
  evidence: string;
  rationale: string;
}

export interface RfeRequest {
  petitioner: string;
  classification: string;
  criteria: RfeCriterion[];
  /** The text of the USCIS RFE notice being responded to. */
  rfeText: string;
}

export interface RfeResponse {
  sections: DraftSection[];
}

export interface RfeResult extends RfeResponse {
  disclaimer: string;
  source: ModelSource;
}

const MAX_PETITIONER = 200;
const MAX_TEXT = 4000;
const MAX_RFE = 12000;
const MIN_RFE = 20;
const MAX_CRITERIA = 32;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Statuses worth reinforcing in a response (an RFE often targets the weak ones,
 *  so Partial is included; only "None" — no evidence at all — is excluded). */
function isAddressable(status: string): boolean {
  return status === "Met" || status === "Strong" || status === "Partial";
}

/**
 * Validate and normalize an untrusted request body. The RFE notice text is
 * required; petitioner/classification default and criteria are optional.
 */
export function parseRfeRequest(
  body: unknown,
): { ok: true; value: RfeRequest } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const record = body as Record<string, unknown>;

  const rfeText = str(record.rfeText, MAX_RFE);
  if (rfeText.length < MIN_RFE) {
    return { ok: false, error: "Paste the text of the RFE you received." };
  }

  const petitioner = str(record.petitioner, MAX_PETITIONER) || "the beneficiary";
  const classification = str(record.classification, 40) || "O-1A";

  const rawCriteria = Array.isArray(record.criteria) ? record.criteria : [];
  const criteria: RfeCriterion[] = rawCriteria
    .slice(0, MAX_CRITERIA)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      name: str(c.name, 120),
      status: str(c.status, 20),
      evidence: str(c.evidence, MAX_TEXT),
      rationale: str(c.rationale, MAX_TEXT),
    }))
    .filter((c) => c.name !== "");

  return { ok: true, value: { petitioner, classification, criteria, rfeText } };
}

function criteriaLines(req: RfeRequest): string[] {
  if (req.criteria.length === 0) return ["- (no criteria provided)"];
  return req.criteria.map(
    (c) =>
      `- ${c.name} [${c.status}]: ${c.evidence || "(no specific evidence provided)"}` +
      (c.rationale ? ` — ${c.rationale}` : ""),
  );
}

/**
 * The prompt sent to Gemini. Strict citation discipline: address the RFE using
 * ONLY the evidence already on record; do not fabricate new evidence.
 */
export function buildRfePrompt(req: RfeRequest): string {
  return [
    "You are drafting a response to a U.S. CIS Request for Evidence (RFE) for an",
    `${req.classification} petition, as work product for the attorney of record to review and sign.`,
    "",
    "STRICT RULES — follow all of them:",
    "1. Address the specific points the RFE raises. Use ONLY the facts provided",
    "   (the petition criteria and their evidence). Do NOT invent evidence,",
    "   documents, exhibits, or facts that were not provided.",
    "2. This is a DRAFT for attorney review — never legal advice, never final.",
    "3. Formal, professional tone suitable for a USCIS filing.",
    "4. Do NOT cite case law or court decisions (no named cases or reporter",
    "   citations). Citing the governing statute or regulation is fine; the",
    "   attorney of record will add any case-law authorities.",
    "",
    `Beneficiary: ${req.petitioner}`,
    `Classification: ${req.classification}`,
    "Petition criteria on record (name [status]: evidence — rationale):",
    ...criteriaLines(req),
    "",
    "The RFE notice text:",
    req.rfeText,
    "",
    "Return STRICT JSON ONLY (no markdown, no prose), shaped exactly:",
    '{ "sections": [ { "heading": "...", "body": "..." } ] }',
    "Include an opening that identifies the petition and the RFE, one section",
    "addressing each issue the RFE raises (reinforcing the relevant criteria with",
    "the evidence on record), and a closing. Return the JSON now.",
  ].join("\n");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function toSection(value: unknown): DraftSection | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const heading = typeof row.heading === "string" ? row.heading.trim() : "";
  const body = typeof row.body === "string" ? row.body.trim() : "";
  if (heading === "" || body === "") return null;
  return { heading, body };
}

/** Normalize a model response, falling back to the deterministic mock. */
export function parseRfeResponse(text: string, req: RfeRequest): RfeResponse {
  const parsed = extractJson(text);
  if (parsed && typeof parsed === "object") {
    const raw = (parsed as Record<string, unknown>).sections;
    if (Array.isArray(raw)) {
      const sections = raw.map(toSection).filter((s): s is DraftSection => s !== null);
      if (sections.length > 0) return { sections };
    }
  }
  return mockRfe(req);
}

/**
 * Deterministic RFE response used when no GEMINI_API_KEY is set. An opening that
 * names the petition/RFE, one section reinforcing each addressable criterion,
 * and a closing. Same disclaimer as the model path.
 */
export function mockRfe(req: RfeRequest): RfeResponse {
  const addressable = req.criteria.filter((c) => isAddressable(c.status));
  const opening: DraftSection = {
    heading: "Response to Request for Evidence",
    body:
      `This brief responds to the Request for Evidence issued in the ${req.classification} ` +
      `petition filed on behalf of ${req.petitioner}. Each point raised in the notice is ` +
      `addressed below, with reference to the evidence already in the record. The attorney ` +
      `of record will review and finalize this response before it is submitted to USCIS.`,
  };
  const body: DraftSection[] = addressable.map((c) => ({
    heading: `Re: ${c.name}`,
    body:
      `In response to the concern regarding the "${c.name}" criterion, the record establishes the ` +
      `following. ${c.evidence ? `${c.evidence}. ` : ""}${c.rationale ? `${c.rationale} ` : ""}` +
      `Counsel will confirm and, where helpful, supplement this evidence prior to filing.`,
  }));
  const fallback: DraftSection[] =
    body.length === 0
      ? [
          {
            heading: "Additional evidence",
            body:
              `The petitioner will provide additional documentation responsive to the RFE. ` +
              `The attorney of record will identify and assemble the specific exhibits before filing.`,
          },
        ]
      : [];
  const closing: DraftSection = {
    heading: "Conclusion",
    body:
      `For the reasons stated, the record — taken as a whole — satisfies the requirements raised ` +
      `in the RFE. The attorney of record will review, finalize, and sign this response before it ` +
      `is submitted to USCIS.`,
  };
  return { sections: [opening, ...body, ...fallback, closing] };
}

export function buildRfeResult(
  response: RfeResponse,
  source: RfeResult["source"],
): RfeResult {
  return { ...response, disclaimer: DISCLAIMER, source };
}
