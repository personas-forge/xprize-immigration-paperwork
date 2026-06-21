/**
 * Attorney-of-record role check for the review/filing workflow.
 *
 * Pure and env-injectable, so it stays unit-testable and the server actions/pages
 * can gate on it. Demo unlock: when ATTORNEY_EMAILS is unset/empty, every
 * signed-in user is treated as an attorney so the workflow is usable in the
 * keyless/dev demo — but ONLY OUTSIDE production. In production an empty allowlist
 * FAILS CLOSED (denies + warns), exactly like {@link isConfiguredAttorney}: an
 * unconfigured prod deploy must not silently make every applicant the attorney of
 * record (a fail-open authorization for the sign/file affordances). Cross-tenant
 * DATA gates must still use `isConfiguredAttorney`, never this — this is the UI
 * affordance check with defense-in-depth so the permissive twin can't reopen the
 * IDOR class even if a future call site reaches for it by autocomplete.
 */

export function attorneyAllowlist(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return (env.ATTORNEY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

let warnedUnconfiguredAttorneyProd = false;

export function isAttorney(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const list = attorneyAllowlist(env);
  if (list.length === 0) {
    // Demo unlock is dev-only. In production, an empty allowlist denies (fail
    // closed) and warns ONCE so the misconfiguration is loud, not invisible.
    if (env.NODE_ENV === "production") {
      if (!warnedUnconfiguredAttorneyProd) {
        warnedUnconfiguredAttorneyProd = true;
        console.error(
          "[roles] ATTORNEY_EMAILS is empty in production — attorney affordances " +
            "are DENIED for everyone (fail-closed). Set ATTORNEY_EMAILS to the " +
            "licensed counsel allowlist to enable the review/filing workflow.",
        );
      }
      return false;
    }
    return true; // dev/demo unlock
  }
  return typeof email === "string" && list.includes(email.toLowerCase());
}

/**
 * STRICT attorney check — no demo unlock. Returns true ONLY when ATTORNEY_EMAILS
 * is configured AND lists this email. Unlike `isAttorney`, an empty allowlist
 * denies everyone.
 *
 * Use this — never `isAttorney` — to gate access to ANOTHER user's case data
 * (e.g. `getCaseAnyOwner`). `isAttorney`'s permissive default is fine for
 * UI-level affordances in the demo, but using it to authorize cross-tenant reads
 * means every signed-in user can pull any applicant's PII by guessing a caseId.
 * Cross-tenant data access must fail closed until counsel is explicitly allow-listed.
 */
export function isConfiguredAttorney(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const list = attorneyAllowlist(env);
  if (list.length === 0) return false; // unconfigured → deny (fail closed)
  return typeof email === "string" && list.includes(email.toLowerCase());
}

// — Read-only ops / case-manager role ─────────────────────────────────────────

export function opsAllowlist(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return (env.OPS_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * STRICT read-only ops / case-manager check — fail-closed, exactly like
 * {@link isConfiguredAttorney}. An ops user may VIEW the cross-tenant SLA review
 * queue (to manage age/SLAs) but NEVER sign, file, or request changes — every
 * write stays `isConfiguredAttorney`. Empty `OPS_EMAILS` → deny everyone (an ops
 * grant is a cross-tenant PII read, so it must be explicit, never demo-unlocked).
 */
export function isConfiguredOps(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const list = opsAllowlist(env);
  if (list.length === 0) return false; // unconfigured → deny (fail closed)
  return typeof email === "string" && list.includes(email.toLowerCase());
}

/**
 * May VIEW the cross-tenant review-queue board: the attorney of record OR a
 * read-only ops/case-manager. WRITES (sign / file / request-changes) remain
 * `isConfiguredAttorney`-only — this is strictly a read gate.
 */
export function canReviewQueue(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isConfiguredAttorney(email, env) || isConfiguredOps(email, env);
}
