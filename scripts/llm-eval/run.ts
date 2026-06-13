/**
 * LLM-eval harness — runs each scenario, one by one, through the REAL product
 * code path for its site (validate → build prompt → getLlm().generate → parse →
 * disclaimer-wrap), then applies the quality gates. Prints progress live and
 * writes scripts/llm-eval/out/{report.md,results.json}.
 *
 * Engine: whatever resolveEngine() picks. With no GEMINI_API_KEY, run with
 *   LLM_ENGINE=claude  npx tsx scripts/llm-eval/run.ts
 *
 * Filters (optional):
 *   --ids Q01,D02       only these scenario ids
 *   --site qualify      only this site
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildGuidancePrompt,
  buildGuidanceResponse,
  parseGuidanceRequest,
} from "@/features/guidance/guidance";
import {
  buildQualifyPrompt,
  buildQualifyResult,
  parseQualifyRequest,
  parseQualifyResponse,
} from "@/features/qualification/qualification";
import {
  buildDraftPrompt,
  buildDraftResult,
  buildSectionPrompt,
  buildSectionResult,
  parseDraftRequest,
  parseFocus,
  parseDraftResponse,
  parseSectionResponse,
} from "@/features/drafting/drafting";
import {
  buildRfePrompt,
  buildRfeResult,
  parseRfeRequest,
  parseRfeResponse,
} from "@/features/rfe/rfe";
import {
  buildCategorizePrompt,
  buildCategorizeResult,
  parseCategorizeRequest,
  parseCategorizeResponse,
} from "@/features/evidence/evidence";

import { getLlm } from "./engine";
import { runGates } from "./gates";
import { SCENARIOS } from "./scenarios";
import type { GateContext, GateResult, Scenario } from "./types";

interface RunRecord {
  scenario: Scenario;
  classification: string;
  prompt: string;
  raw: string;
  result: Record<string, unknown>;
  outputText: string;
  source: string;
  durationMs: number;
  gates: GateResult[];
  error?: string;
}

const SYM: Record<string, string> = { pass: "✓", fail: "✗", warn: "⚠", na: "·" };

function classificationOf(s: Scenario): string {
  return String((s.input as Record<string, unknown>).classification ?? "O-1A");
}

/** Run one scenario through its real site pipeline. Returns prompt/raw/result. */
async function execute(
  s: Scenario,
): Promise<{ prompt: string; raw: string; result: Record<string, unknown>; outputText: string; source: string; error?: string }> {
  const llm = getLlm();
  const opts = { json: true, tier: "fast" as const };

  // Build the prompt and a generate() call per site, mirroring the API routes.
  switch (s.site) {
    case "guidance": {
      const p = parseGuidanceRequest(s.input);
      if (!p.ok) throw new Error(`invalid input: ${p.error}`);
      const prompt = buildGuidancePrompt(p.value);
      if (!llm) {
        const result = buildGuidanceResponse("(no engine)", "mock");
        return { prompt, raw: "", result: result as never, outputText: "", source: "mock" };
      }
      const raw = await llm.generate(prompt, { tier: "fast" });
      const result = buildGuidanceResponse(raw, llm.name);
      return { prompt, raw, result: result as never, outputText: result.guidance, source: llm.name };
    }
    case "qualify": {
      const p = parseQualifyRequest(s.input);
      if (!p.ok) throw new Error(`invalid input: ${p.error}`);
      const prompt = buildQualifyPrompt(p.value);
      if (!llm) return { prompt, raw: "", result: {}, outputText: "", source: "mock" };
      const raw = await llm.generate(prompt, opts);
      const assessment = parseQualifyResponse(raw, p.value);
      const result = buildQualifyResult(assessment, llm.name);
      const outputText =
        assessment.criteria.map((c) => `${c.evidence} ${c.rationale}`).join(" ") + " " + assessment.gaps.join(" ");
      return { prompt, raw, result: result as never, outputText, source: llm.name };
    }
    case "draft": {
      const p = parseDraftRequest(s.input);
      if (!p.ok) throw new Error(`invalid input: ${p.error}`);
      const prompt = buildDraftPrompt(p.value);
      if (!llm) return { prompt, raw: "", result: {}, outputText: "", source: "mock" };
      const raw = await llm.generate(prompt, { json: true, tier: "long" });
      const draft = parseDraftResponse(raw, p.value);
      const result = buildDraftResult(draft, llm.name);
      const outputText = draft.sections.map((x) => `${x.heading}\n${x.body}`).join("\n\n");
      return { prompt, raw, result: result as never, outputText, source: llm.name };
    }
    case "draft_section": {
      const p = parseDraftRequest(s.input);
      if (!p.ok) throw new Error(`invalid input: ${p.error}`);
      const focus = parseFocus(s.focus);
      if (!focus) throw new Error("scenario missing focus");
      const prompt = buildSectionPrompt(p.value, focus);
      if (!llm) return { prompt, raw: "", result: {}, outputText: "", source: "mock" };
      const raw = await llm.generate(prompt, { json: true, tier: "long" });
      const section = parseSectionResponse(raw, p.value, focus);
      const result = buildSectionResult(section, llm.name);
      return { prompt, raw, result: result as never, outputText: `${section.heading}\n${section.body}`, source: llm.name };
    }
    case "rfe": {
      const p = parseRfeRequest(s.input);
      if (!p.ok) throw new Error(`invalid input: ${p.error}`);
      const prompt = buildRfePrompt(p.value);
      if (!llm) return { prompt, raw: "", result: {}, outputText: "", source: "mock" };
      const raw = await llm.generate(prompt, { json: true, tier: "long" });
      const resp = parseRfeResponse(raw, p.value);
      const result = buildRfeResult(resp, llm.name);
      const outputText = resp.sections.map((x) => `${x.heading}\n${x.body}`).join("\n\n");
      return { prompt, raw, result: result as never, outputText, source: llm.name };
    }
    case "evidence": {
      const p = parseCategorizeRequest(s.input);
      if (!p.ok) throw new Error(`invalid input: ${p.error}`);
      const classification = classificationOf(s);
      const prompt = buildCategorizePrompt(p.value, classification);
      if (!llm) return { prompt, raw: "", result: {}, outputText: "", source: "mock" };
      const raw = await llm.generate(prompt, opts);
      const assessment = parseCategorizeResponse(raw, p.value, classification);
      const result = buildCategorizeResult(assessment, llm.name);
      return {
        prompt,
        raw,
        result: result as never,
        outputText: `${assessment.criterion} ${assessment.facts.join(" ")}`,
        source: llm.name,
      };
    }
  }
}

async function runOne(s: Scenario): Promise<RunRecord> {
  const classification = classificationOf(s);
  const t0 = Date.now();
  try {
    const { prompt, raw, result, outputText, source } = await execute(s);
    const durationMs = Date.now() - t0;
    const ctx: GateContext = { scenario: s, classification, prompt, raw, result, outputText, source, durationMs };
    const gates = runGates(ctx);
    return { scenario: s, classification, prompt, raw, result, outputText, source, durationMs, gates };
  } catch (e) {
    const durationMs = Date.now() - t0;
    const err = e instanceof Error ? e.message : String(e);
    // Model/transport failure: record it; gates run against an empty result so
    // the "real-engine" gate flags the fallback (mirrors the route's behavior).
    const ctx: GateContext = {
      scenario: s, classification, prompt: "", raw: "", result: {}, outputText: "", source: "mock", durationMs,
    };
    return { scenario: s, classification, prompt: "", raw: "", result: {}, outputText: "", source: "mock", durationMs, gates: runGates(ctx), error: err };
  }
}

function printGates(rec: RunRecord): void {
  const fails = rec.gates.filter((g) => g.verdict === "fail").length;
  const warns = rec.gates.filter((g) => g.verdict === "warn").length;
  const head = `[${rec.scenario.id}] ${rec.scenario.site} — ${rec.scenario.title}  (${rec.source}, ${(rec.durationMs / 1000).toFixed(1)}s)  ${fails ? `${fails}✗ ` : ""}${warns ? `${warns}⚠` : fails ? "" : "all clear"}`;
  console.log(head);
  if (rec.error) console.log(`   ! error: ${rec.error}`);
  for (const g of rec.gates) {
    if (g.verdict === "pass") continue; // keep the live log focused on signal
    console.log(`   ${SYM[g.verdict]} ${g.id}${g.detail ? ` — ${g.detail}` : ""}`);
  }
}

function applyFilters(list: Scenario[]): Scenario[] {
  const argv = process.argv.slice(2);
  const idsArg = argv[argv.indexOf("--ids") + 1];
  const siteArg = argv[argv.indexOf("--site") + 1];
  let out = list;
  if (argv.includes("--ids") && idsArg) {
    const ids = new Set(idsArg.split(",").map((x) => x.trim()));
    out = out.filter((s) => ids.has(s.id));
  }
  if (argv.includes("--site") && siteArg) out = out.filter((s) => s.site === siteArg);
  return out;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + " …[truncated]" : s;
}

function writeReports(records: RunRecord[]): void {
  const outDir = join(process.cwd(), "scripts", "llm-eval", "out");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "results.json"), JSON.stringify(records, null, 2));

  const allGates = records.flatMap((r) => r.gates);
  const total = allGates.length;
  const fail = allGates.filter((g) => g.verdict === "fail").length;
  const warn = allGates.filter((g) => g.verdict === "warn").length;
  const pass = allGates.filter((g) => g.verdict === "pass").length;
  const engine = records.find((r) => r.source !== "mock")?.source ?? "mock";

  const lines: string[] = [];
  lines.push(`# LLM-eval report`);
  lines.push("");
  lines.push(`Engine: **${engine}** · Scenarios: **${records.length}** · Gates: ${total} ( ${pass} ✓ / ${fail} ✗ / ${warn} ⚠ )`);
  lines.push("");

  const withFails = records.filter((r) => r.gates.some((g) => g.verdict === "fail"));
  lines.push(`## Hard failures (${withFails.length} scenario(s))`);
  if (withFails.length === 0) lines.push("\n_None — all deterministic invariants held._");
  for (const r of withFails) {
    lines.push("");
    lines.push(`### ${r.scenario.id} — ${r.scenario.title}`);
    for (const g of r.gates.filter((x) => x.verdict === "fail")) lines.push(`- ✗ \`${g.id}\` — ${g.detail}`);
  }
  lines.push("");

  lines.push(`## Warnings (review)`);
  const withWarns = records.filter((r) => r.gates.some((g) => g.verdict === "warn"));
  if (withWarns.length === 0) lines.push("\n_None._");
  for (const r of withWarns) {
    lines.push("");
    lines.push(`### ${r.scenario.id} — ${r.scenario.title}`);
    for (const g of r.gates.filter((x) => x.verdict === "warn")) lines.push(`- ⚠ \`${g.id}\` — ${g.detail}`);
  }
  lines.push("");

  lines.push(`## Per-scenario detail`);
  for (const r of records) {
    const f = r.gates.filter((g) => g.verdict === "fail").length;
    const w = r.gates.filter((g) => g.verdict === "warn").length;
    lines.push("");
    lines.push(`### ${r.scenario.id} — ${r.scenario.title}  (${r.source}, ${(r.durationMs / 1000).toFixed(1)}s) — ${f}✗ ${w}⚠`);
    lines.push(`*Intent:* ${r.scenario.intent}`);
    if (r.error) lines.push(`*Error:* ${r.error}`);
    lines.push("");
    lines.push("```");
    lines.push(truncate(r.outputText || r.raw, 1400));
    lines.push("```");
    lines.push("");
    lines.push("| gate | verdict | detail |");
    lines.push("| --- | --- | --- |");
    for (const g of r.gates) lines.push(`| ${g.id} | ${SYM[g.verdict]} ${g.verdict} | ${g.detail.replace(/\|/g, "\\|")} |`);
  }

  writeFileSync(join(outDir, "report.md"), lines.join("\n"));
  console.log(`\nWrote ${join("scripts", "llm-eval", "out", "report.md")} and results.json`);
}

async function main(): Promise<void> {
  const scenarios = applyFilters(SCENARIOS);
  const argv = process.argv.slice(2);
  const ri = argv.indexOf("--repeat");
  const repeat = ri >= 0 ? Math.max(1, Number(argv[ri + 1]) || 1) : 1;
  console.log(
    `Running ${scenarios.length} scenario(s)${repeat > 1 ? ` ×${repeat} (stability)` : ""} sequentially…\n`,
  );
  const records: RunRecord[] = [];
  for (let pass = 1; pass <= repeat; pass++) {
    for (const s of scenarios) {
      // Tag the displayed id per pass so a stability run shows Q10#1, Q10#2, …
      const rec = await runOne(repeat > 1 ? { ...s, id: `${s.id}#${pass}` } : s);
      printGates(rec);
      records.push(rec);
    }
  }

  const fail = records.flatMap((r) => r.gates).filter((g) => g.verdict === "fail").length;
  const warn = records.flatMap((r) => r.gates).filter((g) => g.verdict === "warn").length;
  const errored = records.filter((r) => r.error).length;
  console.log(
    `\n── done: ${records.length} scenarios, ${fail} hard failures, ${warn} warnings, ${errored} errored ──`,
  );
  writeReports(records);
  // A scenario whose pipeline threw (LLM timeout / parse failure) ran its gates
  // against an EMPTY context, so they can't reliably hard-fail it. Surface those
  // runs with a non-zero exit so the quality gate doesn't silently pass a run
  // where the model was never really exercised.
  if (errored > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("HARNESS FAILED:", e);
  process.exit(1);
});
