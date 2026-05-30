/**
 * Pure logic for the evidence vault — document categorization + coverage.
 *
 * Given a document's name and text content, classify it into one of the
 * criteria for the case's VISA CLASSIFICATION (or "Unsorted") and pull out a
 * few key facts. `summarizeVault` turns a set of categorized documents into
 * coverage counts and the list of criteria with no evidence yet (the gaps).
 *
 * Multi-product: the buckets follow the case's pack (see qualification/packs),
 * so an O-1B vault sorts into the arts criteria and an EB-1A vault into its ten.
 *
 * Pure (no network/React/env): the route wires categorization to Gemini or the
 * deterministic keyword fallback. Binary upload + Document AI OCR are an env-
 * gated production extension; this module works from text either way.
 *
 * COMPLIANCE: categorization is informational only (it suggests where a
 * document fits, it does not determine eligibility). Every result carries the
 * shared `DISCLAIMER`.
 */

import { DISCLAIMER } from "@/features/guidance/guidance";
import { type ModelSource } from "@/lib/llm/label";
import { O1A_CRITERIA, criteriaNames, packFor } from "@/features/qualification";

export { DISCLAIMER, O1A_CRITERIA, criteriaNames };

/** A criterion bucket — a criterion name, or the catch-all. */
export type Bucket = string;

export interface CategorizeRequest {
  name: string;
  content: string;
}

export interface CategorizeAssessment {
  criterion: Bucket;
  facts: string[];
}

export interface CategorizeResult extends CategorizeAssessment {
  disclaimer: string;
  source: ModelSource;
}

const MAX_NAME = 200;
const MIN_CONTENT = 20;
const MAX_CONTENT = 12000;
const MAX_FACTS = 6;

/** Validate and normalize an untrusted request body. */
export function parseCategorizeRequest(
  body: unknown,
): { ok: true; value: CategorizeRequest } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const record = body as Record<string, unknown>;
  const name =
    typeof record.name === "string" && record.name.trim() !== ""
      ? record.name.trim().slice(0, MAX_NAME)
      : "";
  if (name === "") return { ok: false, error: "Give the document a name." };

  const content = typeof record.content === "string" ? record.content.trim() : "";
  if (content.length < MIN_CONTENT) {
    return {
      ok: false,
      error: "Paste or describe the document's contents (a sentence or two).",
    };
  }
  if (content.length > MAX_CONTENT) {
    return { ok: false, error: "That's too long — please trim the content." };
  }
  return { ok: true, value: { name, content: content.slice(0, MAX_CONTENT) } };
}

/** The prompt sent to Gemini. Classify into ONE of the classification's criteria
 *  (or "Unsorted") and extract a few key facts, as strict JSON. */
export function buildCategorizePrompt(
  req: CategorizeRequest,
  classification = "O-1A",
): string {
  const names = criteriaNames(classification);
  return [
    `You are an informational assistant for a U.S. ${classification} immigration`,
    "product. You sort a piece of supporting evidence into the criterion it best",
    "supports, and pull out a few key facts. You do NOT determine eligibility.",
    "",
    "STRICT RULES:",
    "1. Pick exactly ONE criterion from the list (or \"Unsorted\" if none fits).",
    "2. Base facts ONLY on the document's content; do not invent anything.",
    "3. This is informational categorization, not legal advice.",
    "",
    `The ${classification} criteria:`,
    ...names.map((c, i) => `${i + 1}. ${c}`),
    "",
    `Document name: ${req.name}`,
    "Document content:",
    req.content,
    "",
    'Return STRICT JSON ONLY: { "criterion": "<one criterion or Unsorted>", "facts": ["<short fact>", "..."] }',
    "Return the JSON now.",
  ].join("\n");
}

function coerceBucket(value: unknown, classification: string): Bucket {
  const allowed = new Set<string>([...criteriaNames(classification), "Unsorted"]);
  return allowed.has(value as string) ? (value as Bucket) : "Unsorted";
}

/** Normalize a model response, falling back to the deterministic keyword mock. */
export function parseCategorizeResponse(
  text: string,
  req: CategorizeRequest,
  classification = "O-1A",
): CategorizeAssessment {
  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== "object") return mockCategorize(req, classification);
  const obj = parsed as Record<string, unknown>;
  const facts = Array.isArray(obj.facts)
    ? obj.facts
        .filter((f): f is string => typeof f === "string" && f.trim() !== "")
        .map((f) => f.trim().slice(0, 240))
        .slice(0, MAX_FACTS)
    : [];
  return { criterion: coerceBucket(obj.criterion, classification), facts };
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

const FACT_SPLIT = /(?<=[.!?])\s+/;

/** Deterministic categorization used when no GEMINI_API_KEY is set. Tests the
 *  classification pack's criterion keyword heuristics in order. */
export function mockCategorize(
  req: CategorizeRequest,
  classification = "O-1A",
): CategorizeAssessment {
  const haystack = `${req.name}\n${req.content}`;
  const matched = packFor(classification).criteria.find((pc) => pc.match.test(haystack));
  const criterion: Bucket = matched ? matched.name : "Unsorted";
  const facts = req.content
    .split(FACT_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 2)
    .map((s) => s.slice(0, 240));
  return { criterion, facts };
}

export function buildCategorizeResult(
  assessment: CategorizeAssessment,
  source: CategorizeResult["source"],
): CategorizeResult {
  return { ...assessment, disclaimer: DISCLAIMER, source };
}

// — Coverage analysis ────────────────────────────────────────────────────────

export interface VaultSummary {
  /** Total criteria for the classification. */
  total: number;
  /** Criteria with at least one document. */
  covered: number;
  /** Criteria with no evidence yet — the gaps to close. */
  gaps: string[];
  /** Document count per bucket (includes "Unsorted"). */
  byCriterion: Record<string, number>;
}

/**
 * Summarize a vault into coverage counts and gaps for a classification. Robust
 * against arbitrary `criterion` strings (only the pack's criteria count toward
 * coverage; unknown/"Unsorted" buckets are tallied but never close a gap).
 */
export function summarizeVault(
  documents: readonly { criterion: string }[],
  classification = "O-1A",
): VaultSummary {
  const list = Array.isArray(documents) ? documents : [];
  const names = criteriaNames(classification);
  const byCriterion: Record<string, number> = {};
  for (const doc of list) {
    const key = doc?.criterion ?? "Unsorted";
    byCriterion[key] = (byCriterion[key] ?? 0) + 1;
  }
  const gaps = names.filter((name) => !byCriterion[name]);
  return {
    total: names.length,
    covered: names.length - gaps.length,
    gaps: [...gaps],
    byCriterion,
  };
}
