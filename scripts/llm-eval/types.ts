/**
 * Shared types for the LLM-eval harness.
 *
 * A "scenario" is one realistic input that gets through to a live model at one
 * of the app's six LLM call sites. A "gate" is an automated quality check run
 * against (prompt, raw output, parsed result). See gates.ts and scenarios.ts.
 */

/** The six places the app invokes an LLM (see scripts/llm-eval/README.md). */
export type Site =
  | "guidance"
  | "qualify"
  | "draft"
  | "draft_section"
  | "rfe"
  | "evidence";

/**
 * pass  — the behavior held.
 * fail  — a hard, deterministic invariant was violated (compliance/structure).
 * warn  — a softer signal worth a human's eyes (possible fabrication, style).
 *
 * A gate that does not apply to a scenario is represented by ABSENCE (the gate
 * simply doesn't push a result), not by a distinct verdict.
 */
export type Verdict = "pass" | "fail" | "warn";

export interface GateResult {
  id: string;
  verdict: Verdict;
  detail: string;
}

/** Per-scenario expectations the gates read. All optional — only set what a
 *  given scenario means to probe. */
export interface Expectation {
  // — qualify —
  /** Criteria the profile clearly evidences (SHOULD be Met/Strong → warn if not). */
  shouldBeMet?: string[];
  /** Criteria the profile gives NO basis for (MUST NOT be Met/Strong → fail). */
  mustNotBeMet?: string[];
  minLikelihood?: number;
  maxLikelihood?: number;

  // — evidence —
  /** The bucket the document should land in (a criterion name or "Unsorted"). */
  expectedBucket?: string;

  // — rfe —
  /** Topics the RFE raises; the response must collectively address them. */
  rfeKeywords?: string[];
  /** A criterion with no evidence on record — the response must not invent any. */
  noEvidenceCriterion?: string;

  // — guidance —
  /** The situation asks for legal advice ("should I file?"); output must refuse. */
  mustRefuseAdvice?: boolean;

  /** Free-text note on what this scenario is really testing. */
  notes?: string;
}

export interface Scenario {
  /** Stable id, e.g. "Q01", "D03". */
  id: string;
  site: Site;
  title: string;
  /** One line: the behavior this scenario probes. */
  intent: string;
  /** The request body for the site (validates clean → reaches the model). */
  input: Record<string, unknown>;
  /** For draft_section only: the criterion name to regenerate. */
  focus?: string;
  expect: Expectation;
}

/** Everything a gate needs to judge one run. */
export interface GateContext {
  scenario: Scenario;
  /** The classification in play (from input; defaults O-1A). */
  classification: string;
  /** The exact prompt sent to the model. */
  prompt: string;
  /** Raw model text (pre-parse). */
  raw: string;
  /** Parsed + disclaimer-wrapped result for the site. */
  result: Record<string, unknown>;
  /** All human-readable text the model produced, concatenated (for scans). */
  outputText: string;
  /** The engine that actually answered ("claude" | "gemini" | "mock"). */
  source: string;
  durationMs: number;
}
