import { createHmac, randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { UAT_WEBHOOK_SECRET, UAT_PRODUCTS } from "../../playwright.uat.config";

/** The synthetic dev-auth identity (devAuth.DEV_USER.id). */
export const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";

/** The signup grant the onboarding flow mints (FREE_SIGNUP_GRANT). Pinned here
 *  as a literal on purpose: if the economy is repriced, the UAT debit math is
 *  re-derived consciously rather than silently following the constant. */
export const SIGNUP_GRANT = 150;

/** Registry prices the journeys assert (TIER_COST × OPERATION_REGISTRY). Same
 *  deliberate-literal rule as SIGNUP_GRANT. */
export const PRICE = {
  qualify: 3,
  draft: 12,
  draft_section: 5,
  rfe: 5,
  categorize: 1,
  guidance: 1,
} as const;

/**
 * goto + wait for React hydration (html[data-hydrated], set by
 * HydrationMarker). The reveal wrappers ship VISIBLE server HTML, so a page is
 * readable before it is interactive — a click fired at `load` lands on inert
 * markup and silently vanishes. Use this for any page the test will CLICK;
 * plain page.goto is fine for read-only assertions (server-rendered text).
 */
export async function gotoInteractive(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForSelector("html[data-hydrated]", { state: "attached", timeout: 20_000 });
}

/** Read the current token balance off the dashboard BalancePill. Navigates. */
export async function readBalance(page: Page): Promise<number> {
  await page.goto("/dashboard");
  const pill = page.getByLabel(/Token balance:/).first();
  await expect(pill).toBeVisible();
  const text = await pill.innerText();
  const m = /([\d,]+)/.exec(text);
  if (!m) throw new Error(`BalancePill shows no numeric balance (got: "${text}")`);
  return Number(m[1].replaceAll(",", ""));
}

/**
 * standardwebhooks signature headers for a simulated Polar webhook delivery.
 * Key derivation mirrors the SDK exactly: `validateEvent` base64-encodes the
 * RAW secret string and hands it to standardwebhooks' Webhook, which decodes it
 * back — so the HMAC key is simply the secret's utf-8 bytes.
 */
export function polarWebhookHeaders(body: string): Record<string, string> {
  const id = `uat-msg-${randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac("sha256", Buffer.from(UAT_WEBHOOK_SECRET, "utf-8"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${sig}`,
    "content-type": "application/json",
  };
}

/**
 * A schema-complete Polar order event (validated against the SDK's zod inbound
 * schemas — `validateEvent` rejects partial payloads with a 403-surfacing
 * parse error, so every required Order field is present).
 */
export function polarOrderEvent(
  type: "order.paid" | "order.refunded",
  opts: { orderId: string; productId?: string; refundedCents?: number },
): string {
  const now = new Date().toISOString();
  const productId = opts.productId ?? UAT_PRODUCTS.starter;
  const price = {
    id: "uat_price_1",
    created_at: now,
    modified_at: null,
    is_archived: false,
    product_id: productId,
    price_currency: "usd",
    price_amount: 500,
    type: "one_time",
    amount_type: "fixed",
  };
  const product = {
    id: productId,
    created_at: now,
    modified_at: null,
    name: "Starter",
    description: null,
    is_recurring: false,
    is_archived: false,
    organization_id: "uat_org",
    prices: [price],
    benefits: [],
    medias: [],
    metadata: {},
    trial_interval: null,
    trial_interval_count: null,
    visibility: "public",
    recurring_interval: null,
    recurring_interval_count: null,
  };
  const customer = {
    id: "uat_cust_1",
    created_at: now,
    modified_at: null,
    email: "developer@localhost",
    email_verified: true,
    name: "UAT Developer",
    billing_address: null,
    tax_id: null,
    organization_id: "uat_org",
    deleted_at: null,
    avatar_url: "https://example.com/a.png",
    external_id: DEV_USER_ID,
    metadata: {},
    type: "individual",
  };
  const order = {
    id: opts.orderId,
    created_at: now,
    modified_at: null,
    status: type === "order.refunded" ? "refunded" : "paid",
    paid: true,
    description: "Starter bundle",
    subtotal_amount: 500,
    discount_amount: 0,
    net_amount: 500,
    amount: 500,
    tax_amount: 0,
    total_amount: 500,
    refunded_amount: opts.refundedCents ?? 0,
    refunded_tax_amount: 0,
    currency: "usd",
    applied_balance_amount: 0,
    due_amount: 0,
    invoice_number: "UAT-0001",
    platform_fee_amount: 0,
    platform_fee_currency: "usd",
    billing_reason: "purchase",
    billing_address: null,
    billing_name: null,
    is_invoice_generated: false,
    customer_id: "uat_cust_1",
    product_id: productId,
    discount_id: null,
    subscription_id: null,
    checkout_id: null,
    user_id: "uat_cust_1",
    metadata: { userId: DEV_USER_ID, bundle: "starter" },
    custom_field_data: {},
    customer,
    user_metadata: {},
    product,
    discount: null,
    subscription: null,
    items: [
      {
        id: "uat_item_1",
        created_at: now,
        modified_at: null,
        label: "Starter",
        amount: 500,
        tax_amount: 0,
        proration: false,
        product_price_id: "uat_price_1",
      },
    ],
  };
  return JSON.stringify({ type, timestamp: now, data: order });
}

/**
 * Idempotent onboarding: the dev user must consent once per fresh DB before the
 * dashboard opens (this is also the moment the signup grant is minted). Safe to
 * call at the top of every journey — a consented user sails through.
 */
export async function ensureOnboarded(page: Page): Promise<void> {
  await page.goto("/dashboard");
  if (!page.url().includes("/welcome")) return;
  // The consent form is about to be interacted with — wait for hydration.
  await page.waitForSelector("html[data-hydrated]", { state: "attached", timeout: 20_000 });
  await page.getByLabel("Full legal name").fill("UAT Developer");
  await page.getByRole("checkbox", { name: /Terms of Service/ }).check();
  await page.getByRole("checkbox", { name: /Privacy Policy/ }).check();
  await page.getByRole("button", { name: /Agree & open my case file/ }).click();
  await page.waitForURL((url) => !url.pathname.includes("/welcome"));
}
