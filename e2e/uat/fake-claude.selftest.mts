/**
 * Standalone self-test for the fake Claude CLI: builds every operation's REAL
 * prompt with the app's own builders, pipes it through fake-claude.mjs exactly
 * the way the app spawns it, and asserts the operation's STRICT parser accepts
 * the output (strict = the path that keeps the charge; a null would reclaim).
 *
 * Run: npx tsx e2e/uat/fake-claude.selftest.mts
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildQualifyPrompt, parseQualifyResponse } from "../../src/features/qualification/qualification";
import { buildBestPathPrompt, parseBestPathResponse } from "../../src/features/qualification/best-path";
import {
  buildDraftPrompt,
  buildSectionPrompt,
  tryParseDraftResponse,
  tryParseSectionResponse,
  buildCritiquePrompt,
  tryParseCritique,
} from "../../src/features/drafting/drafting";
import { buildRfePrompt, tryParseRfeResponse, buildRfeForecastPrompt, tryParseRfeForecast } from "../../src/features/rfe/rfe";
import { buildCategorizePrompt, tryParseCategorizeResponse } from "../../src/features/evidence/evidence";
import { buildGuidancePrompt, buildGuidanceResponse } from "../../src/features/guidance/guidance";
import { runAdjudication } from "../../src/lib/llm/adjudication-gates";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "fake-claude.mjs");

function run(prompt: string): string {
  const r = spawnSync(process.execPath, [cli], { input: prompt, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`fake-claude exited ${r.status}: ${r.stderr}`);
  return r.stdout;
}

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name} ${detail}`);
  }
}

const CRITERIA = [
  { name: "Awards", status: "Met", evidence: "Best-paper award at a top ML conference", rationale: "Recognized." },
  { name: "Scholarly articles", status: "Strong", evidence: "6 papers, 412 citations", rationale: "Sustained output." },
  { name: "High remuneration", status: "Partial", evidence: "", rationale: "" },
];

// qualify
{
  const req = { name: "Dr. Test", classification: "O-1A", profile: "6 papers, 412 citations, a granted patent." };
  const out = run(buildQualifyPrompt(req as never));
  const parsed = parseQualifyResponse(out, req as never);
  check("qualify: parses", parsed.criteria.length > 0 && parsed.likelihood === 74);
  check("qualify: some Met", parsed.criteria.some((c) => c.status === "Met"));
}

// best-path
{
  const req = { name: "Dr. Test", profile: "Film director with lead creative roles." };
  const out = run(buildBestPathPrompt(req as never));
  const parsed = parseBestPathResponse(out, req as never);
  check("best-path: parses", parsed !== null && !!parsed?.recommendation);
}

// draft (full) + critique + section
{
  const req = { petitioner: "Dr. Test", classification: "O-1A", criteria: CRITERIA };
  const out = run(buildDraftPrompt(req as never));
  const draft = tryParseDraftResponse(out);
  check("draft: strict-parses", draft !== null && (draft?.sections.length ?? 0) >= 3);
  check(
    "draft: Introduction..Conclusion",
    draft?.sections[0]?.heading === "Introduction" && draft?.sections.at(-1)?.heading === "Conclusion",
  );

  const sections = draft!.sections;
  const critOut = run(buildCritiquePrompt(req as never, sections));
  const crit = tryParseCritique(critOut, sections);
  check("critique: strict-parses", crit !== null && (crit?.length ?? 0) === sections.length);

  const secOut = run(buildSectionPrompt(req as never, "Awards", sections));
  const sec = tryParseSectionResponse(secOut);
  check("section: strict-parses", sec !== null && sec?.heading === "Awards");
}

// rfe + forecast
{
  const req = {
    petitioner: "Dr. Test",
    classification: "O-1A",
    rfeText: "The evidence does not establish the judging criterion.",
    criteria: CRITERIA,
  };
  const out = run(buildRfePrompt(req as never));
  const rfe = tryParseRfeResponse(out);
  check("rfe: strict-parses", rfe !== null && (rfe?.sections.length ?? 0) >= 3);

  const fOut = run(buildRfeForecastPrompt(req as never));
  const forecast = tryParseRfeForecast(fOut, req as never);
  check("forecast: strict-parses", forecast !== null && (forecast?.length ?? 0) > 0);
}

// categorize
{
  const req = { name: "ICML 2024 Best Paper certificate", content: "This certifies the Best Paper Award at ICML 2024." };
  const out = run(buildCategorizePrompt(req as never, "O-1A"));
  const parsed = tryParseCategorizeResponse(out, "O-1A");
  check("categorize: strict-parses", parsed !== null && (parsed?.facts.length ?? 0) > 0, JSON.stringify(parsed));
}

// guidance (+ adjudication must NOT block — guidance wires onBlocked, so a
// "blocked" verdict here would mean the UAT journeys silently get mocks)
{
  const req = { formId: "I-129", fieldLabel: "Section O-1", situation: "Researcher with 6 papers." };
  const out = run(buildGuidancePrompt(req)).trim();
  check("guidance: non-empty prose", out.length > 100 && !out.startsWith("{"));
  const adj = runAdjudication({
    operation: "guidance",
    classification: "",
    source: "claude",
    result: buildGuidanceResponse(out, "claude") as unknown as Record<string, unknown>,
    inputText: `${req.fieldLabel} ${req.situation}`,
    outputText: out,
  } as never);
  check(
    "guidance: attorneyReady (would NOT be withheld)",
    adj.attorneyReady === true,
    JSON.stringify(adj.gates.filter((g) => g.verdict !== "pass")),
  );
}

// forced failure
{
  const r = spawnSync(process.execPath, [cli], { input: "anything UAT-FORCE-ENGINE-FAIL anything", encoding: "utf8" });
  check("fail-marker: exits non-zero", r.status === 1);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall fake-claude self-tests passed");
