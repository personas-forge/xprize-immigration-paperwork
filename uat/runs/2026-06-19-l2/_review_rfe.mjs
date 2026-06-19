// L2 live drive — Package C (sign & file two-step ceremony) + Package D (RFE
// adjudication badge). Walks the case lifecycle: Drafting → submit → Attorney
// Review → [click Sign&file → confirm panel WITHOUT filing] → confirm → Filed →
// RFE response → assert the Compliance-check (AdjudicationBadge) renders.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const CASE = process.env.CASE_ID;
const SHOT = "uat/runs/2026-06-19-l2/shots";
const url = `${BASE}/dashboard/cases/${CASE}`;
const log = [];
const say = (m) => { log.push(m); console.log(m); };

await mkdir(SHOT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1700 } });
const body = () => page.locator("body").innerText();
const fresh = async () => { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForTimeout(1500); };

await fresh();

// 1. Submit for attorney review (if still in Drafting)
const submit = page.getByRole("button", { name: /Submit for attorney review/i });
if (await submit.count()) { say("→ Submitting for attorney review…"); await submit.first().click(); await page.waitForTimeout(2500); }
await fresh();
say("Status after submit contains 'Attorney Review': " + /Attorney Review/i.test(await body()));

// 2. PACKAGE C — Sign & file is a two-step, not a bare submit
const sign = page.getByRole("button", { name: "Sign & file with USCIS" });
say("Sign&file button present: " + ((await sign.count()) > 0));
await page.screenshot({ path: `${SHOT}/c-1-before-sign.png`, fullPage: true });
await sign.first().click();
await page.waitForTimeout(900);
const confirmHeading = await page.getByText(/Confirm — attorney of record/i).count();
const effectStmt = await page.getByText(/You are about to/i).count();
const confirmBtn = page.getByRole("button", { name: /Confirm — sign & file/i });
const stillReviewAfterClick = /Attorney Review/i.test(await body());
const C_PASS = confirmHeading > 0 && effectStmt > 0 && (await confirmBtn.count()) > 0 && stillReviewAfterClick;
say("PACKAGE C — first click reveals confirm + statement of effect, does NOT file: " + C_PASS +
    `  [confirmHeading=${confirmHeading}, effect=${effectStmt}, stillReview=${stillReviewAfterClick}]`);
await page.screenshot({ path: `${SHOT}/c-2-confirm-step.png`, fullPage: true });

// 3. Confirm → Filed
await confirmBtn.first().click();
await page.waitForTimeout(3000);
await fresh();
const filed = /Filed/i.test(await body());
say("→ After Confirm, case is Filed: " + filed);
await page.screenshot({ path: `${SHOT}/c-3-filed.png`, fullPage: true });

// 4. PACKAGE D — RFE response carries the adjudication (Compliance check) badge
const rfeBox = page.getByPlaceholder(/The evidence does not establish/i);
const rfePresent = (await rfeBox.count()) > 0;
say("RFE studio present on Filed case: " + rfePresent);
let D_PASS = false;
if (rfePresent) {
  await rfeBox.first().fill(
    "The evidence does not establish that the beneficiary satisfies the original contribution criterion. " +
    "Submit additional documentation showing the significance and impact of the claimed contributions in the field.",
  );
  say("→ Generating RFE response (real Claude)…");
  await page.getByRole("button", { name: /Draft RFE response/i }).first().click();
  let waited = 0;
  while (waited < 160000) {
    await page.waitForTimeout(3000); waited += 3000;
    if ((await page.getByText(/Compliance check/i).count()) > 0) break;
    // settled fallback: the generate button label returns to "Regenerate response"
    if ((await page.getByRole("button", { name: /Regenerate response/i }).count()) > 0 && waited > 9000) break;
  }
  await page.waitForTimeout(1500);
  D_PASS = (await page.getByText(/Compliance check/i).count()) > 0;
  say(`PACKAGE D — RFE response shows the adjudication 'Compliance check' badge: ${D_PASS}  (waited ${Math.round(waited/1000)}s)`);
  await page.screenshot({ path: `${SHOT}/d-rfe-result.png`, fullPage: true });
}

await browser.close();
say(`\nSUMMARY: C=${C_PASS ? "PASS" : "FAIL"}  D=${D_PASS ? "PASS" : "FAIL"}`);
await writeFile("uat/runs/2026-06-19-l2/review_rfe.log", log.join("\n"));
