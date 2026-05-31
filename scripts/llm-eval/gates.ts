/**
 * Quality gates — automated checks run against each live model run.
 *
 * Two tiers:
 *   • FAIL gates are deterministic invariants the product must never break:
 *     the disclaimer, the canonical criteria set, valid statuses/buckets,
 *     letter structure, and classification consistency (an O-1B letter must
 *     not call itself O-1A).
 *   • WARN gates are softer, high-signal-but-imperfect heuristics a human
 *     should eyeball: possible fabrication (invented numbers/years/money),
 *     ungrounded "facts", verbosity, missing attorney mention.
 *
 * Gates reuse the REAL product constants (the DISCLAIMER, the criteria packs)
 * so they can't drift from what ships.
 */
import { DISCLAIMER } from "@/features/guidance/guidance";
import { criteriaNames } from "@/features/qualification/packs";
import type { GateContext, GateResult, Verdict } from "./types";

// — small helpers ─────────────────────────────────────────────────────────────

function r(id: string, verdict: Verdict, detail = ""): GateResult {
  return { id, verdict, detail };
}

const KNOWN_CODES = ["O-1A", "O-1B", "EB-1A"];

/** Content tokens (lowercased, de-noised) for crude grounding overlap. */
const STOP = new Set(
  ("the a an and or of to in on for with as at by from is are was were be been " +
    "this that these those it its his her their our your my you we they i he she " +
    "will would should could can may might must has have had do does did not no " +
    "which who whom whose what when where why how all any both each few more most " +
    "other some such than too very s t can't won't").split(/\s+/),
);
function tokens(text: string): Set<string> {
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
function specifics(text: string): string[] {
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
function norm(s: string): string {
  return s.replace(/[\s,$%]/g, "");
}

/**
 * Strip legal citations before the fabrication scan — citing "8 CFR 214.2(o)"
 * or "INA 101(a)(15)(O)" is correct petition practice, not invented evidence.
 * Numbers inside those citations must not count as fabricated specifics.
 */
function stripLegal(text: string): string {
  return text
    .replace(/\b8\s*C\.?\s*F\.?\s*R\.?\s*§?\s*[\d.]+(?:\([a-z0-9]+\))*/gi, " ")
    .replace(/\bINA\s*§?\s*(?:section\s*)?[\d.]+(?:\([a-z0-9]+\))*/gi, " ")
    .replace(/\b(?:section|§)\s*[\d.]+(?:\([a-z0-9]+\))*/gi, " ")
    .replace(/\b\d{2,4}\(a\)\(\d+\)(?:\([A-Za-z0-9]+\))*/g, " ")
    .replace(/\bForm\s+[A-Z]-?\d+[A-Z]?/gi, " ");
}
// Common INA/CFR section numbers that are references, never invented facts.
const LEGAL_NUMS = new Set(["101", "203", "204", "214", "1101", "1153", "1154", "1184"]);

/** Output specifics not traceable to the input text (legal citations exempt). */
function fabricatedSpecifics(outputText: string, inputText: string): string[] {
  const have = new Set(specifics(stripLegal(inputText)).map(norm));
  return specifics(stripLegal(outputText)).filter((s) => !have.has(norm(s)) && !LEGAL_NUMS.has(norm(s)));
}

function sentenceCount(text: string): number {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean).length;
}

// Phrases that cross the line from "informational" into legal advice / outcome
// prediction. These are the UPL tripwires.
const ADVICE_PATTERNS: RegExp[] = [
  /\byou\s+(?:will|would|are\s+(?:likely|certain|sure)\s+to)\s+(?:qualify|be\s+approved|get\s+approved|win|succeed)\b/i,
  /\byou\s+(?:do|definitely)\s+qualify\b/i,
  /\byou\s+should\s+(?:file|apply|petition|wait|choose|select|pursue|go\s+with)\b/i,
  /\bi\s+(?:recommend|advise|suggest)\s+(?:that\s+)?you\b/i,
  /\b(?:guaranteed?|guarantee)\b/i,
  /\byour\s+best\s+(?:option|bet|choice)\s+is\b/i,
  /\bis\s+the\s+better\s+(?:option|choice)\s+for\s+you\b/i,
];
function matchedAdvice(text: string): string[] {
  return ADVICE_PATTERNS.map((p) => text.match(p)?.[0]).filter((m): m is string => !!m);
}

/** Visa codes other than the requested one that leaked into the output. */
function wrongCodes(outputText: string, classification: string): string[] {
  const wrong = KNOWN_CODES.filter((c) => c !== classification);
  return wrong.filter((c) => new RegExp(`\\b${c.replace(/[-]/g, "[-\\s]?")}\\b`, "i").test(outputText));
}

// — universal gates (every site) ──────────────────────────────────────────────

function universal(ctx: GateContext): GateResult[] {
  const out: GateResult[] = [];
  const disc = (ctx.result.disclaimer as string) ?? "";
  out.push(
    disc === DISCLAIMER
      ? r("disclaimer-present", "pass", "exact UPL disclaimer attached")
      : r("disclaimer-present", "fail", `disclaimer missing or altered (got ${disc.length} chars)`),
  );
  out.push(
    ctx.source !== "mock"
      ? r("real-engine", "pass", `answered by ${ctx.source}`)
      : r("real-engine", "fail", "fell back to template (model did not answer)"),
  );
  out.push(
    ctx.raw.trim().length > 0
      ? r("nonempty-output", "pass")
      : r("nonempty-output", "fail", "empty model output"),
  );
  return out;
}

// — per-site gates ────────────────────────────────────────────────────────────

function guidanceGates(ctx: GateContext): GateResult[] {
  const out: GateResult[] = [];
  const text = (ctx.result.guidance as string) ?? "";
  const n = sentenceCount(text);
  out.push(
    n === 0 || n > 10
      ? r("guidance-concise", "fail", `${n} sentences (prompt asks 3–6)`)
      : n < 3 || n > 6
        ? r("guidance-concise", "warn", `${n} sentences (prompt asks 3–6)`)
        : r("guidance-concise", "pass", `${n} sentences`),
  );

  const advice = matchedAdvice(text);
  const mustRefuse = !!ctx.scenario.expect.mustRefuseAdvice;
  out.push(
    advice.length === 0
      ? r("guidance-no-legal-advice", "pass", mustRefuse ? "refused to advise, as required" : "")
      : r("guidance-no-legal-advice", "fail", `advice/outcome language: ${advice.join(" | ")}`),
  );

  out.push(
    /\b(attorney|counsel|lawyer)\b/i.test(text)
      ? r("guidance-mentions-attorney", "pass")
      : r("guidance-mentions-attorney", "warn", "no attorney/counsel mention in the body"),
  );

  out.push(
    /(^|\n)\s*#{1,6}\s|\*\*[^*]+\*\*\s*:/.test(text)
      ? r("guidance-no-headings", "warn", "contains markdown headings/bold labels (prompt says none)")
      : r("guidance-no-headings", "pass"),
  );
  return out;
}

function qualifyGates(ctx: GateContext): GateResult[] {
  const out: GateResult[] = [];
  const criteria = (ctx.result.criteria as Array<Record<string, unknown>>) ?? [];
  const canonical = criteriaNames(ctx.classification);
  const names = criteria.map((c) => String(c.name));
  out.push(
    names.length === canonical.length && names.every((nm, i) => nm === canonical[i])
      ? r("qualify-criteria-complete", "pass", `all ${canonical.length} criteria, canonical order`)
      : r("qualify-criteria-complete", "fail", `expected ${canonical.length} canonical; got [${names.join(", ")}]`),
  );

  const VALID = new Set(["Met", "Strong", "Partial", "None"]);
  const bad = criteria.filter((c) => !VALID.has(String(c.status)));
  out.push(
    bad.length === 0
      ? r("qualify-status-valid", "pass")
      : r("qualify-status-valid", "fail", `invalid statuses: ${bad.map((c) => c.status).join(", ")}`),
  );

  const lk = ctx.result.likelihood as number;
  out.push(
    Number.isInteger(lk) && lk >= 0 && lk <= 100
      ? r("qualify-likelihood-range", "pass", `${lk}`)
      : r("qualify-likelihood-range", "fail", `likelihood out of range: ${lk}`),
  );

  // Anti-hallucination: criteria with no basis must NOT be Met/Strong.
  const strong = new Set(
    criteria.filter((c) => c.status === "Met" || c.status === "Strong").map((c) => String(c.name).toLowerCase()),
  );
  const mustNot = ctx.scenario.expect.mustNotBeMet ?? [];
  const violated = mustNot.filter((nm) => strong.has(nm.toLowerCase()));
  if (mustNot.length) {
    out.push(
      violated.length === 0
        ? r("qualify-grounding-negative", "pass", `no false positives on [${mustNot.join(", ")}]`)
        : r("qualify-grounding-negative", "fail", `scored Met/Strong without basis: ${violated.join(", ")}`),
    );
  }

  // Positive grounding: clearly-evidenced criteria SHOULD score up (soft).
  const should = ctx.scenario.expect.shouldBeMet ?? [];
  const missed = should.filter((nm) => !strong.has(nm.toLowerCase()));
  if (should.length) {
    out.push(
      missed.length === 0
        ? r("qualify-grounding-positive", "pass", `recognised [${should.join(", ")}]`)
        : r("qualify-grounding-positive", "warn", `expected Met/Strong but weren't: ${missed.join(", ")}`),
    );
  }

  // Likelihood band (soft).
  const { minLikelihood, maxLikelihood } = ctx.scenario.expect;
  if (minLikelihood != null || maxLikelihood != null) {
    const okLo = minLikelihood == null || lk >= minLikelihood;
    const okHi = maxLikelihood == null || lk <= maxLikelihood;
    out.push(
      okLo && okHi
        ? r("qualify-likelihood-band", "pass", `${lk} within [${minLikelihood ?? "-"}, ${maxLikelihood ?? "-"}]`)
        : r("qualify-likelihood-band", "warn", `${lk} outside [${minLikelihood ?? "-"}, ${maxLikelihood ?? "-"}]`),
    );
  }

  // Evidence grounding: each Met/Strong criterion's evidence should trace to the
  // profile (crude token overlap).
  const profile = String((ctx.scenario.input as Record<string, unknown>).profile ?? "");
  const profTok = tokens(profile);
  const weak: string[] = [];
  for (const c of criteria) {
    if (c.status !== "Met" && c.status !== "Strong") continue;
    const ev = String(c.evidence ?? "");
    const et = [...tokens(ev)];
    if (et.length === 0) continue;
    const overlap = et.filter((t) => profTok.has(t)).length / et.length;
    if (overlap < 0.34) weak.push(`${c.name} (${Math.round(overlap * 100)}% in profile)`);
  }
  out.push(
    weak.length === 0
      ? r("qualify-evidence-grounded", "pass")
      : r("qualify-evidence-grounded", "warn", `evidence weakly grounded: ${weak.join("; ")}`),
  );
  return out;
}

function letterStructureGates(ctx: GateContext, kind: "draft" | "rfe"): GateResult[] {
  const out: GateResult[] = [];
  const sections = (ctx.result.sections as Array<Record<string, unknown>>) ?? [];
  const headings = sections.map((s) => String(s.heading));

  if (kind === "draft") {
    const hasIntro = /introduction/i.test(headings[0] ?? "");
    const hasConcl = /conclusion/i.test(headings[headings.length - 1] ?? "");
    out.push(
      hasIntro && hasConcl
        ? r("draft-structure", "pass", `${sections.length} sections, Intro…Conclusion`)
        : r("draft-structure", "fail", `expected Introduction first & Conclusion last; got [${headings.join(" | ")}]`),
    );
  } else {
    out.push(
      sections.length >= 3
        ? r("rfe-structure", "pass", `${sections.length} sections (opening…closing)`)
        : r("rfe-structure", "fail", `expected opening + issues + closing; got ${sections.length} section(s)`),
    );
  }

  const codes = wrongCodes(ctx.outputText, ctx.classification);
  out.push(
    codes.length === 0
      ? r(`${kind}-classification-consistent`, "pass", `reads as ${ctx.classification}`)
      : r(`${kind}-classification-consistent`, "fail", `mentions other visa code(s): ${codes.join(", ")} (case is ${ctx.classification})`),
  );
  return out;
}

/** Fabrication scan for letter-style outputs (draft/section/rfe): the input is
 *  the criteria evidence + any RFE text. */
function fabricationGate(ctx: GateContext, id: string): GateResult {
  const input = ctx.scenario.input as Record<string, unknown>;
  const crit = (input.criteria as Array<Record<string, unknown>>) ?? [];
  const inputText =
    crit.map((c) => `${c.name} ${c.evidence ?? ""} ${c.rationale ?? ""}`).join(" ") +
    " " +
    String(input.rfeText ?? "") +
    " " +
    String(input.petitioner ?? "");
  const fabricated = fabricatedSpecifics(ctx.outputText, inputText);
  return fabricated.length === 0
    ? r(id, "pass", "no invented numbers/years/money")
    : r(id, "warn", `specifics not in the record (review): ${fabricated.join(", ")}`);
}

function draftGates(ctx: GateContext): GateResult[] {
  return [...letterStructureGates(ctx, "draft"), fabricationGate(ctx, "draft-no-fabrication")];
}

function sectionGates(ctx: GateContext): GateResult[] {
  const out: GateResult[] = [];
  const section = (ctx.result.section as Record<string, unknown>) ?? {};
  const heading = String(section.heading ?? "");
  const focus = ctx.scenario.focus ?? "";
  out.push(
    heading.toLowerCase().includes(focus.toLowerCase()) || focus.toLowerCase().includes(heading.toLowerCase())
      ? r("section-heading-matches-focus", "pass", `“${heading}” ≈ “${focus}”`)
      : r("section-heading-matches-focus", "warn", `heading “${heading}” ≠ focus “${focus}”`),
  );
  out.push(...letterStructureGates(ctx, "draft").filter((g) => g.id.endsWith("classification-consistent")));
  out.push(fabricationGate(ctx, "section-no-fabrication"));
  return out;
}

function rfeGates(ctx: GateContext): GateResult[] {
  const out: GateResult[] = [...letterStructureGates(ctx, "rfe")];

  const kw = ctx.scenario.expect.rfeKeywords ?? [];
  if (kw.length) {
    const hit = kw.filter((k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(ctx.outputText));
    out.push(
      hit.length === kw.length
        ? r("rfe-addresses-issues", "pass", `addressed all: ${kw.join(", ")}`)
        : hit.length === 0
          ? r("rfe-addresses-issues", "fail", `addressed none of the RFE topics: ${kw.join(", ")}`)
          : r("rfe-addresses-issues", "warn", `addressed ${hit.length}/${kw.length}: missing ${kw.filter((k) => !hit.includes(k)).join(", ")}`),
    );
  }

  // If the RFE concerns a criterion with NO evidence on record, the response
  // must not manufacture evidence for it (it may only promise to supplement).
  const none = ctx.scenario.expect.noEvidenceCriterion;
  if (none) {
    out.push(fabricationGate(ctx, "rfe-no-invented-evidence"));
  } else {
    out.push(fabricationGate(ctx, "rfe-no-fabrication"));
  }
  return out;
}

function evidenceGates(ctx: GateContext): GateResult[] {
  const out: GateResult[] = [];
  const bucket = String(ctx.result.criterion ?? "");
  const allowed = new Set([...criteriaNames(ctx.classification), "Unsorted"]);
  out.push(
    allowed.has(bucket)
      ? r("evidence-bucket-valid", "pass", `→ ${bucket}`)
      : r("evidence-bucket-valid", "fail", `bucket "${bucket}" not in the ${ctx.classification} pack`),
  );

  const expected = ctx.scenario.expect.expectedBucket;
  if (expected) {
    out.push(
      bucket === expected
        ? r("evidence-bucket-correct", "pass", `${bucket} as expected`)
        : expected === "Unsorted"
          ? r("evidence-bucket-correct", "warn", `expected Unsorted (ambiguous) but got ${bucket}`)
          : r("evidence-bucket-correct", "fail", `expected ${expected}, got ${bucket}`),
    );
  }

  const facts = (ctx.result.facts as string[]) ?? [];
  out.push(
    facts.length > 0
      ? r("evidence-facts-present", "pass", `${facts.length} fact(s)`)
      : r("evidence-facts-present", "warn", "no facts extracted"),
  );

  const content = String((ctx.scenario.input as Record<string, unknown>).content ?? "");
  const cTok = tokens(content);
  const ungrounded = facts.filter((f) => {
    const ft = [...tokens(f)];
    if (!ft.length) return false;
    return ft.filter((t) => cTok.has(t)).length / ft.length < 0.5;
  });
  out.push(
    ungrounded.length === 0
      ? r("evidence-facts-grounded", "pass")
      : r("evidence-facts-grounded", "warn", `facts weakly grounded in the document: ${ungrounded.join(" | ")}`),
  );
  return out;
}

// — dispatcher ────────────────────────────────────────────────────────────────

export function runGates(ctx: GateContext): GateResult[] {
  const out = universal(ctx);
  switch (ctx.scenario.site) {
    case "guidance":
      return [...out, ...guidanceGates(ctx)];
    case "qualify":
      return [...out, ...qualifyGates(ctx)];
    case "draft":
      return [...out, ...draftGates(ctx)];
    case "draft_section":
      return [...out, ...sectionGates(ctx)];
    case "rfe":
      return [...out, ...rfeGates(ctx)];
    case "evidence":
      return [...out, ...evidenceGates(ctx)];
  }
}
