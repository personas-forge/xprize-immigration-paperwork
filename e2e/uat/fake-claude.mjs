#!/usr/bin/env node
/**
 * Fake Claude CLI for the UAT harness.
 *
 * The UAT server runs with LLM_ENGINE=claude and CLAUDE_CLI_PATH pointing here,
 * so the app exercises its REAL engine path (spawn, stdin prompt, telemetry,
 * charging, guards, adjudication) while the "model" is this deterministic
 * script — the nondeterministic upstream is stubbed at the process boundary
 * (billing-and-uat.md B4), with zero test seams in production code.
 *
 * It detects the operation from prompt markers (each prompt builder has a
 * unique preamble) and answers with JSON the operation's strict parser accepts,
 * echoing GROUNDED data parsed back out of the prompt (criterion names,
 * beneficiary, exhibit numbers) so the adjudication gates pass.
 *
 * Failure injection: a prompt containing UAT-FORCE-ENGINE-FAIL (typed into any
 * free-text field by a journey) makes this exit non-zero — driving the app's
 * charge-reclaim path exactly like a real engine outage (A2.3 failure ≠ charge).
 */

const FAIL_MARKER = "UAT-FORCE-ENGINE-FAIL";

/** Read all of stdin (the prompt). */
async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

/** Lines like `- <name> [<status>]: <evidence> — <rationale>` (criterionLine). */
function parseCriterionLines(block) {
  const out = [];
  for (const line of block.split("\n")) {
    const m = /^- (.+?) \[([^\]]*)\]: (.*)$/.exec(line.trim());
    if (!m) continue;
    const rest = m[3].split(" — ");
    out.push({ name: m[1], status: m[2], evidence: rest[0] ?? "", rationale: rest[1] ?? "" });
  }
  return out;
}

/** The text between two markers, or "" when absent. */
function between(text, open, close) {
  const a = text.indexOf(open);
  const b = text.indexOf(close);
  return a >= 0 && b > a ? text.slice(a + open.length, b) : "";
}

/** The `1. Name` / `2. Name` list immediately following the header line that
 *  matches `headerRe` — scoped so the prompts' numbered STRICT RULES blocks
 *  (also `N.`-prefixed, elsewhere in the prompt) are never mistaken for names. */
function numberedNamesAfter(prompt, headerRe) {
  const lines = prompt.split("\n");
  const start = lines.findIndex((l) => headerRe.test(l));
  if (start < 0) return [];
  const names = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^\d+\. (.+)$/.exec(lines[i]);
    if (!m) break;
    names.push(m[1].trim());
  }
  return names;
}

/** Exhibit ordinals listed under a criterion's bullets inside a block. */
function exhibitNumbersFor(block, criterionName) {
  const lines = block.split("\n");
  const nums = [];
  let inCriterion = false;
  for (const line of lines) {
    if (/^- /.test(line.trim())) {
      inCriterion = line.includes(`- ${criterionName} [`);
      continue;
    }
    if (!inCriterion) continue;
    const m = /\(Exhibit (\d+)\)/.exec(line);
    if (m) nums.push(Number(m[1]));
  }
  return nums;
}

function citationSentence(nums) {
  if (nums.length === 0) return "";
  return ` This is documented by ${nums.map((n) => `(Exhibit ${n})`).join(", ")}.`;
}

function sectionBody(name, c, cite) {
  const evidence =
    c && c.evidence && !c.evidence.startsWith("(no specific evidence")
      ? ` The record establishes the following: ${c.evidence}.`
      : " The record supports this criterion as described by the applicant.";
  return (
    `With respect to the "${name}" criterion, the evidence on file merits careful weight.` +
    evidence +
    ` Framed against the norms of the beneficiary's field, this places the beneficiary among the small percentage at the top of the field.${cite}` +
    " The attorney of record will verify each assertion against the record before filing."
  );
}

function respond(prompt) {
  // 1. Critique / adjudicator redline — grades the sections fenced in the prompt.
  if (prompt.includes("<<<SECTIONS>>>")) {
    const block = between(prompt, "<<<SECTIONS>>>", "<<<END_SECTIONS>>>");
    const headings = [...block.matchAll(/^### Section \d+: (.+)$/gm)].map((m) => m[1].trim());
    return JSON.stringify({
      critiques: headings.map((heading, i) => ({
        heading,
        score: 62 + ((i * 7) % 25),
        weakness:
          "The argument is directionally sound but ties assertions to the record less explicitly than an adjudicator expects.",
        improvedBody:
          `Regarding "${heading}", the evidence already in the record supports this section's argument. ` +
          "Each assertion is grounded in the documents on file, framed against the norms of the field, " +
          "and the attorney of record will verify the final language before filing.",
      })),
    });
  }

  // 2. RFE Risk Radar forecast.
  if (prompt.includes("predict where you would issue a Request for Evidence")) {
    const block = between(prompt, "<<<CRITERIA>>>", "<<<END_CRITERIA>>>");
    const criteria = parseCriterionLines(block).filter((c) =>
      ["Met", "Strong", "Partial"].includes(c.status),
    );
    return JSON.stringify({
      challenges: criteria.map((c, i) => ({
        criterion: c.name,
        likelihood: Math.max(15, 85 - i * 12),
        why: `An officer may find the "${c.name}" showing conclusory without further corroboration.`,
        suggestedEvidence: `Add independent primary-source documentation corroborating the "${c.name}" claim.`,
      })),
    });
  }

  // 3. RFE response brief. (Criteria are fenced as PETITION_CRITERIA here; the
  //    forecast prompt uses plain CRITERIA markers.)
  if (prompt.includes("<<<RFE_NOTICE>>>")) {
    const block = between(prompt, "<<<PETITION_CRITERIA>>>", "<<<END_PETITION_CRITERIA>>>");
    const criteria = parseCriterionLines(block).filter((c) =>
      ["Met", "Strong", "Partial"].includes(c.status),
    );
    const beneficiary = /Beneficiary: (.+)/.exec(prompt)?.[1]?.trim() ?? "the beneficiary";
    const sections = [
      {
        heading: "Response to Request for Evidence",
        body:
          `This brief responds to the Request for Evidence issued in the petition filed on behalf of ${beneficiary}. ` +
          "Each point raised in the notice is addressed below with reference to the evidence already in the record. " +
          "The attorney of record will review and finalize this response before it is submitted to USCIS.",
      },
      ...criteria.map((c) => ({
        heading: `Re: ${c.name}`,
        body: sectionBody(c.name, c, citationSentence(exhibitNumbersFor(block, c.name))),
      })),
      {
        heading: "Conclusion",
        body:
          "For the reasons above, and on the strength of the evidence already in the record, the petition satisfies the standard at issue. " +
          "Counsel will confirm and, where helpful, supplement this evidence prior to submission.",
      },
    ];
    return JSON.stringify({ sections });
  }

  // 4. Single-section regenerate.
  if (prompt.includes("You are revising ONE section")) {
    const focus = /Revise the section for the criterion: "(.+?)"\./.exec(prompt)?.[1] ?? "Section";
    const block = between(prompt, "<<<CASE_DATA>>>", "<<<END_CASE_DATA>>>");
    const c = parseCriterionLines(block).find((x) => x.name.toLowerCase() === focus.toLowerCase());
    return JSON.stringify({
      heading: focus,
      body: sectionBody(focus, c, citationSentence(exhibitNumbersFor(block, focus))),
    });
  }

  // 5. Full petition letter.
  if (prompt.includes("You are drafting a U.S.")) {
    const block = between(prompt, "<<<CASE_DATA>>>", "<<<END_CASE_DATA>>>");
    const beneficiary = /Beneficiary: (.+)/.exec(block)?.[1]?.trim() ?? "the beneficiary";
    const criteria = parseCriterionLines(block);
    const qualifying = criteria.filter((c) => c.status === "Met" || c.status === "Strong");
    const sections = [
      {
        heading: "Introduction",
        body:
          `This letter is submitted in support of the petition filed on behalf of ${beneficiary}. ` +
          "As set out below, the evidence of record satisfies the qualifying criteria, and the totality of the record " +
          "places the beneficiary within the small percentage at the very top of the field. " +
          "This draft is work product for the attorney of record to review, edit, and sign.",
      },
      ...qualifying.map((c) => ({
        heading: c.name,
        body: sectionBody(c.name, c, citationSentence(exhibitNumbersFor(block, c.name))),
      })),
      {
        heading: "Conclusion",
        body:
          "Considered in its totality, the record demonstrates sustained acclaim and recognition consistent with the governing standard. " +
          "The evidence identified above is already on file, and the attorney of record will finalize this letter before filing.",
      },
    ];
    return JSON.stringify({ sections });
  }

  // 6. Best-path recommendation (multi-program comparison).
  if (prompt.includes('"programs"') && prompt.includes("recommend which")) {
    const codes = [...prompt.matchAll(/^• (\S+) — /gm)].map((m) => m[1]);
    const programs = codes.map((classification, i) => ({
      classification,
      qualifying: i === 0 ? 5 : 2,
      read:
        i === 0
          ? "The described record maps cleanly onto this program's criteria."
          : "Some criteria are supported, but the fit is weaker than the primary path.",
    }));
    return JSON.stringify({
      programs,
      recommendation: {
        classification: codes[0] ?? "O-1A",
        rationale:
          "Based only on the described background, this path's criteria are the most directly documented of the options compared. " +
          "The green-card EB-1A route carries a higher final-merits bar, so the strongest near-term fit is this program. " +
          "An attorney of record must review the full record before anything is filed.",
      },
    });
  }

  // 7. Evidence categorization.
  if (prompt.includes("You sort a piece of supporting evidence")) {
    const names = numberedNamesAfter(prompt, / criteria:$/);
    const doc = /Document name: (.+)/.exec(prompt)?.[1]?.trim() ?? "";
    const haystack = prompt.slice(prompt.indexOf("Document name:"));
    const match =
      names.find((n) => haystack.toLowerCase().includes(n.split(" ")[0].toLowerCase())) ??
      names.find((n) => /award|prize/i.test(doc) && /award/i.test(n)) ??
      names[0] ??
      "Unsorted";
    return JSON.stringify({
      criterion: match,
      facts: [
        `Document "${doc}" describes evidence relevant to the ${match} criterion.`,
        "Key names, dates, and figures should be verified against the original record.",
      ],
    });
  }

  // 8. Qualification screening (exact canonical criterion names are numbered).
  if (prompt.includes("(use these exact names)")) {
    const names = numberedNamesAfter(prompt, /\(use these exact names\):$/);
    return JSON.stringify({
      criteria: names.map((name, i) => ({
        name,
        status: i < 4 ? "Met" : "Partial",
        evidence: `The applicant's own description records support relevant to the ${name} criterion.`,
        rationale: "Supported by the described background; an attorney should verify the underlying documents.",
      })),
      likelihood: 74,
      gaps: ["Add independent, primary-source documentation for the criteria that are only partially supported."],
    });
  }

  // 9. Form-field guidance (plain prose, 4 informational sentences, no advice).
  if (prompt.includes("informational assistant for a U.S. immigration paperwork")) {
    const formId = /USCIS form: (.+)/.exec(prompt)?.[1]?.trim() ?? "the form";
    return (
      `On USCIS form ${formId}, this field asks for information that identifies the specific basis of the petition. ` +
      "Provide the details exactly as they appear on the supporting documents, keeping names, dates, and figures consistent across exhibits. " +
      "Information of this kind helps the reviewing officer match the entry to the evidence on file. " +
      "The attorney of record reviews the completed field before anything is filed."
    );
  }

  // Unknown prompt — fail loudly rather than return something a parser might
  // half-accept (a silent wrong-shape answer would masquerade as a model bug).
  process.stderr.write("fake-claude: unrecognized prompt (no operation marker matched)\n");
  process.exit(2);
}

const prompt = await readStdin();
if (prompt.includes(FAIL_MARKER)) {
  process.stderr.write("fake-claude: forced engine failure (UAT-FORCE-ENGINE-FAIL)\n");
  process.exit(1);
}
process.stdout.write(respond(prompt));
