/**
 * Profession content map for the programmatic-SEO atelier (moonshot #17).
 *
 * The (classification × profession) landing matrix is DATA, not hand-written
 * copy: each profession carries a one-line intro and a profession-tuned example
 * of evidence per criterion NAME. The page reads the classification's pack
 * (packs.ts) and overlays these examples, falling back to the pack's generic
 * copy for any criterion a profession doesn't customize. Pure + dependency-free
 * so the matrix is unit-tested and statically generated.
 */

export interface Profession {
  /** URL slug, e.g. "software-engineer". */
  slug: string;
  /** Plural display label, e.g. "Software Engineers". */
  label: string;
  /** Singular with article, e.g. "a software engineer" — for prose. */
  singular: string;
  /** One-line, profession-tuned intro. */
  intro: string;
  /** Profession-tuned example evidence keyed by criterion name (case packs share
   *  many names; unknown names fall back to the pack's generic evidence copy). */
  examples: Record<string, string>;
}

export const PROFESSIONS: readonly Profession[] = [
  {
    slug: "software-engineer",
    label: "Software Engineers",
    singular: "a software engineer",
    intro:
      "Senior and staff engineers often clear the extraordinary-ability bar on contributions the field already relies on — open-source impact, patents, conference talks, and outsized compensation.",
    examples: {
      Awards: "A best-paper award at a top systems/ML conference, or a major hackathon/industry prize.",
      Membership: "Invited membership in a selective body (e.g. ACM Distinguished, an IEEE society, a standards working group).",
      Press: "Independent coverage of your work in TechCrunch, Wired, or a respected engineering publication.",
      Judging: "Reviewing for a peer-reviewed venue, judging a hackathon, or serving on a conference program committee.",
      "Original contribution": "A granted patent, a widely-adopted open-source project, or an architecture other companies build on.",
      "Scholarly articles": "Peer-reviewed papers, arXiv preprints with citations, or technical talks at recognized conferences.",
      "Critical role": "A founding/lead/principal role at a venture-backed company or a critical role on a flagship product.",
      "High remuneration": "Total compensation (base + equity) in the top percentile for your role and region, with offer letters or surveys.",
    },
  },
  {
    slug: "researcher",
    label: "Researchers & Scientists",
    singular: "a researcher",
    intro:
      "Research scientists are the archetypal extraordinary-ability case: citations, peer review, and original contributions map almost one-to-one onto the criteria.",
    examples: {
      Awards: "A nationally or internationally recognized research award, fellowship, or best-paper honor.",
      Membership: "Membership in an association that requires outstanding achievement (e.g. a learned society or honorary fellowship).",
      Press: "Coverage of your findings in the science press or major media, independent of your own institution.",
      Judging: "Peer-reviewing for journals/conferences, serving on grant panels, or examining doctoral theses.",
      "Original contribution": "A discovery, method, or result of major significance that others build upon.",
      "Scholarly articles": "Authorship of peer-reviewed articles with a strong citation record in reputable venues.",
      "Critical role": "A PI, lab-lead, or critical role at a distinguished research institution.",
      "High remuneration": "Compensation or named-chair funding high relative to peers in your field and country.",
    },
  },
  {
    slug: "founder",
    label: "Startup Founders",
    singular: "a startup founder",
    intro:
      "Founders evidence extraordinary ability through the company they built — funding, press, a critical leadership role, and compensation that reflects the market's judgment.",
    examples: {
      Awards: "A pitch-competition win, an accelerator's top honor, or an industry award for the company or product.",
      Membership: "Membership in a selective founder community or an invitation-only fellowship (e.g. a named founders program).",
      Press: "Independent press about you or the company in Forbes, TechCrunch, Bloomberg, or trade media.",
      Judging: "Judging at an accelerator/demo day, mentoring at a recognized program, or sitting on a startup competition panel.",
      "Original contribution": "A product or business model of significance in the field, or patents underpinning it.",
      "Scholarly articles": "Authored thought-leadership or technical writing in recognized outlets (where applicable).",
      "Critical role": "Founder/CEO/CTO — an indisputably critical role at a distinguished (funded, growing) organization.",
      "High remuneration": "Compensation, equity value, or a funding round that evidences the market's high valuation of your work.",
    },
  },
  {
    slug: "designer",
    label: "Designers",
    singular: "a designer",
    intro:
      "Designers can qualify on awards, press, and a leading role on products or productions with national or international recognition.",
    examples: {
      Awards: "A recognized design award (e.g. an international design prize) for your work.",
      Membership: "Membership in a selective design body or an invited fellowship.",
      Press: "Independent features of your work in design or mainstream press.",
      Judging: "Judging a design competition or reviewing for a recognized design body.",
      "Original contribution": "A design or system of significance widely adopted or imitated in the field.",
      "Scholarly articles": "Published writing, talks, or case studies in recognized design venues.",
      "Critical role": "A lead/principal design role on a flagship product at a distinguished organization.",
      "High remuneration": "Compensation in the top band for senior design talent, with documentation.",
      "Lead role in distinguished productions": "A lead or principal design role on a distinguished, recognized production or product.",
      "National or international recognition": "Awards, press, or honors evidencing recognition beyond your immediate market.",
    },
  },
  {
    slug: "artist",
    label: "Artists & Performers",
    singular: "an artist",
    intro:
      "For artists and performers the O-1B (and EB-1A for the very top of the field) turns on lead roles, critical acclaim, and recognition in distinguished productions.",
    examples: {
      Awards: "A nationally/internationally recognized award or nomination in your art form.",
      Press: "Reviews and features in major or trade press, independent of you.",
      "Original contribution": "A body of work of artistic significance recognized by experts in the field.",
      "Lead role in distinguished productions": "A lead, starring, or principal role in productions with a distinguished reputation.",
      "National or international recognition": "Critical reviews, awards, or honors evidencing acclaim beyond a single market.",
      "Critical role": "A critical or essential role for an organization with a distinguished reputation.",
      "Commercial or critical success": "Box-office, sales, streaming, or critical metrics evidencing major success.",
    },
  },
] as const;

/** The profession for a slug, or undefined. */
export function professionBySlug(slug: string): Profession | undefined {
  return PROFESSIONS.find((p) => p.slug === slug);
}

/** Profession-tuned example evidence for a criterion, or null to fall back to
 *  the pack's generic copy. */
export function exampleFor(profession: Profession, criterionName: string): string | null {
  return profession.examples[criterionName] ?? null;
}
