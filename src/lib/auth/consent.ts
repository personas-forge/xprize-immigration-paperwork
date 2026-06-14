// First-auth consent versioning. Provider-agnostic (Firebase / dev-auth). Kept
// client-safe — a NEXT_PUBLIC_* var and no `server-only` import — so it stays
// importable from a client component if a consent banner ever needs the version.
// Today the only readers are server-side (the welcome action + session).

/** Bump when consent copy changes; recorded against each consent row. */
export const CONSENT_VERSION =
  process.env.NEXT_PUBLIC_CONSENT_VERSION ?? "2026-05-29";
