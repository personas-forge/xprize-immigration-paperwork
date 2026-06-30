import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

// Cost/profit telemetry → the external **LightTrack** observability service (margin = revenue − LLM
// cost). NOTE: `lib/lighttrack.ts` is the VENDORED LightTrack client (the SAME service — events +
// scores + guard). This module is a deliberate FORK of its `/v1/events` path, made ONLY to add the
// AsyncLocalStorage billing attribution (metadata.customer_id) that can't be edited into the vendored
// file; it is the LLM-cost + Polar-revenue feed to that same LightTrack API.
//
// Best-effort by design: every call swallows its own errors and is time-boxed, so telemetry can never
// break or noticeably slow a request (same contract as recordAiFailure / the Polar client). Disabled
// (a no-op) unless LIGHTTRACK_URL + LIGHTTRACK_KEY are set, so local dev needs no config.
//
// Customer attribution rides in an AsyncLocalStorage context set by the AI route envelopes
// (withMeteredRoute / the ask route), so the deep `generateText` seam — and the ledger agent that
// calls it — emit events tagged with the right user without threading a userId through every call.

interface Billing {
  /** Metered user's id — the SAME id Polar orders echo in `metadata.userId`, so LightTrack joins
   *  revenue to cost on it. */
  customerId?: string;
  /** Coarse feature/operation label, e.g. `ask-ledger`, `insight-wealth`. */
  feature?: string;
}

const billingCtx = new AsyncLocalStorage<Billing>();

/** Run `fn` with the billing attribution that LLM events emitted inside it inherit. */
export function runWithBilling<T>(ctx: Billing, fn: () => Promise<T>): Promise<T> {
  return billingCtx.run(ctx, fn);
}

function currentBilling(): Billing {
  return billingCtx.getStore() ?? {};
}

function config(): { url: string; key: string; project?: string } | null {
  const url = process.env.LIGHTTRACK_URL;
  const key = process.env.LIGHTTRACK_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key, project: process.env.LIGHTTRACK_PROJECT };
}

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  const c = config();
  if (!c) return; // telemetry disabled
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 2000);
  try {
    await fetch(`${c.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.key}` },
      body: JSON.stringify(c.project ? { project_id: c.project, ...body } : body),
      signal: ac.signal,
    });
  } catch {
    // best-effort: telemetry must never break the host request
  } finally {
    clearTimeout(timer);
  }
}

/** Record one LLM call's cost, tagged to the ambient billing customer/feature. */
export async function trackLlm(opts: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
  status?: "success" | "error";
}): Promise<void> {
  const { customerId, feature } = currentBilling();
  await post("/v1/events", {
    provider: opts.provider,
    model: opts.model,
    usage: { input: opts.inputTokens, output: opts.outputTokens },
    latency_ms: opts.latencyMs,
    status: opts.status ?? "success",
    metadata: { customer_id: customerId, product_id: feature },
  });
}

/** Relay a settled Polar order / refund to LightTrack as revenue (Pattern 3). The deterministic id
 *  makes redelivery an idempotent upsert. */
export async function trackRevenue(opts: {
  externalId: string;
  customerId?: string;
  productId?: string;
  amountUsd: number;
  currency?: string;
  kind: "subscription" | "one_time" | "refund";
  ts?: string;
}): Promise<void> {
  const prefix = opts.kind === "refund" ? "polar:refund:" : "polar:";
  await post("/v1/revenue", {
    id: `${prefix}${opts.externalId}`,
    source: "polar",
    external_id: opts.externalId,
    customer_id: opts.customerId,
    product_id: opts.productId,
    amount_usd: opts.amountUsd,
    currency: (opts.currency ?? "usd").toUpperCase(),
    kind: opts.kind,
    ts: opts.ts,
  });
}
