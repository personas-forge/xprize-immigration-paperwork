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

import { NextResponse } from "next/server";
import { OPERATION_REGISTRY } from "./registry";

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets (for the Retry-After header). */
  retryAfterSec: number;
}

/**
 * The canonical 429 for a denied {@link RateLimitResult} — the `rate_limited`
 * error key, the `retryAfterSec` field, the `Retry-After` header, and the
 * caller-supplied disclaimer. ONE definition so the orchestrator and the
 * non-orchestrated routes (the two anonymous previews, draft/save) can't drift on
 * the wire contract (the disclaimer was once dropped on one path). The disclaimer
 * is passed in so the limiter needn't import a feature constant.
 */
export function tooManyRequestsResponse(
  rl: RateLimitResult,
  disclaimer: string,
): NextResponse {
  return NextResponse.json(
    { error: "rate_limited", retryAfterSec: rl.retryAfterSec, disclaimer },
    { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
  );
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

/**
 * Cap for the ANONYMOUS, keyless preview routes (`/api/qualify/preview` and its
 * best-path sibling). Deliberately governed OUTSIDE OPERATION_REGISTRY: a preview
 * runs no model and charges nothing, so it is not a metered operation, and adding
 * a registry entry would break the "exactly six metered operations" invariant
 * (registry.test.ts). It sits LOWER than the authenticated model-backed caps (40)
 * on purpose — an anonymous, IP-keyed endpoint is the most abuse-prone surface
 * (no balance to drain, no account to ban), so the unauthenticated path is held
 * tighter. One shared constant so the two preview routes can't drift to two caps.
 */
export const PREVIEW_RATE_LIMIT = 30;

const RATE_WINDOW_MS = 60_000;

// ⚠ SINGLE-NODE: counts live in THIS process's memory. The caps in RATE_LIMITS
// are correct only on ONE instance — under horizontal scaling (PM2 cluster,
// multiple containers, serverless concurrency) each process keeps its own counts
// and the EFFECTIVE cap multiplies by the instance count, while a cold start /
// HMR resets every count to zero. The seam to fix this already exists:
// `checkRateLimit` takes an injectable `store`, so a shared backend (Redis/
// Upstash) can be dropped in when the deployment scales past one node.
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
 * Keep the bucket map under MAX_BUCKETS as a HARD ceiling. Expiry-only pruning is
 * defeated by an IP-rotation burst within a single window (no bucket has expired
 * yet), so after pruning expired entries, if the map is still full, evict the
 * entries closest to expiry (oldest `resetAt`) until there's room for one more.
 * Bounds memory regardless of expiry — the limiter can't be turned into a
 * memory-exhaustion amplifier.
 */
function enforceCap(store: Map<string, Bucket>, now: number): void {
  if (store.size < MAX_BUCKETS) return;
  pruneExpired(store, now);
  if (store.size < MAX_BUCKETS) return;
  const overflow = store.size - MAX_BUCKETS + 1; // make room for the incoming key
  const oldest = [...store.entries()]
    .sort((a, b) => a[1].resetAt - b[1].resetAt)
    .slice(0, overflow);
  for (const [k] of oldest) store.delete(k);
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
    enforceCap(store, now);
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

/** Number of TRUSTED reverse-proxy hops in front of the app (the platform edge
 *  + any CDN you control), from `TRUSTED_PROXY_HOPS` (default 0 = one trusted
 *  edge appends the client IP as the rightmost `x-forwarded-for` entry). */
function trustedProxyHops(
  env: Record<string, string | undefined> = process.env,
): number {
  const n = Number(env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/**
 * The forwarded client IP, VALIDATED, or `null`.
 *
 * SECURITY: `x-forwarded-for` is fully client-controlled. The LEFTMOST entry is
 * the original client's *claim* — an attacker rotates it (`1.2.3.4`, `1.2.3.5`,
 * …) to mint a fresh limiter bucket per request and bypass the cap. We instead
 * take the **rightmost-minus-N** hop — the value our own trusted edge appended
 * (N = `trustedProxyHops()`) — which a caller cannot forge. A non-IP / absent
 * value yields `null` so the caller collapses into a shared `anon` bucket rather
 * than fanning out. (The hard bucket-map ceiling caps the residual fan-out.)
 */
export function clientIp(
  headers: Pick<Headers, "get">,
  hops: number = trustedProxyHops(),
): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const idx = parts.length - 1 - hops;
    const candidate = idx >= 0 ? parts[idx] : undefined;
    if (candidate && isValidIp(candidate)) return candidate;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  return realIp && isValidIp(realIp) ? realIp : null;
}

/**
 * Identity for limiting: the authenticated user when known (so a user can't dodge
 * the cap by rotating IPs), else the forwarded client IP, else a shared "anon"
 * bucket. Scoped per route so one endpoint's traffic can't exhaust another's.
 *
 * SECURITY: a garbage / spoofed non-IP `x-forwarded-for` (an attacker injecting
 * per-request junk to mint a fresh bucket each call) collapses into the shared
 * `anon` bucket via {@link clientIp} rather than bypassing the cap.
 */
export function rateLimitKey(
  request: Request,
  scope: string,
  userId?: string | null,
): string {
  if (userId) return `${scope}:u:${userId}`;
  return `${scope}:ip:${clientIp(request.headers) ?? "anon"}`;
}

/** True unless explicitly disabled (e.g. RATE_LIMIT_DISABLED=1 for e2e/load tests). */
export function isRateLimitEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.RATE_LIMIT_DISABLED !== "1";
}
