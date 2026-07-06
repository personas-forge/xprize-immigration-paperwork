// Content-Security-Policy — ENFORCED-RELAXED (upgraded from
// Report-Only after a verification pass: prod build + route table read +
// curl'd headers + a headless Playwright pass across every public page that
// toggles the parchment/ink theme while watching for
// `securitypolicyviolation` events and console CSP errors — see the CSP
// rollout notes for the run).
//
// This app deliberately does NOT use a STRICT per-request-nonce CSP. It ships
// Partial Prerendering (`cacheComponents` + `partialPrefetching` below), and
// Next's own CSP guidance says nonce-based CSP requires per-request (dynamic)
// rendering everywhere the nonce is baked in: a nonce embedded in a
// statically-cached shell's HTML can never match the *next* request's fresh
// nonce echoed in the response header, so the browser blocks the very script
// the nonce was meant to allow. The one inline script this app ships — the
// pre-paint theme-init script in src/app/layout.tsx's <head> (themeInitScript
// from @/components/ThemeToggle), which stamps data-theme="ink" before first
// paint so the page never flashes the wrong theme — lives in the ROOT layout
// shared by every route, static and dynamic alike. Nonce-ing it would require
// either (a) the root layout reading per-request data (headers()/cookies())
// to bake in a nonce, which would push EVERY route — including static
// marketing pages — off its PPR static shell and onto per-request rendering,
// defeating cacheComponents entirely, or (b) leaving marketing routes with a
// stale build-time nonce that never matches the per-request header, silently
// breaking the theme toggle there. Neither is acceptable, so this policy is
// ENFORCED-RELAXED instead: every non-script directive is locked down tight
// (default-src/object-src/base-uri/frame-ancestors/form-action to 'self' or
// 'none', connect-src/img-src/font-src/frame-src scoped to only the origins
// this app actually talks to), while script-src and style-src keep
// 'unsafe-inline' — covering the theme-init script, any framework-injected
// inline script, and the hundreds of inline `style={{ ... }}` props across
// the brand components (next/font + React also inject un-nonceable <style>
// tags, so style-src needs this regardless). That trades nonce-level script
// provenance for zero risk of breaking the theme toggle or forcing the app
// off static rendering. (For the STRICT hybrid nonce pattern this app
// deliberately does not use — because it fits a non-PPR app, or one whose
// dynamic routes don't share an inline script with static ones — see
// local-seo-agency's / grant-writing-nonprofits's src/lib/auth/csp.ts.)
/** @param {boolean} isDev */
function buildCsp(isDev) {
  // Firebase Auth (signInWithPopup, src/app/login/page.tsx) dynamically
  // injects the gapi loader from apis.google.com (pulling SDK assets from
  // gstatic); without these in script-src the popup dies with
  // auth/internal-error. identitytoolkit/securetoken are the REST endpoints
  // the firebase/auth client SDK calls directly for sign-in + token refresh.
  // The Auth helper iframe (cross-window token relay) lives on the project's
  // authDomain (*.firebaseapp.com) — frame-src only, no connect-src needed for
  // it (it talks over postMessage, not fetch). Firestore is server-only here
  // (firebase-admin via src/lib/db/firestore-store.ts; never imported
  // client-side), so its origin is deliberately absent. Polar checkout
  // (src/app/billing/BundleGrid.tsx) is a full top-level
  // `window.location.assign` redirect to a Polar-hosted page, not a
  // same-page fetch/iframe, so it needs no connect-src/frame-src entry
  // either. Gemini (@google/generative-ai) is called server-side only
  // (src/lib/llm/client.ts). All images/fonts are self-hosted (next/font
  // downloads + self-hosts at build time; icons/og image ship from /public).
  const googleAuth = "https://apis.google.com https://www.gstatic.com";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${googleAuth}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com",
    "frame-src 'self' https://*.firebaseapp.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Burn-in reporting: keep surfacing violations after enforcing. Both
    // report shapes (legacy report-uri + the newer Reporting API's
    // report-to) land on src/app/api/csp-report/route.ts; report-to needs
    // the Reporting-Endpoints response header (in headers(), below) to
    // resolve the "csp" group name to this app's report sink.
    "report-uri /api/csp-report",
    "report-to csp",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const isDev = process.env.NODE_ENV === "development";
const csp = buildCsp(isDev);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 16.3 Instant Navigations: dynamic-by-default rendering + prefetched
  // static shells for instant client navigations.
  cacheComponents: true,
  partialPrefetching: true,
  // Keep the native-ish packages out of the server bundle: firebase-admin has
  // dynamic requires bundlers mishandle, and @electric-sql/pglite ships WASM.
  serverExternalPackages: ["firebase-admin", "@electric-sql/pglite"],
  // Security headers (web-standards audit) — applied to every route,
  // including the CSP above (now ENFORCED, not Report-Only).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Superseded by CSP's frame-ancestors for browsers that honor it,
          // kept for the ones that don't.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The app uses none of these browser features anywhere (verified:
          // no getUserMedia/mediaDevices/geolocation calls; only
          // navigator.clipboard.writeText, which this policy doesn't touch).
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: csp },
          // Reporting API v1 endpoint group backing the CSP's `report-to csp`
          // directive above — burn-in visibility after enforcing. The legacy
          // `report-uri` in the same policy covers browsers that don't
          // support the newer Reporting API; both land on the same sink
          // (src/app/api/csp-report/route.ts).
          { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
        ],
      },
    ];
  },
};
export default nextConfig;
export { buildCsp };
