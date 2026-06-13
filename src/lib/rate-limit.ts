/**
 * Minimal in-process rate limiter for the token-charged AI routes.
 *
 * The AI endpoints (/api/draft, /api/rfe, /api/guidance) debit tokens per call
 * but nothing caps call FREQUENCY, so an authenticated user can loop the xl/heavy
 * ops to drain their balance and run up real Gemini cost — and when metering is
 * in free-pass mode (no store / no auth / TOKENS_BYPASS) the routes are entirely
 * open and unmetered, i.e. a flood drives model cost with zero accounting.
 *
 * This is a fixed-window counter held in module memory. It is intentionally
 * simple: it protects a single Node instance (the `next start` deployment) and
 * is not a distributed limiter. `checkRateLimit` is pure (inject `now`/`store`)
 * so it is unit-testable; the routes apply it before charging.
 *
 * No Node built-ins and no `server-only` import, so it stays unit-testable under
 * the node test runner; it is only ever imported from server route handlers.
 */

import { OPERATION_REGISTRY } from "./tokens/registry";

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets (for the Retry-After header). */
  retryAfterSec: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Sensible per-window caps by route, generous enough not to bother real use.
 * Sourced from the OperationRegistry (single source of truth) — the five keys
 * (`draft | rfe | qualify | guidance | categorize`) are exactly the operations
 * that own a route bucket. `draft_section` shares the `draft` bucket so it has
 * no own entry. `qualify` gained its cap in the qualify→orchestrator migration
 * (ADR-0005, PR #12); the value now lives in the registry like the rest. Kept
 * `as const` so `keyof typeof RATE_LIMITS` still narrows to those buckets for
 * the orchestrator spec.
 */
export const RATE_LIMITS = {
  draft: OPERATION_REGISTRY.draft.rateLimit, // xl/heavy full-letter + section regenerations
  rfe: OPERATION_REGISTRY.rfe.rateLimit, // heavy
  qualify: OPERATION_REGISTRY.qualify.rateLimit, // medium — O-1A/EB-1A qualification screening
  guidance: OPERATION_REGISTRY.guidance.rateLimit, // light
  categorize: OPERATION_REGISTRY.categorize.rateLimit, // light — evidence categorization
} as const;

export const RATE_WINDOW_MS = 60_000;

const globalBuckets = new Map<string, Bucket>();

// Cap the bucket map so one-time visitors / rotated IPs can't leak memory: a
// fixed-window entry is only overwritten when its key is hit again, so without
// this, keys that never recur accumulate forever. When the map grows past this,
// drop every entry whose window has already elapsed (cheap, no background timer).
const MAX_BUCKETS = 10_000;

function pruneExpired(store: Map<string, Bucket>, now: number): void {
  for (const [k, b] of store) {
    if (now >= b.resetAt) store.delete(k);
  }
}

/**
 * Record a hit against `key` and report whether it is within `limit` for the
 * current `windowMs` window. Pure given `now` and `store`.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = RATE_WINDOW_MS,
  now: number = Date.now(),
  store: Map<string, Bucket> = globalBuckets,
): RateLimitResult {
  const bucket = store.get(key);

  // Fresh window: first hit, or the previous window has elapsed.
  if (!bucket || now >= bucket.resetAt) {
    if (store.size >= MAX_BUCKETS) pruneExpired(store, now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, limit, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true, limit, remaining: limit - bucket.count, retryAfterSec: 0 };
}

/** Strict syntactic check for an IPv4 or IPv6 literal. Rejects empty strings,
 *  garbage, and anything an attacker could inject to fan out into many buckets. */
function isValidIp(value: string): boolean {
  // IPv4: four 0-255 octets.
  if (
    /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(
      value,
    )
  ) {
    return true;
  }
  // IPv6: hex groups with optional `::` compression (incl. IPv4-mapped tails).
  return /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/.test(
    value,
  );
}

/**
 * Identity for limiting: the authenticated user when known (so a user can't dodge
 * the cap by rotating IPs), else the forwarded client IP, else a shared "anon"
 * bucket. Scoped per route so one endpoint's traffic can't exhaust another's.
 *
 * SECURITY: `x-forwarded-for` is client-controlled, so the first hop is only
 * honoured when it parses as a real IP literal; garbage / spoofed non-IP values
 * (an attacker injecting per-request junk to mint a fresh bucket each call) all
 * collapse into the shared `anon` bucket instead of bypassing the cap.
 */
export function rateLimitKey(
  request: Request,
  scope: string,
  userId?: string | null,
): string {
  if (userId) return `${scope}:u:${userId}`;
  const h = request.headers;
  const candidate =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "";
  return isValidIp(candidate) ? `${scope}:ip:${candidate}` : `${scope}:ip:anon`;
}

/** True unless explicitly disabled (e.g. RATE_LIMIT_DISABLED=1 for e2e/load tests). */
export function isRateLimitEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.RATE_LIMIT_DISABLED !== "1";
}
