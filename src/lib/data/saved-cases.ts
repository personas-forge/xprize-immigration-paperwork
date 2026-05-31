"use server";

/**
 * Server action — the signed-in user's REAL, persisted petition cases.
 *
 * `getCases()` is consumed by the client case-list view (CaseList.tsx) but must
 * read from the server-only `Store` (Firestore in prod, PGlite locally). A
 * "use server" action bridges that boundary: the client can `await getCases()`
 * with no args; the action derives the user server-side and queries the Store
 * via `getCasesForUser`. Graceful degradation is preserved — no auth / no store
 * yields an empty portfolio (the keyless demo simply shows no saved cases).
 */
import { getUser } from "@/lib/auth/session";
import { getCasesForUser } from "@/lib/data/petitions";
import { type PetitionCase, type VisaClassification } from "@/features/case-file/types";

const CLASSIFICATIONS: readonly VisaClassification[] = ["O-1A", "O-1B", "EB-1A"];

function asClassification(value: string): VisaClassification {
  return (CLASSIFICATIONS as readonly string[]).includes(value)
    ? (value as VisaClassification)
    : "O-1A";
}

/** Every petition case the signed-in user owns. Empty when no auth / no store. */
export async function getCases(): Promise<readonly PetitionCase[]> {
  const user = await getUser();
  if (!user) return [];
  const stored = await getCasesForUser(user.id);
  return stored.map(
    (c): PetitionCase => ({
      id: c.id,
      fileNumber: c.fileNumber,
      petitioner: c.petitioner,
      classification: asClassification(c.classification),
      // Persisted cases don't carry a target-file date / attorney yet; the UI
      // tolerates blanks (sort/filter treat them as unset).
      status: (["Intake", "Drafting", "Attorney Review", "Filed", "Approved"] as const).includes(
        c.status as never,
      )
        ? (c.status as PetitionCase["status"])
        : "Intake",
      approvalLikelihood: c.approvalLikelihood,
      targetFileDate: "",
      attorney: "",
    }),
  );
}
