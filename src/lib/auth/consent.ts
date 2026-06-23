// First-auth consent versioning. Provider-agnostic (Firebase / dev-auth). Kept
// client-safe — a NEXT_PUBLIC_* var and no `server-only` import — so it remains
// client-importable. Readers today: the welcome page + action and the session gate.
//
// COMPLIANCE KEYSTONE: the re-consent gate (requireOnboardedUser / the welcome
// page) re-prompts a user whenever their stored consent version !== CONSENT_VERSION.
// Treat the version as a RELEASE ARTIFACT, not an ad-hoc string: every change to
// the terms/privacy copy MUST append a new entry to CONSENT_VERSIONS below, and
// the value must be identical across all instances of a deploy. A missed bump
// silently leaves users operating under terms they never re-accepted — a wrong
// compliance outcome invisible until a regulator or opposing counsel asks.

/**
 * Ordered history of published consent-copy versions, OLDEST → NEWEST. Append a
 * new entry whenever the terms/privacy copy changes; tie each entry to the copy
 * commit in its comment. The LAST entry is the live {@link CONSENT_VERSION}.
 *
 *  - "2026-05-29" — initial published Terms of Service + Privacy Policy
 *    (UPL / not-legal-advice consent).
 */
export const CONSENT_VERSIONS = ["2026-05-29"] as const;

export type ConsentVersion = (typeof CONSENT_VERSIONS)[number];

/** FormData field names for the consent form — the untyped client↔server seam.
 *  Both the <ConsentForm> inputs and the `submitConsent` action read keys from
 *  here, so a rename can't silently drop a consent value (the contract was kept
 *  by matching string literals + a prose comment before). */
export const CONSENT_FIELDS = {
  fullName: "full_name",
  terms: "terms",
  privacy: "privacy",
  marketing: "marketing",
} as const;

/** True when `v` is a known, published consent version. Pure + exported so the
 *  membership invariant is unit-testable. */
export function isKnownConsentVersion(v: string | undefined | null): v is ConsentVersion {
  return typeof v === "string" && (CONSENT_VERSIONS as readonly string[]).includes(v);
}

/** Resolve the live consent version: the env override when it is a KNOWN version,
 *  else the newest entry. An override outside the recorded history is a
 *  misconfiguration (a typo, or a copy change that forgot to append a version) —
 *  honoring it would re-prompt every user or assert a version nobody's copy
 *  matches — so we reject it loudly and fall back to the known latest. */
function resolveConsentVersion(
  env: Record<string, string | undefined> = process.env,
): string {
  const latest = CONSENT_VERSIONS[CONSENT_VERSIONS.length - 1];
  const override = env.NEXT_PUBLIC_CONSENT_VERSION?.trim();
  if (!override) return latest;
  if (isKnownConsentVersion(override)) return override;
  console.error(
    `[consent] NEXT_PUBLIC_CONSENT_VERSION="${override}" is not in CONSENT_VERSIONS ` +
      `(${CONSENT_VERSIONS.join(", ")}). Append it when the consent copy changes. ` +
      `Falling back to "${latest}".`,
  );
  return latest;
}

/** Bump by appending to CONSENT_VERSIONS when consent copy changes; recorded
 *  against each consent row and compared by the onboarding gate. */
export const CONSENT_VERSION: string = resolveConsentVersion();

/** True when a profile has finished onboarding AND its recorded consent version
 *  matches the live {@link CONSENT_VERSION}. The ONE predicate the re-consent
 *  gate is built on (`requireOnboardedUser` and the welcome page), so the two
 *  can't drift to opposite-polarity hand-rolled copies of the same invariant. */
export function isFullyConsented(
  profile: { onboarded_at?: string | null } | null | undefined,
  consentedVersion: string | null | undefined,
): boolean {
  return Boolean(profile?.onboarded_at) && consentedVersion === CONSENT_VERSION;
}
