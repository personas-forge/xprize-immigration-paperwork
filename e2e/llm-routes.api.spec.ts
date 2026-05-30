import { test, expect } from "@playwright/test";
import { AI_TIMEOUT, EXPECTED_SOURCE } from "./engine";

// Direct smoke tests for every AI route. Each fires the active LLM engine and
// asserts the response shape + that `source` equals the active engine — so a
// green `LLM_ENGINE=claude` run proves the Claude function actually executed
// (a CLI failure would fall back to "mock" and fail the assertion).

const CRITERIA = [
  { name: "Awards", status: "Met", evidence: "Best-paper award at a top ML conference", rationale: "Recognized." },
  { name: "Scholarly articles", status: "Strong", evidence: "6 papers, 412 citations", rationale: "Sustained output." },
];

test.describe(`LLM routes — engine: ${EXPECTED_SOURCE}`, () => {
  test("POST /api/guidance → disclaimed informational guidance", async ({ request }) => {
    const res = await request.post("/api/guidance", {
      data: {
        formId: "I-129",
        fieldLabel: "Section O-1 — Extraordinary Ability",
        situation: "Researcher with 6 papers and a granted patent.",
      },
      timeout: AI_TIMEOUT,
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.guidance, "guidance text present").toBeTruthy();
    expect(String(body.disclaimer).toLowerCase()).toContain("not legal advice");
    expect(body.source).toBe(EXPECTED_SOURCE);
  });

  test("POST /api/qualify → scored criteria", async ({ request }) => {
    const res = await request.post("/api/qualify", {
      data: {
        name: "Dr. Test",
        classification: "O-1A",
        profile:
          "Senior research engineer; 6 papers, 412 citations, a granted patent; " +
          "TechCrunch press; $320K salary; founding engineer at a Series B startup.",
      },
      timeout: AI_TIMEOUT,
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.criteria)).toBeTruthy();
    expect(body.criteria.length).toBeGreaterThan(0);
    expect(typeof body.likelihood).toBe("number");
    expect(body.source).toBe(EXPECTED_SOURCE);
  });

  test("POST /api/draft → petition sections", async ({ request }) => {
    const res = await request.post("/api/draft", {
      data: { petitioner: "Dr. Test", classification: "O-1A", criteria: CRITERIA },
      timeout: AI_TIMEOUT,
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.sections)).toBeTruthy();
    expect(body.sections.length).toBeGreaterThan(0);
    expect(body.sections[0]).toHaveProperty("heading");
    expect(body.sections[0]).toHaveProperty("body");
    expect(body.source).toBe(EXPECTED_SOURCE);
  });

  test("POST /api/rfe → RFE response sections", async ({ request }) => {
    const res = await request.post("/api/rfe", {
      data: {
        petitioner: "Dr. Test",
        classification: "O-1A",
        rfeText:
          "The evidence does not establish that the beneficiary satisfies the " +
          "judging criterion. Please submit additional documentation.",
        criteria: CRITERIA,
      },
      timeout: AI_TIMEOUT,
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.sections)).toBeTruthy();
    expect(body.sections.length).toBeGreaterThan(0);
    expect(body.source).toBe(EXPECTED_SOURCE);
  });

  test("POST /api/evidence/categorize → sorted document", async ({ request }) => {
    const res = await request.post("/api/evidence/categorize", {
      data: {
        name: "ICML 2024 Best Paper certificate",
        content: "This certifies the Best Paper Award at ICML 2024 to the recipient. Signed by the chairs.",
      },
      timeout: AI_TIMEOUT,
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.criterion, "a criterion bucket was chosen").toBeTruthy();
    expect(Array.isArray(body.facts)).toBeTruthy();
    expect(body.source).toBe(EXPECTED_SOURCE);
  });
});
