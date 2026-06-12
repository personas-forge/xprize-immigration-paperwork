/**
 * Plain-English primers for each O-1A criterion — shown to first-time users
 * via the `?` button in CriteriaTable. Keyed by the criterion name as it
 * appears in data.ts so the lookup is O(1) and stays in sync without a join.
 */
export interface CriterionPrimer {
  /** One-sentence plain-English definition of what USCIS is looking for. */
  definition: string;
  /** A concrete example of supporting evidence for this criterion. */
  example: string;
}

export const CRITERIA_PRIMERS: Readonly<Record<string, CriterionPrimer>> = {
  Awards: {
    definition:
      "You have received a nationally or internationally recognized prize or award that demonstrates excellence in your field.",
    example:
      "A best-paper award from a major international conference, or a national science or engineering prize.",
  },
  Membership: {
    definition:
      "You belong to associations that require outstanding achievement as a condition of membership, as judged by recognized experts.",
    example:
      "Invitation-only professional societies such as the National Academy of Engineering, or elected fellowship in a major scholarly body.",
  },
  Press: {
    definition:
      "Published articles in professional publications, major trade media, or major newspapers have featured you and your work — not just mentioned your employer.",
    example:
      "A profile in TechCrunch, a Bloomberg feature, or a write-up in a peer-reviewed journal's news section that focuses on your contributions.",
  },
  Judging: {
    definition:
      "You have served as a judge evaluating the work of other professionals in your field or an allied discipline.",
    example:
      "Peer-reviewer credits on conference papers, a hackathon judging panel seat, or membership on a grant-review committee.",
  },
  "Original contribution": {
    definition:
      "You have made original scientific, scholarly, artistic, or business-related contributions of major significance that others in the field recognise and build upon.",
    example:
      "A widely-cited patent, a published algorithm adopted by multiple companies, or an open-source library with significant industry adoption.",
  },
  "Scholarly articles": {
    definition:
      "You have authored scholarly articles published in professional journals, major conferences, or other recognised media in your field.",
    example:
      "Peer-reviewed papers in top-tier venues (e.g., NeurIPS, Nature, PLDI) with citation counts that reflect impact.",
  },
  "Critical role": {
    definition:
      "You have performed a critical or essential role — not merely a supporting one — for distinguished organisations or establishments.",
    example:
      "Founding engineer, lead scientist, or VP-level role at a well-known startup or research institution, documented by an employer letter.",
  },
  "High remuneration": {
    definition:
      "You command a high salary or other remuneration for services relative to others working in the same field.",
    example:
      "Compensation in the top 10 % for comparable roles, substantiated by pay stubs, an offer letter, or a compensation benchmarking report.",
  },
};
