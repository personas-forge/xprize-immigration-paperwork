/**
 * Live adjudication-risk engine (moonshot #1).
 *
 * The deterministic quality gates that the LLM-eval harness runs OFFLINE
 * (UPL tripwires, the fabrication scan with stripLegal, case-law flags,
 * classification consistency, qualify completeness) are promoted here into the
 * LIVE request path: every paid generation a real user receives is scored
 * against adjudicator-shaped invariants in real time, and the result is surfaced
 * as a per-document "USCIS-readiness / compliance risk" report with exact
 * reasons ("cites case law → attorney must verify", "invented a citation count
 * not in the record").
 *
 * SINGLE SOURCE OF TRUTH: the leaf scanners (specifics / stripLegal /
 * fabricatedSpecifics / named-entity + award-status grounding / UPL advice
 * patterns / case-law detection / wrong-code detection) live HERE and are
 * imported by `scripts/llm-eval/gates.ts`, so the
 * production check can never drift from what the eval asserts. The harness keeps
 * only the SCENARIO-dependent gates (which need a test oracle that doesn't exist
 * at runtime); the invariant gates are shared.
 *
 * Pure: no network, no React, no env beyond the product constants. The only
 * runtime dependency is the real DISCLAIMER + the criteria packs, so the gate
 * reuses exactly what ships.
 */

import { DISCLAIMER } from "@/features/guidance/guidance";
import { criteriaNames } from "@/features/qualification/packs";

// — Verdict shapes ────────────────────────────────────────────────────────────

/** A live gate verdict. (The harness's offline `Verdict` adds "na"; the live
 *  path never emits it — a gate that doesn't apply is simply not run.) */
export type AdjVerdict = "pass" | "warn" | "fail";

export interface Adjudication {
  id: string;
  verdict: AdjVerdict;
  detail: string;
}

/** Overall risk derived from the gate verdicts. `blocked` = a hard invariant
 *  failed (not attorney-ready); `review` = a soft signal a human should eyeball;
 *  `ready` = every invariant held. */
export type RiskLevel = "ready" | "review" | "blocked";

export interface AdjudicationReport {
  gates: Adjudication[];
  risk: RiskLevel;
  /** True ⇔ zero hard failures — the gate the user-visible "attorney-ready"
   *  state is bound to (moonshot step 6). */
  attorneyReady: boolean;
}

function a(id: string, verdict: AdjVerdict, detail = ""): Adjudication {
  return { id, verdict, detail };
}

// — Shared leaf scanners (also imported by the eval harness) ───────────────────

/** Content tokens (lowercased, de-noised) for crude grounding overlap. */
const STOP = new Set(
  ("the a an and or of to in on for with as at by from is are was were be been " +
    "this that these those it its his her their our your my you we they i he she " +
    "will would should could can may might must has have had do does did not no " +
    "which who whom whose what when where why how all any both each few more most " +
    "other some such than too very s t can't won't").split(/\s+/),
);

export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/**
 * "Specifics" that would be fabrication if they appear in OUTPUT but not INPUT:
 * money ($...), percentages, 4-digit years, and integers >= 100 (citation
 * counts, audience sizes). Small structural integers (e.g. "3 of 8") are
 * deliberately ignored — they're argument scaffolding, not invented facts.
 */
export function specifics(text: string): string[] {
  const out = new Set<string>();
  const money = text.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) ?? [];
  const pct = text.match(/\b\d[\d,]*(?:\.\d+)?\s?%/g) ?? [];
  const years = text.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  const bigInts = (text.match(/\b\d[\d,]{2,}\b/g) ?? []).filter(
    (n) => Number(n.replace(/,/g, "")) >= 100,
  );
  for (const m of [...money, ...pct, ...years, ...bigInts]) out.add(m.trim());
  return [...out];
}

export function norm(s: string): string {
  return s.replace(/[\s,$%]/g, "");
}

/**
 * Strip legal citations before the fabrication scan — citing "8 CFR 214.2(o)"
 * or "INA 101(a)(15)(O)" is correct petition practice, not invented evidence.
 * Numbers inside those citations must not count as fabricated specifics.
 */
export function stripLegal(text: string): string {
  return text
    .replace(/\b8\s*C\.?\s*F\.?\s*R\.?\s*§?\s*[\d.]+(?:\([a-z0-9]+\))*/gi, " ")
    .replace(/\bINA\s*§?\s*(?:section\s*)?[\d.]+(?:\([a-z0-9]+\))*/gi, " ")
    .replace(/\b(?:section|§)\s*[\d.]+(?:\([a-z0-9]+\))*/gi, " ")
    .replace(/\b\d{2,4}\(a\)\(\d+\)(?:\([A-Za-z0-9]+\))*/g, " ")
    .replace(/\bForm\s+[A-Z]-?\d+[A-Z]?/gi, " ")
    // Case-law reporter cites: "596 F.3d 1115", "123 F. Supp. 2d 456", "410 U.S. 113".
    .replace(/\b\d+\s+F\.?\s?(?:Supp\.?\s?)?\d?d?\s+\d+\b/gi, " ")
    .replace(/\b\d+\s+U\.?\s?S\.?\s?(?:C\.?)?\s+§?\s*\d+/gi, " ")
    // "(9th Cir. 2010)" and bare "9th Cir. 2010" — note "9th" carries a digit.
    .replace(/\(?\s*(?:[A-Za-z0-9.]+\s+)*Cir\.?\s+(?:19|20)\d{2}\s*\)?/gi, " ");
}

// Common INA/CFR section numbers that are references, never invented facts.
const LEGAL_NUMS = new Set(["101", "203", "204", "214", "1101", "1153", "1154", "1184"]);

/** Output specifics not traceable to the input text (legal citations exempt). */
export function fabricatedSpecifics(outputText: string, inputText: string): string[] {
  const have = new Set(specifics(stripLegal(inputText)).map(norm));
  return specifics(stripLegal(outputText)).filter(
    (s) => !have.has(norm(s)) && !LEGAL_NUMS.has(norm(s)),
  );
}

// — Qualitative fabrication (named entities + award status) ────────────────────
// The numbers-only `fabricatedSpecifics` above misses the fabrication classes a
// signing physician/attorney fears most: an invented or renamed clinical trial,
// a society the beneficiary doesn't belong to, a journal/award that doesn't
// exist, or a nomination written up as a win (UAT 2026-06-20 LLM-2 / ao-draft-01,
// YT-DR-01). These scanners surface those for attorney verification — never
// auto-block (a heuristic must not fail a legitimately-grounded paid draft).

// Cue words that mark a SPECIFIC named institution / award / work / study. Only
// matched at the END of a Capitalized proper-noun phrase, so generic prose
// ("won an award") never trips it — proper nouns in formal petition prose are
// capitalized.
const ENTITY_CUE =
  "Award|Awards|Prize|Medal|Fellowship|Festival|Guild|Society|Association|" +
  "Academy|Institute|Foundation|University|College|Laboratory|Laboratories|" +
  "Journal|Conference|Symposium|Biennale|Trial|Study|Championship|Championships|" +
  "Olympiad|Grammy|Emmy|Oscar|Tony|Pulitzer|Nobel|Turing";

// 1–4 leading Capitalized/numeric tokens then a cue: "Sundance Film Festival",
// "Lasker Award", "Phase III ENGAGE Trial", "Directors Guild". Case-sensitive on
// purpose (proper nouns only).
const ENTITY_RE = new RegExp(
  `\\b((?:[A-Z][A-Za-z0-9.&'-]+\\s+){1,4}(?:${ENTITY_CUE}))\\b`,
  "g",
);

/** Distinct named entities (institutions / awards / works / studies) in the text. */
export function namedEntities(text: string): string[] {
  return [...new Set((text.match(ENTITY_RE) ?? []).map((s) => s.trim()))];
}

// Government/legal/structural entities expected in ANY petition — not claims
// about the beneficiary, so never flagged.
const ENTITY_ALLOW = new Set(
  ("uscis citizenship immigration services department homeland security state").split(/\s+/),
);
const CUE_TOKENS = new Set(ENTITY_CUE.toLowerCase().split("|"));

/**
 * Named entities asserted in the OUTPUT whose distinctive words do NOT appear in
 * the grounding — i.e. likely invented or misnamed. Conservative: an entity is
 * "grounded" if ANY of its distinctive (non-cue, non-generic) tokens is in the
 * input, so a paraphrase ("Zenith Prize" → "Zenith Excellence Award") is NOT
 * flagged; only a name with no traceable token at all is.
 */
export function unsupportedEntities(outputText: string, inputText: string): string[] {
  const have = tokens(stripLegal(inputText));
  return namedEntities(stripLegal(outputText)).filter((entity) => {
    const distinctive = [...tokens(entity)].filter(
      (t) => !CUE_TOKENS.has(t) && !ENTITY_ALLOW.has(t),
    );
    if (distinctive.length === 0) return false; // nothing distinctive to trace
    return !distinctive.some((t) => have.has(t)); // none traced → suspicious
  });
}

const WIN_SIGNAL =
  /\b(won|winner|first\s+place|first\s+prize|gold\s+medal(?:l?ist)?|laureate|awarded\s+the|recipient\s+of)\b/i;
const NOMINATION_SIGNAL =
  /\b(nominat\w*|finalist|shortlist\w*|semifinalist|longlist\w*|in\s+the\s+running|considered\s+for|in\s+contention)\b/i;

/**
 * True when the OUTPUT asserts a WIN the grounding doesn't support — the record
 * shows only a nomination/finalist and NO win. Catches "nomination → win"
 * inflation (e.g. an IGF *nomination* written up as "won the IGF Award").
 */
export function inflatedAwardStatus(outputText: string, inputText: string): boolean {
  if (!WIN_SIGNAL.test(outputText)) return false;
  return !WIN_SIGNAL.test(inputText) && NOMINATION_SIGNAL.test(inputText);
}

// Periods that are NOT sentence boundaries in immigration prose. Masking these
// before the split stops "Form I-129, a U.S. employer, see 8 C.F.R. 214.2(o),
// e.g. …" from being mis-counted as many short sentences (which would trip the
// guidance-concise gate on perfectly good, domain-correct writing).
const ABBREVIATIONS =
  /\b(?:U\.S|U\.S\.C|C\.F\.R|e\.g|i\.e|etc|vs|no|inc|llc|co|ltd|dept|fig|sec|art|para|pp|cf|al|mr|mrs|ms|dr|st|ave)\./gi;
const INITIALS = /\b(?:[A-Za-z]\.){2,}/g; // A.B.C. / U.S.C. — letter-dot sequences
const LIST_MARKER = /(^|\n)[ \t]*\d+\./g; // "1." / "2." at the start of a line

// Replace the non-terminal periods with spaces so a terminal-punctuation split
// can't treat them as sentence ends. Dot→space is 1:1, so the result has the
// SAME length as the input and character indices stay aligned with it — which is
// what lets clampSentences slice the original text by a position found here.
function maskNonTerminalPeriods(text: string): string {
  return text
    .replace(ABBREVIATIONS, (m) => m.replace(/\./g, " "))
    .replace(INITIALS, (m) => m.replace(/\./g, " "))
    .replace(LIST_MARKER, (m) => m.replace(/\./g, " "));
}

export function sentenceCount(text: string): number {
  return maskNonTerminalPeriods(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/**
 * Trim `text` to at most `max` sentences, preserving the original characters.
 * Masking only affects boundary detection (it's length-preserving), so a
 * boundary index in the masked string slices the real text correctly. Used to
 * ENFORCE the guidance "3–6 short sentences" contract on model output that
 * overshoots — under-length text is returned unchanged.
 */
export function clampSentences(text: string, max: number): string {
  const trimmed = text.trim();
  if (max <= 0) return trimmed;
  const masked = maskNonTerminalPeriods(trimmed);
  const boundary = /[.!?]\s+/g;
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(masked)) !== null) {
    count += 1;
    // Cut right after the terminal punctuation of the max-th sentence.
    if (count >= max) return trimmed.slice(0, m.index + 1).trim();
  }
  return trimmed;
}

// Phrases that cross the line from "informational" into legal advice / outcome
// prediction. These are the UPL tripwires.
const ADVICE_PATTERNS: RegExp[] = [
  /\byou\s+(?:will|would|are\s+(?:likely|certain|sure)\s+to)\s+(?:qualify|be\s+approved|get\s+approved|win|succeed)\b/i,
  /\byou\s+(?:do|definitely)\s+qualify\b/i,
  /\byou\s+should\s+(?:file|apply|petition|wait|choose|select|pursue|go\s+with)\b/i,
  /\bi\s+(?:recommend|advise|suggest)\s+(?:that\s+)?you\b/i,
  /\byour\s+best\s+(?:option|bet|choice)\s+is\b/i,
  /\bis\s+the\s+better\s+(?:option|choice)\s+for\s+you\b/i,
];

/**
 * An AFFIRMATIVE guarantee of an outcome — not a negated or factual use. Both
 * "premium processing does not guarantee approval" and "a guaranteed
 * adjudication timeframe" are correct, lawful statements and must NOT trip this.
 */
export function affirmsOutcomeGuarantee(text: string): boolean {
  return text.split(/(?<=[.!?])\s+/).some((s) => {
    if (!/\bguarantee/i.test(s)) return false;
    if (/\b(?:no|not|never|cannot|can'?t|doesn'?t|does\s+not|won'?t|will\s+not)\b/i.test(s)) return false;
    return /\b(?:approv|the\s+visa|success|qualif|admission|you\s+will\s+(?:get|be|win))\b/i.test(s);
  });
}

export function matchedAdvice(text: string): string[] {
  const hits = ADVICE_PATTERNS.map((p) => text.match(p)?.[0]).filter((m): m is string => !!m);
  if (affirmsOutcomeGuarantee(text)) hits.push("guarantees an outcome");
  return hits;
}

export const KNOWN_CODES = ["O-1A", "O-1B", "EB-1A"];

/** Visa codes other than the requested one that leaked into the output. */
export function wrongCodes(outputText: string, classification: string): string[] {
  const wrong = KNOWN_CODES.filter((c) => c !== classification);
  return wrong.filter((c) =>
    new RegExp(`\\b${c.replace(/[-]/g, "[-\\s]?")}\\b`, "i").test(outputText),
  );
}

// Reporter cites / "Matter of X" / "(Nth Cir. YYYY)" — strong legal-citation
// signals. A model can hallucinate a real-looking but nonexistent case, so any
// case-law cite is flagged for attorney verification (not auto-failed).
const CASELAW =
  /\b\d+\s+F\.?\s?(?:Supp\.?\s?)?\d?d?\s+\d+\b|\bMatter\s+of\s+[A-Z][A-Za-z-]+|\b(?:[A-Za-z.]+\s+)?Cir\.\s+(?:19|20)\d{2}/g;

/** Distinct case-law citations detected in the text. */
export function caseLawHits(text: string): string[] {
  return [...new Set((text.match(CASELAW) ?? []).map((s) => s.trim()))];
}

// — Live adjudication ─────────────────────────────────────────────────────────

/** Everything the live gate needs to judge one paid generation. */
export interface AdjudicationContext {
  /** The operation key: draft | draft_section | rfe | qualify | guidance | categorize. */
  operation: string;
  /** The classification in play (drives wrong-code + criteria checks). */
  classification: string;
  /** The engine that answered ("claude" | "gemini" | "mock"). */
  source: string;
  /** The built response body (carries the disclaimer + parsed payload). */
  result: Record<string, unknown>;
  /** The grounding source text the output must trace to (criteria evidence,
   *  RFE text, petitioner, profile). Empty when there's nothing to ground on. */
  inputText: string;
  /** The human-readable model output, concatenated, for the scans. */
  outputText: string;
}

/** Disclaimer invariant — present + unaltered on every AI output. */
function disclaimerGate(result: Record<string, unknown>): Adjudication {
  const disc = (result.disclaimer as string) ?? "";
  return disc === DISCLAIMER
    ? a("disclaimer-present", "pass", "UPL disclaimer attached")
    : a("disclaimer-present", "fail", `disclaimer missing or altered (${disc.length} chars)`);
}

/** Fabrication scan — specifics in the output not traceable to the record. */
function fabricationGate(ctx: AdjudicationContext): Adjudication {
  const fabricated = fabricatedSpecifics(ctx.outputText, ctx.inputText);
  return fabricated.length === 0
    ? a("no-fabrication", "pass", "no invented numbers/years/money")
    : a("no-fabrication", "warn", `specifics not in the record — verify: ${fabricated.join(", ")}`);
}

/** Qualitative-fabrication scan — named entities (awards/societies/trials/
 *  journals) + award status the numbers-only scan misses. WARN: an attorney
 *  verifies; it never auto-blocks a legitimately-grounded draft. */
function groundingGate(ctx: AdjudicationContext): Adjudication {
  const entities = unsupportedEntities(ctx.outputText, ctx.inputText);
  const inflated = inflatedAwardStatus(ctx.outputText, ctx.inputText);
  if (entities.length === 0 && !inflated) {
    return a("grounded-claims", "pass", "named entities trace to the record");
  }
  const parts: string[] = [];
  if (entities.length) {
    parts.push(`names not in the record — verify: ${entities.slice(0, 4).join(" | ")}`);
  }
  if (inflated) parts.push("asserts a win the record shows only as a nomination");
  return a("grounded-claims", "warn", parts.join("; "));
}

/** Case-law flag — any cite an attorney must independently verify is real. */
function caseLawGate(ctx: AdjudicationContext): Adjudication {
  const hits = caseLawHits(ctx.outputText);
  return hits.length === 0
    ? a("caselaw-review", "pass", "no case-law citations")
    : a("caselaw-review", "warn", `cites case law — attorney must verify: ${hits.slice(0, 4).join(" | ")}`);
}

/** Classification consistency — no other visa code leaked into a letter. */
function classificationGate(ctx: AdjudicationContext): Adjudication {
  const codes = wrongCodes(ctx.outputText, ctx.classification);
  return codes.length === 0
    ? a("classification-consistent", "pass", `reads as ${ctx.classification}`)
    : a("classification-consistent", "fail", `mentions other visa code(s): ${codes.join(", ")}`);
}

/** UPL tripwire — no legal advice / outcome prediction in informational output. */
function legalAdviceGate(ctx: AdjudicationContext): Adjudication {
  const advice = matchedAdvice(ctx.outputText);
  return advice.length === 0
    ? a("no-legal-advice", "pass", "informational, no advice/outcome language")
    : a("no-legal-advice", "fail", `advice/outcome language: ${advice.join(" | ")}`);
}

/** Qualify structural invariants: canonical criteria, valid statuses, range. */
function qualifyGates(ctx: AdjudicationContext): Adjudication[] {
  const out: Adjudication[] = [];
  const criteria = (ctx.result.criteria as Array<Record<string, unknown>>) ?? [];
  const canonical = criteriaNames(ctx.classification);
  const names = criteria.map((c) => String(c.name));
  out.push(
    names.length === canonical.length && names.every((nm, i) => nm === canonical[i])
      ? a("qualify-criteria-complete", "pass", `all ${canonical.length} criteria, canonical order`)
      : a("qualify-criteria-complete", "fail", `expected ${canonical.length} canonical; got ${names.length}`),
  );
  const VALID = new Set(["Met", "Strong", "Partial", "None"]);
  const bad = criteria.filter((c) => !VALID.has(String(c.status)));
  out.push(
    bad.length === 0
      ? a("qualify-status-valid", "pass")
      : a("qualify-status-valid", "fail", `invalid statuses: ${bad.map((c) => c.status).join(", ")}`),
  );
  const lk = ctx.result.likelihood as number;
  out.push(
    Number.isInteger(lk) && lk >= 0 && lk <= 100
      ? a("qualify-likelihood-range", "pass", `${lk}`)
      : a("qualify-likelihood-range", "fail", `likelihood out of range: ${lk}`),
  );
  return out;
}

/** Evidence categorization invariant: the bucket is in the pack (or Unsorted). */
function evidenceGates(ctx: AdjudicationContext): Adjudication[] {
  const bucket = String(ctx.result.criterion ?? "");
  const allowed = new Set([...criteriaNames(ctx.classification), "Unsorted"]);
  return [
    allowed.has(bucket)
      ? a("evidence-bucket-valid", "pass", `→ ${bucket}`)
      : a("evidence-bucket-valid", "fail", `bucket "${bucket}" not in the ${ctx.classification} pack`),
  ];
}

/** Roll the gate verdicts into an overall risk + attorney-ready flag. */
function summarize(gates: Adjudication[]): AdjudicationReport {
  const hasFail = gates.some((g) => g.verdict === "fail");
  const hasWarn = gates.some((g) => g.verdict === "warn");
  const risk: RiskLevel = hasFail ? "blocked" : hasWarn ? "review" : "ready";
  return { gates, risk, attorneyReady: !hasFail };
}

/**
 * Score one live generation against the adjudicator-shaped invariants for its
 * operation. Returns the gate verdicts plus an overall risk and the
 * attorney-ready flag (zero hard failures).
 */
export function runAdjudication(ctx: AdjudicationContext): AdjudicationReport {
  const gates: Adjudication[] = [disclaimerGate(ctx.result)];
  switch (ctx.operation) {
    case "draft":
    case "draft_section":
    case "rfe":
      gates.push(
        classificationGate(ctx),
        fabricationGate(ctx),
        groundingGate(ctx),
        caseLawGate(ctx),
      );
      break;
    case "qualify":
      gates.push(...qualifyGates(ctx), legalAdviceGate(ctx));
      break;
    case "guidance":
      gates.push(legalAdviceGate(ctx));
      break;
    case "categorize":
      gates.push(...evidenceGates(ctx));
      break;
  }
  return summarize(gates);
}
