> Total: 5 | Critical: 1 | High: 2 | Medium: 2 | Low: 0
> Context: Rate Limiting
> Lens mix: bug-hunter 5, ui-perfectionist 0

## 1. Forged-but-valid `x-forwarded-for` rotates IP buckets → IP-keyed limiter fully bypassable
- **Severity**: Critical
- **Lens**: bug-hunter
- **Category**: header spoofing / limiter bypass
- **File**: src/lib/tokens/rate-limit.ts:125-149 (`clientIp` + `rateLimitKey`); abused via src/app/api/guidance/route.ts:40, src/app/api/evidence/categorize/route.ts:47, src/app/api/qualify/preview/route.ts:40, src/app/api/qualify/preview/best-path/route.ts:28
- **Scenario**: An attacker hits the anonymous, IP-keyed routes (`guidance`, `categorize`, `qualify_preview`, `best_path_preview`) sending `x-forwarded-for: 1.2.3.4` on call 1, `1.2.3.5` on call 2, `1.2.3.6` on call 3, … Every value is a syntactically valid IPv4/IPv6 literal, so `clientIp` returns it unchanged and `rateLimitKey` mints a brand-new bucket (`guidance:ip:1.2.3.6`) for each request. Each bucket starts at `count: 1`, so `rl.ok` is always true. The per-IP cap (e.g. `categorize`/`guidance` = 40, preview = 30) is never reached and the flood proceeds — running up Gemini model cost on `guidance`/`categorize` and unbounded compute on the previews.
- **Root cause**: `clientIp` validates that the forwarded header is *a* valid IP, but `x-forwarded-for` is fully client-controlled. The hardening only collapses non-IP *garbage* into the shared `anon` bucket; it does nothing against an attacker who simply rotates through valid IP literals — which is the actual bypass. The code comment ("garbage / spoofed non-IP value collapses into `anon` rather than bypassing the cap", lines 138-140) protects against the wrong threat. There is no trusted-proxy hop count, so the *leftmost* (most attacker-controllable) hop is always taken (see #2).
- **Impact**: The only documented defense for the unauthenticated AI/preview surface ("the only abuse surface is a flood") is defeated by a one-line header per request. Cost-bearing (`guidance`, `categorize` call the real model) and DoS amplification on previews. Also feeds the unbounded-Map growth in #4.
- **Fix sketch**: Don't trust the raw leftmost XFF. Derive the client IP from the platform's trusted edge: either honor only a configured number of trailing trusted-proxy hops (parse XFF right-to-left, skip N trusted, take the next), or use the connection/`request.ip` the host injects. Where the real IP genuinely can't be established, fall to the shared `anon` bucket rather than minting per-header buckets, and consider a secondary global cap on the `:ip:anon` + per-route total so rotation can't fan out.

## 2. `x-forwarded-for` parsed left-to-right takes the most-spoofable hop
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: header trust / proxy semantics
- **File**: src/lib/tokens/rate-limit.ts:126-130
- **Scenario**: Deployed behind a proxy/CDN, `x-forwarded-for` is `"<client>, <proxy1>, <our-edge>"`. The code does `.split(",")[0]` and takes the **leftmost** entry — the value the *original client* claimed, which any caller can set arbitrarily. The trustworthy value (appended by your own edge) is the **rightmost** hop.
- **Root cause**: Leftmost-hop selection is correct only when you can trust every upstream proxy to have stripped client-supplied XFF — which is not asserted or configured anywhere. There is no trusted-proxy count, so the function structurally trusts attacker input.
- **Impact**: This is what makes #1 trivially exploitable in production and also lets a single real attacker *impersonate another user's IP bucket* (set XFF to a victim's IP) to exhaust that victim's per-IP allowance (limiter as a griefing tool). Also pollutes the consent-record IP written via `clientIp` in src/app/welcome/actions.ts:38.
- **Fix sketch**: Take the IP from a known trusted position (rightmost-minus-N where N = configured trusted hops), or read the host-provided connection IP. Document the trusted-proxy assumption in code. Keep the syntactic `isValidIp` check as a secondary guard, not the primary trust decision.

## 3. `MAX_BUCKETS` cap is ineffective under a burst of distinct live keys → unbounded Map growth
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: memory growth / eviction
- **File**: src/lib/tokens/rate-limit.ts:60-66, 82-84
- **Scenario**: The IP-rotation flood from #1 inserts thousands of distinct keys *within the same 60s window*. On each new key, when `store.size >= MAX_BUCKETS` the code calls `pruneExpired`, which only deletes entries where `now >= b.resetAt`. During a sustained burst essentially *no* bucket has expired yet (all created seconds ago, `resetAt = now + 60_000`), so `pruneExpired` frees nothing and the Map keeps growing past 10,000 — 100k, 1M entries — for as long as the attacker rotates IPs faster than windows expire.
- **Root cause**: The eviction policy is "drop expired on overflow," but overflow is *caused by* live (non-expired) keys. There is no hard cap (no LRU / no reject / no size ceiling that drops live entries), so `MAX_BUCKETS` is a soft hint that the worst case ignores. The comment claims it stops "one-time visitors / rotated IPs" from leaking memory — but rotated IPs within one window are exactly the case it fails to bound.
- **Impact**: In-memory Map grows without bound under the same spoofing vector as #1 → process RSS climbs until OOM / GC thrash on the single `next start` node. Turns the limiter into a memory-exhaustion DoS amplifier.
- **Fix sketch**: Enforce a true hard ceiling: when `pruneExpired` fails to bring size under `MAX_BUCKETS`, evict oldest-`resetAt` entries (or reject new keys / route them to a shared overflow bucket) so the Map cannot exceed the cap regardless of expiry. Combined with fixing #1/#2, the legitimate key cardinality stays small.

## 4. `byUser` rate-limit silently falls back to spoofable IP for unauthenticated callers on auth-only ops
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: key derivation / silent fallback
- **File**: src/lib/ai/operation.ts:246-252 (with src/app/api/qualify/route.ts:41, best-path:29, rfe/route.ts:51)
- **Scenario**: For `qualify`, `best_path`, and `rfe` the spec sets `byUser: true`, but rate-limiting (step 3) runs *before* the auth/charge gate (step 4). When `resolveUser()` returns null (anonymous request), `keyUser` is `undefined`, so `rateLimitKey` falls through to the IP branch — `qualify:ip:<spoofable>`. An anonymous attacker therefore gets the IP-keyed, header-spoofable limiter (#1/#2) on routes that are documented as "keyed by user … stops IP-rotation evasion." They still 401 at charge, so no model cost — but the limiter's own bucket map is freely inflatable (feeds #3), and the "byUser stops IP-rotation" guarantee is silently void on the pre-auth path.
- **Root cause**: The fallback from missing userId to IP is implicit and unconditional; the comment promises user-keying without noting it only holds *after* a user is resolved, which never happens for anonymous traffic reaching the limiter.
- **Impact**: Limited (these routes 401 before any spend), but the IP fan-out still bloats the bucket Map and the documented anti-evasion property doesn't hold for anonymous requests. Mostly an integrity/observability gap on the auth-keyed ops.
- **Fix sketch**: For `byUser` ops, when no user is resolved either (a) skip straight to the 401 before rate-limiting, or (b) bucket all anonymous traffic for that scope into a single shared `:anon` key rather than per-IP, so unauth callers can't fan out the Map. Document that user-keying only applies post-auth.

## 5. Per-instance limiter is silent about its single-node scope (documented-limitation gap)
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: documented limitation / observability
- **File**: src/lib/tokens/rate-limit.ts:54 (`globalBuckets` module Map), :10-13 (doc)
- **Scenario**: The limiter lives in `globalBuckets`, a module-level `Map`. This is by-design for the single `next start` node, but nothing *enforces* single-node: if the app is ever run with >1 worker/instance (PM2 cluster, multiple containers, serverless concurrency), each process keeps its own counts and the effective cap multiplies by the instance count, while module reloads (HMR/dev, cold starts) reset all counts to zero. There is no runtime assertion or env signal tying the deployment to the single-node assumption.
- **Root cause**: In-memory state with no shared backing store and no guard that the deployment topology matches the assumption. (Per the scan brief this is the intended single-node design — flagged only as the documented-limitation gap, not as a Critical.)
- **Impact**: If the deployment ever scales horizontally, the cap quietly inflates by instance count and offers far less protection than the numbers in `RATE_LIMITS` imply — a quiet correctness drift with no warning.
- **Fix sketch**: Keep the in-memory limiter as the default, but (a) add a one-line startup warning / doc note that it is per-instance and only correct on a single node, and (b) leave a seam (an injectable async store interface) so a shared backend (Redis/Upstash) can be dropped in if the app is ever scaled — matching the existing `store`-injection design.
