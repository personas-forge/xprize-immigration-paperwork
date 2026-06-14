/**
 * Pure logic for USCIS form-field guidance.
 *
 * No network, no React, no `process.env` reads — just request validation, the
 * model prompt, and the templated informational fallback. The API route wires
 * these to Gemini (or the fallback); keeping them pure makes the
 * non-negotiable disclaimer and the validation rules unit-testable.
 *
 * COMPLIANCE: every guidance payload carries `DISCLAIMER`. This product can
 * never present AI output as legal advice (UPL risk). The disclaimer is part
 * of the data contract, not a UI afterthought.
 */

export interface GuidanceRequest {
  formId: string;
  fieldLabel: string;
  situation: string;
}

import { type ModelSource } from "@/lib/llm/label";
import { DISCLAIMER } from "@/lib/result";

export interface GuidanceResponse {
  guidance: string;
  disclaimer: string;
  /** "mock" (template) or the engine that generated it ("gemini" | "claude"). */
  source: ModelSource;
}

// `DISCLAIMER` re-exported for back-compat. Canonical home + authoritative
// docstring: `@/lib/result` (ADR-0011). Do not duplicate the prose here.
export { DISCLAIMER };

const MAX_FIELD = 4000;

/**
 * Flatten newlines and control characters in an untrusted field to single
 * spaces. {@link buildGuidancePrompt} interpolates these values directly into
 * the model prompt, so without this a multi-line `fieldLabel`/`situation` could
 * inject instructions that escape the user-input section (prompt injection).
 */
function sanitizeField(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex -- intentional: this control-char strip IS the prompt-injection guard
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Validate and normalize an untrusted request body. Returns the cleaned
 * request or a human-readable error — never throws, so the route stays a
 * thin 200/400 switch.
 */
export function parseGuidanceRequest(
  body: unknown,
): { ok: true; value: GuidanceRequest } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const record = body as Record<string, unknown>;
  const formId = record.formId;
  const fieldLabel = record.fieldLabel;
  const situation = record.situation;

  if (typeof formId !== "string" || formId.trim() === "") {
    return { ok: false, error: "`formId` is required." };
  }
  if (typeof fieldLabel !== "string" || fieldLabel.trim() === "") {
    return { ok: false, error: "`fieldLabel` is required." };
  }
  if (typeof situation !== "string" || situation.trim() === "") {
    return { ok: false, error: "`situation` is required." };
  }
  if (
    formId.length > MAX_FIELD ||
    fieldLabel.length > MAX_FIELD ||
    situation.length > MAX_FIELD
  ) {
    return { ok: false, error: "Input is too long." };
  }

  return {
    ok: true,
    value: {
      formId: sanitizeField(formId),
      fieldLabel: sanitizeField(fieldLabel),
      situation: sanitizeField(situation),
    },
  };
}

/**
 * The system/prompt sent to Gemini. It instructs the model to give general
 * informational guidance ONLY, never legal advice, and to recommend attorney
 * review — the same boundary the disclaimer states to the user.
 */
export function buildGuidancePrompt(req: GuidanceRequest): string {
  return [
    "You are an informational assistant for a U.S. immigration paperwork",
    "product. You help users understand what a USCIS form field is asking",
    "for, in plain language.",
    "",
    "STRICT RULES — you must follow all of them:",
    "1. Provide GENERAL INFORMATIONAL guidance only. Never give legal advice,",
    "   never tell the user what to file, and never predict an outcome.",
    "2. Do not interpret the user's specific eligibility or recommend a legal",
    "   strategy. Explain what the field generally asks for and what kinds of",
    "   information typically belong there.",
    "3. Always recommend that an attorney of record review the petition.",
    "4. Be concise: 3–6 short sentences. No preamble, no headings.",
    "",
    `USCIS form: ${req.formId}`,
    `Field: ${req.fieldLabel}`,
    `User's described situation: ${req.situation}`,
    "",
    "Write the informational guidance now.",
  ].join("\n");
}

/**
 * Templated informational guidance used when no GEMINI_API_KEY is configured
 * (the default, secret-free build path). Deterministic and dependency-free,
 * and it still carries the disclaimer via `buildGuidanceResponse`.
 */
export function mockGuidance(req: GuidanceRequest): string {
  return [
    `On USCIS form ${req.formId}, the field "${req.fieldLabel}" generally asks`,
    `you to provide accurate, complete information that matches your supporting`,
    `evidence. Based on what you described — "${req.situation}" — gather the`,
    `documents that substantiate each fact (dates, names, and figures should`,
    `match across your exhibits). Enter information exactly as it appears on`,
    `official records, and flag anything you are unsure about for your attorney`,
    `of record to confirm before filing.`,
  ].join(" ");
}

/** Wrap raw guidance text in the response contract, always attaching the disclaimer. */
export function buildGuidanceResponse(
  guidance: string,
  source: GuidanceResponse["source"],
): GuidanceResponse {
  return { guidance: guidance.trim(), disclaimer: DISCLAIMER, source };
}
