import { test } from "node:test";
import assert from "node:assert/strict";

import {
  scoreProgram,
  scoreAllPrograms,
  rankPrograms,
  rationaleFor,
  recommendBestPath,
  buildBestPathPrompt,
  parseBestPathResponse,
  type BestPathRequest,
  type ProgramScore,
} from "./best-path";
import { livePrograms } from "./jurisdictions";

// A strong profile that should clear at least one program.
const STRONG: BestPathRequest = {
  name: "Dr. Anya Krishnan",
  profile:
    "Senior research engineer. 6 peer-reviewed papers (412 citations), best-paper " +
    "award at a top ML conference, one granted US patent. Featured in TechCrunch. " +
    "Founding engineer at a Series B startup; $320K salary plus equity.",
};

// A thin profile that clears nothing.
const THIN: BestPathRequest = {
  name: "Sam",
  profile: "I am a junior developer who just graduated and is looking for a job somewhere.",
};

test("scoreProgram: returns threshold math consistent with the summary", () => {
  const s = scoreProgram(STRONG, "O-1A");
  assert.equal(s.classification, "O-1A");
  assert.equal(s.criteriaCount, s.assessment.criteria.length);
  assert.equal(s.margin, s.summary.qualifying - s.threshold);
  assert.equal(s.gapsToThreshold, Math.max(0, s.threshold - s.summary.qualifying));
  assert.equal(s.summary.meetsThreshold, s.summary.qualifying >= s.threshold);
});

test("scoreAllPrograms: scores exactly the live programs", () => {
  const scores = scoreAllPrograms(STRONG);
  assert.deepEqual(
    scores.map((s) => s.classification).sort(),
    [...livePrograms()].sort(),
  );
});

test("rankPrograms: clears-threshold sorts ahead of below-threshold", () => {
  const scores = scoreAllPrograms(STRONG);
  const ranked = rankPrograms(scores);
  // Once we hit a below-threshold program, no later program may meet it.
  let seenBelow = false;
  for (const p of ranked) {
    if (!p.summary.meetsThreshold) seenBelow = true;
    else assert.ok(!seenBelow, "a clearing program ranked after a non-clearing one");
  }
});

test("rankPrograms: is a deterministic total order (stable across runs)", () => {
  const a = rankPrograms(scoreAllPrograms(STRONG)).map((p) => p.classification);
  const b = rankPrograms(scoreAllPrograms(STRONG)).map((p) => p.classification);
  assert.deepEqual(a, b);
});

test("rationaleFor: distinguishes clears vs short, flags the green card", () => {
  const clears: ProgramScore = {
    classification: "EB-1A",
    label: "x",
    criteriaCount: 10,
    threshold: 3,
    assessment: { classification: "EB-1A", criteria: [], likelihood: 70, gaps: [] },
    summary: { total: 10, qualifying: 5, partial: 0, meetsThreshold: true },
    margin: 2,
    gapsToThreshold: 0,
    greenCard: true,
  };
  const r = rationaleFor(clears);
  assert.ok(r.includes("clear EB-1A"));
  assert.ok(r.includes("green card"), "EB-1A flags permanent residence");

  const short = { ...clears, summary: { ...clears.summary, qualifying: 2, meetsThreshold: false }, gapsToThreshold: 1 };
  const rs = rationaleFor(short);
  assert.ok(rs.includes("closest path"));
  assert.ok(rs.includes("1 more criterion"));
});

test("recommendBestPath: tags the top-ranked program with a rationale + disclaimer", () => {
  const result = recommendBestPath(STRONG);
  assert.equal(result.source, "mock");
  assert.ok(result.disclaimer.length > 0);
  assert.equal(result.recommendation.classification, result.programs[0].classification);
  assert.ok(result.recommendation.rationale.length > 0);
});

test("recommendBestPath: a thin profile still returns a ranked closest path", () => {
  const result = recommendBestPath(THIN);
  assert.equal(result.programs.length, livePrograms().length);
  // Nothing clears, so the recommendation is a "closest path".
  assert.ok(result.recommendation.rationale.includes("closest path"));
});

// ── Model-backed best-path (LLM-1) ───────────────────────────────────────────

test("buildBestPathPrompt: lists every live program + its criteria and asks for JSON", () => {
  const p = buildBestPathPrompt(STRONG);
  for (const c of livePrograms()) assert.ok(p.includes(c), `prompt names ${c}`);
  assert.ok(/EB-1A is a GREEN CARD/i.test(p), "flags the EB-1A higher-bar trade-off");
  assert.ok(p.includes("STRICT JSON"), "asks for strict JSON");
  assert.ok(p.includes(STRONG.profile), "includes the applicant's record");
});

test("parseBestPathResponse: maps model JSON to a ranked BestPathResult (source claude)", () => {
  const raw = JSON.stringify({
    programs: livePrograms().map((c) => ({
      classification: c,
      qualifying: c === "O-1B" ? 5 : 1,
      read: "x",
    })),
    recommendation: {
      classification: "O-1B",
      rationale: "Arts is the strongest fit; O-1A under-reads a director.",
    },
  });
  const result = parseBestPathResponse(raw, STRONG);
  assert.ok(result);
  assert.equal(result!.source, "claude");
  assert.equal(result!.programs.length, livePrograms().length);
  assert.equal(result!.recommendation.classification, "O-1B"); // most qualifying → ranked first
  assert.ok(result!.recommendation.rationale.includes("director"));
  const ob = result!.programs.find((p) => p.classification === "O-1B")!;
  assert.equal(ob.summary.qualifying, 5);
  assert.equal(ob.summary.meetsThreshold, true);
});

test("parseBestPathResponse: clamps an over-count + keeps omitted programs at zero", () => {
  const raw = JSON.stringify({
    programs: [{ classification: "O-1A", qualifying: 999, read: "x" }],
    recommendation: { classification: "O-1A", rationale: "" },
  });
  const result = parseBestPathResponse(raw, STRONG);
  assert.ok(result);
  const oa = result!.programs.find((p) => p.classification === "O-1A")!;
  assert.equal(oa.summary.qualifying, oa.criteriaCount); // clamped to the pack size
  assert.equal(result!.programs.length, livePrograms().length); // omitted still present
  assert.ok(result!.recommendation.rationale.length > 0); // empty model rationale → fallback
});

test("parseBestPathResponse: returns null on unusable output (→ mock fallback)", () => {
  assert.equal(parseBestPathResponse("not json at all", STRONG), null);
  assert.equal(parseBestPathResponse(JSON.stringify({ nope: 1 }), STRONG), null);
});
