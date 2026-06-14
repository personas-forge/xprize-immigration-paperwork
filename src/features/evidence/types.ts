/**
 * Server-free evidence-vault types.
 *
 * `StoredDocument` is the one shape for a categorized vault document, shared by
 * the server-only data layer (`@/lib/data/evidence`) and the client
 * `EvidenceVault` component (which can't import the server-only module). The
 * `server-only` boundary lives on the accessor FUNCTIONS, not on this type — so
 * the shape isn't re-declared per side.
 */
export interface StoredDocument {
  id: string;
  name: string;
  criterion: string;
  exhibit: string;
  status: string;
  facts: string[];
  source: string;
}
