"use server";

/**
 * Server action — the signed-in user's REAL, persisted petition cases.
 *
 * `getCases()` is consumed by the client case-list view (CaseList.tsx) but must
 * read from the server-only `Store` (Firestore in prod, PGlite locally). A
 * "use server" action bridges that boundary: the client can `await getCases()`
 * with no args; the action derives the user server-side and queries the Store
 * via the owner-scoped PetitionAdapter seam. Graceful degradation is preserved —
 * no auth / no store yields an empty portfolio (the keyless demo shows no cases).
 */
import { getUser } from "@/lib/auth/session";
import { petitions } from "@/lib/data/adapters/petition";
import { CASE_STATUSES, VISA_CLASSIFICATIONS, type PetitionCase, type VisaClassification } from "@/features/case-file/types";

function asClassification(value: string): VisaClassification {
  return (VISA_CLASSIFICATIONS as readonly string[]).includes(value)
    ? (value as VisaClassification)
    : "O-1A";
}

/** Every petition case the signed-in user owns. Empty when no auth / no store. */
export async function getCases(): Promise<readonly PetitionCase[]> {
  const user = await getUser();
  if (!user) return [];
  const owned = await petitions.listOwnedCases({ userId: user.id, email: user.email ?? null });
  const stored = owned.ok ? owned.value : [];
  return stored.map(
    (c): PetitionCase => ({
      id: c.id,
      fileNumber: c.fileNumber,
      petitioner: c.petitioner,
      classification: asClassification(c.classification),
      // Persisted cases don't carry a target-file date / attorney yet; the UI
      // tolerates blanks (sort/filter treat them as unset).
      status: (CASE_STATUSES as readonly string[]).includes(c.status as string)
        ? (c.status as PetitionCase["status"])
        : "Intake",
      approvalLikelihood: c.approvalLikelihood,
      targetFileDate: "",
      attorney: "",
    }),
  );
}
