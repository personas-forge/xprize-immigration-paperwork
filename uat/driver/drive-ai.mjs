// Portable L2 AI-surface driver — fill the textarea(s) → click a generate control → POLL until the
// model result settles (real Claude via the CLI engine is slow: 15–130 s) → optionally assert the
// output echoes a supplied real entity (the grounding check that L2 exists to perform).
//
//   MSYS_NO_PATHCONV=1 BASE_URL=http://localhost:3000 SHOT_DIR=uat/runs/<id>/shots \
//     node uat/driver/drive-ai.mjs /qualify qualify-run \
//       --input "@uat/fixtures/priya-cv.txt or inline text" \
//       --click "Run the screening" \
//       --expect "Krishnan"            # a real term you fed in — proves the output is grounded
//
// Prints the settled result text + whether --expect appeared, and writes a screenshot. The poll
// watches for the visible text to stop growing (settle) rather than a fixed sleep, with a hard cap.

import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "uat/runs/_adhoc/shots";
const route = process.argv[2] || "/qualify";
const shotName = process.argv[3] || "ai-run";

const args = process.argv.slice(4);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const inputArg = flag("--input");
const clickName = flag("--click");
const expect = flag("--expect");

const MAX_WAIT_MS = Number(process.env.MAX_WAIT_MS || 150_000); // budget for real-model latency
const POLL_MS = Number(process.env.POLL_MS || 2500);
const SETTLE_STABLE = Number(process.env.SETTLE_STABLE || 3); // N stable polls = settled

async function resolveInput(v) {
  if (!v) return undefined;
  if (v.startsWith("@")) return readFile(v.slice(1), "utf8");
  return v;
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  const inputText = await resolveInput(inputArg);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const url = new URL(route, BASE_URL).toString();

  console.log(`# GET ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1200);

  if (inputText) {
    const box = page.getByRole("textbox").first();
    await box.fill(inputText, { timeout: 15_000 });
    console.log(`# filled textbox (${inputText.length} chars)`);
  }

  if (clickName) {
    const btn = page.getByRole("button", { name: clickName });
    await btn.first().click({ timeout: 15_000 });
    console.log(`# clicked "${clickName}" — polling for the model result…`);
  }

  // Poll until the visible text stops growing (settled) or we hit the cap.
  const started = Date.now();
  let last = "";
  let stable = 0;
  while (Date.now() - started < MAX_WAIT_MS) {
    await page.waitForTimeout(POLL_MS);
    const now = await page.locator("body").innerText();
    if (now.length === last.length) {
      if (++stable >= SETTLE_STABLE) break;
    } else {
      stable = 0;
      last = now;
    }
  }
  const waited = Math.round((Date.now() - started) / 1000);
  console.log(`# settled after ~${waited}s`);

  const shotPath = path.join(SHOT_DIR, `${shotName}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`# shot ${shotPath}`);

  const text = await page.locator("body").innerText();
  if (expect) {
    const ok = text.toLowerCase().includes(expect.toLowerCase());
    console.log(`# GROUNDING CHECK — output ${ok ? "CONTAINS" : "MISSING"} "${expect}"`);
  }
  console.log("\n## Result text (excerpt)");
  console.log(text.slice(0, 6000));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
