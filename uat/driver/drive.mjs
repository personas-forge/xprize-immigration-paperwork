// Portable L2 driver — navigate → screenshot + ARIA snapshot + visible text (+ optional one click).
// Stack-agnostic; per-app values come from env (see uat/env.md). Used by the UAT L2 phase.
//
//   MSYS_NO_PATHCONV=1 BASE_URL=http://localhost:3000 SHOT_DIR=uat/runs/<id>/shots \
//     node uat/driver/drive.mjs /route shotName ["Accessible Role Name to click"]
//
// Prints the ARIA snapshot + a text excerpt to stdout (the UAT agent reads these as "perception")
// and writes <SHOT_DIR>/<shotName>.png. Uses Playwright (a devDependency).
//
// Gotchas baked in: MSYS_NO_PATHCONV so a leading-slash route isn't mangled; locator.ariaSnapshot()
// (page.accessibility.snapshot() was removed in Playwright >= 1.50); domcontentloaded + a short
// settle, never networkidle (the HMR socket never idles in dev).

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "uat/runs/_adhoc/shots";
const route = process.argv[2] || "/";
const shotName = process.argv[3] || "shot";
const clickName = process.argv[4]; // optional accessible name to click once

const SETTLE_MS = Number(process.env.SETTLE_MS || 1500);

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const url = new URL(route, BASE_URL).toString();

  console.log(`# GET ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(SETTLE_MS);

  if (clickName) {
    const target = page.getByRole("button", { name: clickName }).or(
      page.getByRole("link", { name: clickName }),
    );
    console.log(`# click "${clickName}"`);
    await target.first().click({ timeout: 15_000 }).catch((e) =>
      console.log(`# click failed: ${e.message}`),
    );
    await page.waitForTimeout(SETTLE_MS);
  }

  const shotPath = path.join(SHOT_DIR, `${shotName}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`# shot ${shotPath}`);

  console.log("\n## ARIA snapshot");
  console.log(await page.locator("body").ariaSnapshot());

  console.log("\n## Visible text (excerpt)");
  const text = (await page.locator("body").innerText()).replace(/\n{3,}/g, "\n\n");
  console.log(text.slice(0, 4000));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
