import "server-only";

/**
 * Data layer — the evidence vault (per-case documents).
 *
 * Each document is AI-categorized into an O-1A criterion (or 'Unsorted') and
 * gets a monotonic exhibit number on insert (never reused, so deleting a
 * document doesn't renumber the surviving exhibits). Same graceful-degradation
 * contract as the rest of the data layer: every function no-ops without a DB.
 *
 * Ownership is NOT enforced here — the route / server actions apply the
 * owner-or-attorney gate before calling in.
 */
import { appPool, S } from "@/lib/db/pool";

export interface StoredDocument {
  id: string;
  name: string;
  criterion: string;
  exhibit: string;
  status: string;
  facts: string[];
  source: string;
}

interface DocumentRow {
  id: string;
  name: string;
  criterion: string;
  exhibit: string;
  status: string;
  facts: string[];
  source: string;
}

function toStoredDocument(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    name: row.name,
    criterion: row.criterion,
    exhibit: row.exhibit,
    status: row.status,
    facts: Array.isArray(row.facts) ? row.facts : [],
    source: row.source,
  };
}

/**
 * Add a document to a case's vault, assigning the next exhibit number in one
 * transaction. Returns the stored document, or `null` when no DB.
 */
export async function addCaseDocument(input: {
  caseId: string;
  name: string;
  criterion: string;
  facts: readonly string[];
  source: string;
  status?: string;
}): Promise<StoredDocument | null> {
  const p = appPool();
  if (!p) return null;
  const c = await p.connect();
  try {
    await c.query("begin");
    const o = await c.query<{ next: number }>(
      `select coalesce(max(ord), 0) + 1 as next
         from ${S}.case_documents where case_id = $1`,
      [input.caseId],
    );
    const ord = o.rows[0]?.next ?? 1;
    const exhibit = `Ex. ${ord}`;
    const r = await c.query<DocumentRow>(
      `insert into ${S}.case_documents
         (case_id, name, criterion, ord, exhibit, status, facts, source)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, name, criterion, exhibit, status, facts, source`,
      [
        input.caseId,
        input.name,
        input.criterion,
        ord,
        exhibit,
        input.status ?? "Received",
        JSON.stringify([...input.facts]),
        input.source,
      ],
    );
    await c.query("commit");
    return toStoredDocument(r.rows[0]);
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

/** Every document in a case's vault, by exhibit order. Empty when no DB. */
export async function getCaseDocuments(
  caseId: string,
): Promise<readonly StoredDocument[]> {
  const p = appPool();
  if (!p) return [];
  const r = await p.query<DocumentRow>(
    `select id, name, criterion, exhibit, status, facts, source
       from ${S}.case_documents
      where case_id = $1
      order by ord asc`,
    [caseId],
  );
  return r.rows.map(toStoredDocument);
}

/** Remove a document from a case's vault. No-op when no DB. */
export async function removeCaseDocument(
  caseId: string,
  documentId: string,
): Promise<void> {
  const p = appPool();
  if (!p) return;
  await p.query(
    `delete from ${S}.case_documents where id = $1 and case_id = $2`,
    [documentId, caseId],
  );
}

/** Re-file a document under a different criterion bucket. No-op when no DB. */
export async function refileCaseDocument(
  caseId: string,
  documentId: string,
  criterion: string,
): Promise<void> {
  const p = appPool();
  if (!p) return;
  await p.query(
    `update ${S}.case_documents set criterion = $3 where id = $1 and case_id = $2`,
    [documentId, caseId, criterion],
  );
}
