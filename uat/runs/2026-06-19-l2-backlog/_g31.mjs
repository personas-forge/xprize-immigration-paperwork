// G3.1 — the inline hero result header reads "Extraordinary-ability screening",
// not "Certificate of Extraordinary Ability". The hero preview is the instant
// keyword read (no model), so this is fast.
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3001";
const SHOT = "uat/runs/2026-06-19-l2-backlog/shots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1200);
await page.getByPlaceholder(/Paste your CV highlights/i).fill(
  "Granted patent; won a best paper award; featured in the press; 20 publications with 3000 citations; founder and CTO.",
);
await page.getByRole("button", { name: /Reveal my verdict/i }).click();
// wait for the result certificate header to render
let ok = false;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(500);
  if ((await page.getByText(/Extraordinary-ability screening/i).count()) > 0) { ok = true; break; }
}
await page.screenshot({ path: SHOT + "/g31-hero-result.png", fullPage: true });
const body = await page.locator("body").innerText();
console.log("G3.1 — header reads 'Extraordinary-ability screening':", ok);
console.log("G3.1 — old 'Certificate of Extraordinary Ability' gone from hero result:",
  !/Certificate of Extraordinary Ability/i.test(body));
await browser.close();
