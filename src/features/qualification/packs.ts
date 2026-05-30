/**
 * Visa "criteria packs" — the multi-product core.
 *
 * Each classification (O-1A, O-1B, EB-1A) is defined by its own ordered set of
 * evidentiary criteria and a qualifying threshold. The qualification engine,
 * the evidence vault, and the drafting flow all read the pack for a case's
 * classification, so the same machinery serves every product.
 *
 * Each PackCriterion carries a `match` regex + `evidence`/`gap` copy used ONLY
 * by the deterministic (keyless) fallbacks — the real model is prompted with
 * the criterion names. Pure, dependency-free, unit-testable.
 */

// A visa program code. Programs belong to a jurisdiction — see jurisdictions.ts,
// which is the source of truth for which programs are live vs. planned.
export type Classification = "O-1A" | "O-1B" | "EB-1A" | "UK-Global-Talent";

export interface PackCriterion {
  name: string;
  /** Keyword heuristic for the deterministic fallback. */
  match: RegExp;
  /** Templated "what we found" line for the mock. */
  evidence: string;
  /** Templated gap hint when the criterion is unmet. */
  gap: string;
}

export interface VisaPack {
  classification: Classification;
  /** Human description shown in the product selector. */
  label: string;
  /** Minimum criteria that must qualify. */
  threshold: number;
  criteria: readonly PackCriterion[];
}

// — Shared criterion definitions (reused across packs) ───────────────────────
const AWARDS: PackCriterion = {
  name: "Awards",
  match: /\b(award|prize|medal|won|winner|best paper|honou?r|laureate)\b/i,
  evidence: "Mentions an award, prize, or honor.",
  gap: "Add any nationally/internationally recognized awards or prizes.",
};
const MEMBERSHIP: PackCriterion = {
  name: "Membership",
  match: /\b(member|membership|fellow|fellowship|association|society|admitted|invited)\b/i,
  evidence: "Mentions a selective membership or fellowship.",
  gap: "List selective professional memberships or fellowships.",
};
const PRESS: PackCriterion = {
  name: "Press",
  match: /\b(press|featured|interview|magazine|news|coverage|techcrunch|forbes|wired|bloomberg)\b/i,
  evidence: "Mentions press coverage or media features.",
  gap: "Gather articles or media coverage about your work.",
};
const JUDGING: PackCriterion = {
  name: "Judging",
  match: /\b(judge|judging|reviewer|peer review|referee|jury|panel|evaluat)\b/i,
  evidence: "Mentions judging, peer review, or serving on a panel.",
  gap: "Document any peer review, judging, or panel service.",
};
const ORIGINAL: PackCriterion = {
  name: "Original contribution",
  match: /\b(patent|invention|invented|novel|original|breakthrough|pioneered)\b/i,
  evidence: "Mentions a patent or original/novel contribution.",
  gap: "Describe patents or original contributions and their impact.",
};
const SCHOLARLY: PackCriterion = {
  name: "Scholarly articles",
  match: /\b(paper|publication|published|journal|conference|citation|cited|scholar|arxiv)\b/i,
  evidence: "Mentions publications, papers, or citations.",
  gap: "List publications with venues and citation counts.",
};
const CRITICAL_ROLE: PackCriterion = {
  name: "Critical role",
  match: /\b(founder|founding|co-?founder|lead|leader|director|head of|principal|chief|cto|ceo)\b/i,
  evidence: "Mentions a leading/critical role at an organization.",
  gap: "Describe leading roles at distinguished organizations.",
};
const REMUNERATION: PackCriterion = {
  name: "High remuneration",
  match: /\b(salary|compensation|remuneration|equity|\$\s?\d|six figure|top \d)\b/i,
  evidence: "Mentions salary, equity, or high compensation.",
  gap: "Provide salary/equity evidence vs. peers in your field.",
};

export const VISA_PACKS: Record<Classification, VisaPack> = {
  "O-1A": {
    classification: "O-1A",
    label: "Extraordinary ability — sciences, education, business, athletics",
    threshold: 3,
    criteria: [
      AWARDS, MEMBERSHIP, PRESS, JUDGING, ORIGINAL, SCHOLARLY, CRITICAL_ROLE, REMUNERATION,
    ],
  },
  "O-1B": {
    classification: "O-1B",
    label: "Extraordinary achievement — arts, motion picture & TV",
    threshold: 3,
    criteria: [
      {
        name: "Lead role in distinguished productions",
        match: /\b(lead role|leading role|starring|principal|headlin|featured performer)\b/i,
        evidence: "Mentions a lead or starring role in a distinguished production.",
        gap: "Document lead/starring roles in distinguished productions.",
      },
      {
        name: "National or international recognition",
        match: /\b(national|international|acclaim|renowned|recogni[sz]ed|award|prize)\b/i,
        evidence: "Mentions national or international recognition.",
        gap: "Gather evidence of national or international recognition.",
      },
      {
        name: "Reviews & press",
        match: /\b(review|critic|press|magazine|newspaper|coverage|featured)\b/i,
        evidence: "Mentions reviews or press coverage.",
        gap: "Collect reviews and press about your work.",
      },
      {
        name: "Record of major commercial or critical success",
        match: /\b(box office|chart|sales|streams|commercial success|critical success|ratings|gross)\b/i,
        evidence: "Mentions commercial or critical success.",
        gap: "Provide box-office, sales, or ratings evidence.",
      },
      {
        name: "Recognition from organizations & experts",
        match: /\b(guild|academy|society|expert|endorsement|recommendation|letter from)\b/i,
        evidence: "Mentions recognition from organizations or experts.",
        gap: "Obtain expert letters or recognition from organizations.",
      },
      {
        name: "High salary or remuneration",
        match: /\b(salary|fee|compensation|remuneration|\$\s?\d|per episode|paid)\b/i,
        evidence: "Mentions high salary or fees.",
        gap: "Provide evidence of high salary or fees vs. peers.",
      },
    ],
  },
  "EB-1A": {
    classification: "EB-1A",
    label: "Extraordinary ability — green-card self-petition",
    threshold: 3,
    criteria: [
      AWARDS,
      MEMBERSHIP,
      PRESS,
      JUDGING,
      ORIGINAL,
      SCHOLARLY,
      {
        name: "Artistic exhibitions",
        match: /\b(exhibit|exhibition|showcase|gallery|display|showing)\b/i,
        evidence: "Mentions artistic exhibitions or showcases.",
        gap: "Document artistic exhibitions or showcases of your work.",
      },
      { ...CRITICAL_ROLE, name: "Leading or critical role" },
      REMUNERATION,
      {
        name: "Commercial success in the arts",
        match: /\b(box office|sales|chart|streams|commercial success|gross|royalties)\b/i,
        evidence: "Mentions commercial success in the arts.",
        gap: "Provide commercial-success evidence (sales, box office, royalties).",
      },
    ],
  },
  // UK Global Talent — PROVISIONAL criteria for the planned UK market. The real
  // endorsement criteria depend on the endorsing body and must be confirmed by
  // UK counsel before this program goes live (see jurisdictions.ts, status:planned).
  "UK-Global-Talent": {
    classification: "UK-Global-Talent",
    label: "Global Talent — digital technology, research & arts (provisional)",
    threshold: 2,
    criteria: [
      {
        name: "Innovation track record",
        match: /\b(innovat|novel|invention|patent|breakthrough|pioneer|founded|built)\b/i,
        evidence: "Mentions an innovation, invention, or product built.",
        gap: "Describe innovations you led and their impact.",
      },
      {
        name: "Recognition beyond your field",
        match: /\b(recogni[sz]ed|acclaim|influential|thought leader|keynote|invited speaker|press)\b/i,
        evidence: "Mentions recognition beyond your immediate occupation.",
        gap: "Gather evidence of recognition beyond your day-to-day role.",
      },
      {
        name: "Significant contributions",
        match: /\b(contribut|impact|led|delivered|scaled|grew|launched|open ?source)\b/i,
        evidence: "Mentions significant technical, commercial, or academic contributions.",
        gap: "Document significant contributions and their outcomes.",
      },
      {
        name: "Awards & honours",
        match: /\b(award|prize|honou?r|fellowship|grant)\b/i,
        evidence: "Mentions awards, honours, or competitive grants.",
        gap: "List awards, honours, or competitive grants received.",
      },
      {
        name: "Academic or technical publications",
        match: /\b(paper|publication|published|journal|conference|cited|patent|arxiv)\b/i,
        evidence: "Mentions publications or technical writing.",
        gap: "List publications, talks, or technical writing.",
      },
    ],
  },
};

export const CLASSIFICATIONS: readonly Classification[] = [
  "O-1A",
  "O-1B",
  "EB-1A",
  "UK-Global-Talent",
];

export function isClassification(value: unknown): value is Classification {
  return typeof value === "string" && (CLASSIFICATIONS as readonly string[]).includes(value);
}

/** The pack for a classification; falls back to O-1A for unknown input. */
export function packFor(classification: string): VisaPack {
  return isClassification(classification) ? VISA_PACKS[classification] : VISA_PACKS["O-1A"];
}

/** The ordered criterion names for a classification. */
export function criteriaNames(classification: string): readonly string[] {
  return packFor(classification).criteria.map((c) => c.name);
}
