import { type CaseFact, type CaseTask, type Criterion } from "./types";

export const caseFacts: CaseFact[] = [
  { label: "Status", value: "Drafting petition" },
  { label: "Attorney", value: "J. Park, Esq." },
  { label: "Target file", value: "Jun 12, 2026" },
];

export const criteria: Criterion[] = [
  { id: "c1", name: "Awards", status: "Met", evidence: "TC39 Working Group member, ICML 2024 Best Paper", exhibit: "Ex. 1" },
  { id: "c2", name: "Membership", status: "Met", evidence: "ACM SIGPLAN, Y Combinator W22", exhibit: "Ex. 2" },
  { id: "c3", name: "Press", status: "Met", evidence: "TechCrunch, The Information, Bloomberg (3 articles)", exhibit: "Ex. 3" },
  { id: "c4", name: "Judging", status: "Partial", evidence: "Need 1 more peer review or hackathon judging", exhibit: "Ex. 4" },
  { id: "c5", name: "Original contribution", status: "Met", evidence: "Patent #US11,432,118 cited 41×", exhibit: "Ex. 5" },
  { id: "c6", name: "Scholarly articles", status: "Strong", evidence: "6 papers · 412 citations", exhibit: "Ex. 6" },
  { id: "c7", name: "Critical role", status: "Met", evidence: "Founding eng at Acme (Series B)", exhibit: "Ex. 7" },
  { id: "c8", name: "High remuneration", status: "Met", evidence: "$340K base + equity, top 5% in role", exhibit: "Ex. 8" },
];

export const outstandingTasks: CaseTask[] = [
  { id: "t1", label: "Upload 5th recommendation letter", owner: "Anya" },
  { id: "t2", label: "Confirm passport scan (legible)", owner: "Anya" },
  { id: "t3", label: "Attorney review of §III.B draft", owner: "J. Park" },
  { id: "t4", label: "Schedule sign-off call", owner: "Concierge" },
];

export const petitionExcerpt =
  "Dr. Krishnan has demonstrated sustained national and international acclaim. Her foundational work on type-aware language model agents — published at ICML 2024 and cited by researchers at Google DeepMind, Anthropic, and DeepSeek — established a new technique now in use at several Series B+ companies in the United States.";
