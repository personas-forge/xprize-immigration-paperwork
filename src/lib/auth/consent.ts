// First-auth consent versioning. Provider-agnostic (Firebase / dev-auth) — read
// on both client and server, so it relies only on a NEXT_PUBLIC_* var and uses
// no `server-only` import.

/** Bump when consent copy changes; recorded against each consent row. */
export const CONSENT_VERSION =
  process.env.NEXT_PUBLIC_CONSENT_VERSION ?? "2026-05-29";
