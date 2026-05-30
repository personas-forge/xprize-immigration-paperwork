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
