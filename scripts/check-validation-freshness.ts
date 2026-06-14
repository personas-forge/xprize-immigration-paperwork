/**
 * Validation freshness checker.
 *
 * Prints a Markdown report of which ValidationRecords are stale (overdue for
 * re-verification) or due soon, and exits non-zero when any need attention.
 *
 * Run locally:   npm run validate:freshness
 * In CI:         .github/workflows/validation-freshness.yml runs this weekly and
 *                opens/updates a tracking issue from the report.
 */

import {
  REVALIDATE_AFTER_DAYS,
  REVERIFY_WARN_DAYS,
  allValidations,
  freshnessOf,
  todayIso,
} from "../src/features/qualification/validation";

const today = todayIso();

const rows = allValidations()
  .map((record) => ({ record, freshness: freshnessOf(record, today) }))
  .sort((a, b) => a.freshness.daysLeft - b.freshness.daysLeft);

const stale = rows.filter((r) => r.freshness.level === "stale");
const dueSoon = rows.filter((r) => r.freshness.level === "due-soon");

const lines: string[] = [`# Validation freshness — ${today}`, ""];

if (stale.length === 0 && dueSoon.length === 0) {
  lines.push(
    `✅ All ${rows.length} validation records are fresh (re-verify window: ${REVALIDATE_AFTER_DAYS} days, warn at ${REVERIFY_WARN_DAYS}).`,
  );
} else {
  if (stale.length > 0) {
    lines.push(`## ⛔ Stale — re-verify now (${stale.length})`, "");
    for (const { record, freshness } of stale) {
      lines.push(
        `- **${record.subject}** — last reviewed ${record.lastVerified}, ` +
          `overdue by ${-freshness.daysLeft} day(s) · ${record.legalBasis}`,
      );
    }
    lines.push("");
  }
  if (dueSoon.length > 0) {
    lines.push(`## ⚠️ Due soon (${dueSoon.length})`, "");
    for (const { record, freshness } of dueSoon) {
      lines.push(
        `- **${record.subject}** — due by ${freshness.dueBy} ` +
          `(${freshness.daysLeft} day(s) left) · ${record.legalBasis}`,
      );
    }
    lines.push("");
  }
  lines.push(
    "Re-verify against primary sources (see `docs/validation-framework.md`), bump " +
      "`lastVerified` in `src/features/qualification/validation.ts`, and route to counsel.",
  );
}

const report = lines.join("\n");
process.stdout.write(`${report}\n`);

process.exit(stale.length > 0 || dueSoon.length > 0 ? 1 : 0);
