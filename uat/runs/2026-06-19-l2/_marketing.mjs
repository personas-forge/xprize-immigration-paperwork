// L2 live verification — Package A (positioning/trust) + billing copy, against the
// real running app. Asserts the FAQ now reads as a drafting tool (not a law firm),
// /validation is reachable from cold surfaces, and billing shows per-op costs.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const SHOT = "uat/runs/2026-06-19-l2/shots";
const checks = [];
const check = (name, cond, detail = "") => checks.push({ name, pass: !!cond, detail });

await mkdir(SHOT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const load = async (route) => {
  await page.goto(new URL(route, BASE).toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1000);
  return page.locator("body").innerText();
};

// — FAQ (kw-eval-01 / PN-PROS-01 / kw-eval-03) — expand <details> to read answers
await page.goto(new URL("/faq", BASE).toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(800);
await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
await page.waitForTimeout(300);
const faq = await page.locator("body").innerText();
await page.screenshot({ path: `${SHOT}/faq.png`, fullPage: true });
const firmLeak = faq.match(/flat fee|counsel of record|attorney-client privilege|biometrics|ATA-certified/i);
check("FAQ: 'not a law firm' positioning present", /not a law firm/i.test(faq));
check("FAQ: 'your own attorney' framing present", /your own attorney/i.test(faq));
check("FAQ: token pricing present", /prepaid tokens|150 free tokens/i.test(faq));
check("FAQ: NO flat-fee-firm language", !firmLeak, firmLeak?.[0] ?? "");
check("FAQ: engine-agnostic (no 'Gemini')", !/gemini/i.test(faq));
check("FAQ: links to /validation", (await page.locator('a[href="/validation"]').count()) > 0);

// — Landing footer (kw-eval-02)
await load("/");
check("Landing: footer /validation link", (await page.locator('a[href="/validation"]').count()) > 0);

// — Billing (PN-PROS-02 / SR-EV-01) + /validation
const billing = await load("/billing");
await page.screenshot({ path: `${SHOT}/billing.png`, fullPage: true });
check("Billing: legacy '1 token = form-field' copy GONE",
  !/one AI form-field guidance answer|form-field answer costs a single token/i.test(billing));
check("Billing: per-op cost list shows the full draft", /Petition letter draft/i.test(billing));
check("Billing: /validation link", (await page.locator('a[href="/validation"]').count()) > 0);

// — Validation reachable + real evidence (kw-eval-02 strength)
const val = await load("/validation");
await page.screenshot({ path: `${SHOT}/validation.png`, fullPage: true });
check("Validation: renders primary-source evidence", /214\.2|8 CFR|extraordinary/i.test(val));

await browser.close();
let pass = 0;
for (const c of checks) { console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [leak: ${c.detail}]` : ""}`); if (c.pass) pass++; }
console.log(`\n${pass}/${checks.length} passed`);
