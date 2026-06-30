import { type BadgeTone } from "@/components/ui";
import { type CaseStatus } from "./types";

// THE single source of truth mapping a petition's lifecycle status to its Badge
// tone — the case-status analogue of criteria.ts's `statusTone` (which tones a
// *criterion* status). CaseList, ReviewPanel, and the dashboard "Your cases"
// list each previously hand-rolled this map and drifted (notably "Filed": gold
// in the case list, green in the review panel, grey in the dashboard). Owning
// the contract here keeps a given status one colour everywhere.
//
// Tones (Badge vocabulary: neutral / accent / success / warning / danger):
//   Intake, Drafting → neutral  (early, in-progress; nothing to flag)
//   Attorney Review  → accent   (actively in review — the notable working stage)
//   Filed            → success  (submitted to USCIS — a positive milestone)
//   Approved         → success  (the won terminal outcome)
//   anything else    → neutral  (never invent a colour for an unknown status)
const TONE_BY_STATUS: Partial<Record<CaseStatus, BadgeTone>> = {
  "Attorney Review": "accent",
  Filed: "success",
  Approved: "success",
};

/**
 * Map a case lifecycle status to its canonical Badge tone. Accepts a plain
 * `string` (not just {@link CaseStatus}) so the persisted-summary call sites —
 * whose `status` is typed `string` — use it without a cast; unknown values fall
 * back to `neutral`.
 */
export function caseStatusTone(status: string): BadgeTone {
  return TONE_BY_STATUS[status as CaseStatus] ?? "neutral";
}
