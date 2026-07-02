import { test, expect, type Page } from "@playwright/test";
import { ensureOnboarded, readBalance, PRICE } from "./helpers";
import { gotoInteractive } from "./helpers";

// @uat — Paying user + attorney (personas B2): the full life of one case.
// Vault categorization (1 token) with refile + soft-delete/undo, case tracking
// (Your cases + roadmap), field guidance (1 token), the attorney lifecycle
// (draft 12 → submit → review queue → sign & file DEMO stub → Filed), the RFE
// studio (5 tokens) unlocked by Filed, a recorded decision, and the account
// surface (export, marketing preference, delete-phrase validation).
// Runs third in the ordered journey chain; all balance math is delta-based.

const PETITIONER = "UAT Lifecycle";

async function createCase(page: Page): Promise<string> {
  const res = await page.request.post("/api/qualify", {
    data: {
      name: PETITIONER,
      classification: "O-1A",
      profile:
        "Senior research engineer; 6 papers, 412 citations, a granted patent; " +
        "TechCrunch press; $320K salary; founding engineer at a Series B startup.",
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.caseId, "authenticated qualify must persist a case").toBeTruthy();
  return body.caseId as string;
}

function casePath(): string {
  const p = process.env.UAT_LIFECYCLE_CASE;
  expect(p, "the vault test must have created the lifecycle case").toBeTruthy();
  return p!;
}

test.describe("@uat case lifecycle: vault → review → filing → RFE → account", () => {
  test("evidence vault: categorize debits 1, refile and delete/undo are free", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const caseId = await createCase(page);
    process.env.UAT_LIFECYCLE_CASE = `/dashboard/cases/${caseId}`;
    const before = await readBalance(page);

    await gotoInteractive(page, casePath());
    await expect(page.getByText("§ III — Evidence vault")).toBeVisible();

    const docName = "ICML 2024 Best Paper certificate";
    await page.getByPlaceholder("e.g. ICML 2024 Best Paper certificate").fill(docName);
    await page
      .getByPlaceholder("Paste the document text or describe what it shows…")
      .fill(
        "This certifies the Best Paper Award at ICML 2024 to the recipient, " +
          "selected from 3,200 submissions. Signed by the program chairs.",
      );
    await page.getByRole("button", { name: "Add & categorize" }).click();

    // The document lands in a criterion bucket with an exhibit ordinal.
    const doc = page.locator("li").filter({ hasText: docName }).first();
    await expect(doc).toBeVisible({ timeout: 30_000 });
    await expect(doc).toContainText("Ex. 1");

    // Debit correctness for the light-tier op.
    expect(await readBalance(page)).toBe(before - PRICE.categorize);

    // Refile to another criterion — no charge, document moves buckets.
    await gotoInteractive(page, casePath());
    await page.getByLabel(`Re-file ${docName}`).selectOption("Press");
    const pressBucket = page
      .locator("section, div")
      .filter({ has: page.getByText("Press", { exact: true }) })
      .filter({ hasText: docName });
    await expect(pressBucket.first()).toBeVisible();

    // Soft-delete behind window.confirm, then Undo restores the exhibit.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: `Remove ${docName}` }).click();
    const undoBanner = page.getByRole("status").filter({ hasText: `Removed ${docName}` });
    await expect(undoBanner).toBeVisible();
    await undoBanner.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator("li").filter({ hasText: docName }).first()).toBeVisible();

    // Neither refile nor delete/undo touched the balance.
    expect(await readBalance(page)).toBe(before - PRICE.categorize);
  });

  test("case tracking: the case shows under Your cases and the roadmap reflects Intake", async ({
    page,
  }) => {
    await ensureOnboarded(page);

    await gotoInteractive(page, "/dashboard");
    const caseLink = page.getByRole("link", { name: new RegExp(PETITIONER) }).first();
    await expect(caseLink).toBeVisible();

    await gotoInteractive(page, casePath());
    await expect(page.getByText("Roadmap · where your petition stands")).toBeVisible();
    for (const stage of ["Qualified", "Evidence", "Drafted", "Attorney review", "Decision"]) {
      await expect(page.getByText(stage, { exact: true }).first()).toBeVisible();
    }
  });

  test("field guidance debits 1 token and renders disclaimed informational text", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    await gotoInteractive(page, "/dashboard");
    const situation = page.getByPlaceholder(/O-1A researcher with 6 papers/);
    await expect(situation).toBeVisible({ timeout: 30_000 });
    await situation.fill("O-1A researcher preparing the extraordinary-ability evidence section.");
    await page.getByRole("button", { name: /Get field guidance/ }).click();

    await expect(
      page.getByText("Guidance ready — informational only, not legal advice."),
    ).toBeVisible({ timeout: 30_000 });
    expect(await readBalance(page)).toBe(before - PRICE.guidance);
  });

  test("attorney lifecycle: draft → submit → queue → sign & file (demo) → Filed", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    // A draft must exist before sign & file (actions.ts pre-file gate).
    await gotoInteractive(page, casePath());
    await page.getByRole("button", { name: "Draft the petition" }).click();
    await expect(page.getByRole("button", { name: "Regenerate full draft" })).toBeVisible({
      timeout: 60_000,
    });
    expect(await readBalance(page)).toBe(before - PRICE.draft);

    // Owner submits for attorney review.
    await gotoInteractive(page, casePath());
    await page.getByRole("button", { name: "Submit for attorney review" }).click();
    await expect(page.getByText("Submitted for review").first()).toBeVisible({ timeout: 30_000 });

    // The case surfaces in the attorney's review queue.
    await gotoInteractive(page, "/dashboard/review");
    await expect(page.getByText("§ — Awaiting review")).toBeVisible();
    await page.getByRole("link", { name: new RegExp(PETITIONER) }).first().click();
    await expect(page).toHaveURL(new RegExp(casePath().replaceAll("/", "\\/")));

    // Two-step sign & file, blank receipt → DEMO receipt recorded honestly.
    await page.getByRole("button", { name: "Sign & file with USCIS" }).click();
    const confirmGroup = page.getByRole("group", { name: "Confirm sign and file" });
    await expect(confirmGroup).toBeVisible();
    await confirmGroup.getByRole("button", { name: "Confirm — sign & file" }).click();

    await expect(page.getByText("Demo receipt")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Not a genuine USCIS receipt/)).toBeVisible();
    await expect(page.getByText("Signed by attorney").first()).toBeVisible();
    await expect(page.getByText("Filed with USCIS").first()).toBeVisible();

    // Filing costs nothing — only the draft was charged.
    expect(await readBalance(page)).toBe(before - PRICE.draft);
  });

  test("Filed unlocks the RFE studio; drafting a response debits 5 and saves", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);

    await gotoInteractive(page, casePath());
    await expect(page.getByText("RFE response · attorney work product")).toBeVisible();

    await page
      .getByPlaceholder(/The evidence does not establish/)
      .fill(
        "The evidence does not establish that the beneficiary satisfies the awards " +
          "criterion. Submit additional documentation of the award's national significance.",
      );
    await page.getByRole("button", { name: "Draft RFE response" }).click();

    await expect(page.getByRole("button", { name: "Regenerate response" })).toBeVisible({
      timeout: 60_000,
    });
    // Persisted, not just rendered: the save-failure alert must be absent.
    await expect(page.getByText("Not saved")).toHaveCount(0);
    expect(await readBalance(page)).toBe(before - PRICE.rfe);

    // The attorney records the decision, closing the arc. (readBalance left the
    // browser on /dashboard — return to the case first.)
    await gotoInteractive(page, casePath());
    await page.locator('select[name="decision"]').selectOption("Approved");
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("This petition has been approved. 🎉")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("the RFE save-rescue endpoint persists for free (charged-but-unsaved parity)", async ({
    page,
  }) => {
    await ensureOnboarded(page);
    const before = await readBalance(page);
    const caseId = casePath().split("/").pop()!;

    const res = await page.request.post("/api/rfe/save", {
      data: {
        caseId,
        rfeText: "Rescue-path check: the notice text the response answers.",
        sections: [
          { heading: "Response to Request for Evidence", body: "Re-saved after a simulated save failure." },
        ],
        source: "claude",
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.persisted).toBe(true);
    expect(typeof body.version).toBe("number");

    // The rescue is persistence-only: no charge, ever.
    expect(await readBalance(page)).toBe(before);
  });

  test("account: export carries the user's data; preferences toggle; delete demands the exact phrase", async ({
    page,
  }) => {
    await ensureOnboarded(page);

    // GDPR export includes the identity and the lifecycle case.
    const res = await page.request.get("/api/me/export");
    expect(res.ok()).toBeTruthy();
    const exported = JSON.stringify(await res.json());
    expect(exported).toContain("developer@localhost");
    expect(exported).toContain(PETITIONER);

    // Marketing preference round-trip with a visible confirmation.
    await gotoInteractive(page, "/dashboard/account");
    const toggle = page.getByRole("button", { name: /Turn (on|off) marketing emails/ });
    const labelBefore = await toggle.innerText();
    await toggle.click();
    await expect(page.getByText("Preference updated.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Turn (on|off) marketing emails/ })).not.toHaveText(
      labelBefore,
    );

    // Delete-account demands the exact phrase (we do NOT delete the account —
    // the wrong-phrase rejection is the assertion).
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByPlaceholder("delete my account").fill("delete account");
    await page.getByRole("button", { name: "Permanently delete" }).click();
    await expect(page.getByText(/Type "delete my account" exactly to confirm/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});
