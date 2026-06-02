/**
 * Attorney-of-record role check for the review/filing workflow.
 *
 * Pure and env-injectable (like `isMeteringBypassed`), so it stays unit-
 * testable and the server actions/pages can gate on it. Graceful default: when
 * ATTORNEY_EMAILS is unset/empty, EVERY signed-in user is treated as an
 * attorney — this unlocks the workflow for the keyless/dev demo. Set the
 * allowlist in production to restrict sign-off and filing to licensed counsel.
 */

export function attorneyAllowlist(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return (env.ATTORNEY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAttorney(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const list = attorneyAllowlist(env);
  if (list.length === 0) return true; // unconfigured → demo unlock
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
