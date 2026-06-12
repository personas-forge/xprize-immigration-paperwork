/**
 * EvidenceAdapter (ADR-0010) — the single seam between routes/server-actions and
 * the evidence-vault domain (`src/lib/data/evidence.ts`).
 *
 * The evidence data layer explicitly does NOT enforce ownership ("the route /
 * server actions apply the owner-or-attorney gate before calling in"). This
 * adapter makes that impossible to forget: every method that touches a case
 * gates through the shared {@link resolveCase} first, then performs the vault
 * operation, wrapping store throws into `store_error`.
 *
 * TESTABILITY: the `server-only` data layer is reached via lazy dynamic import
 * in {@link defaultDeps}, never statically, so this loads under `tsx --test`.
 */

import { isConfiguredAttorney } from "@/lib/auth/roles";
import type { StoredDocument } from "@/lib/data/evidence";
import {
  type CaseAccess,
  type CaseGateDeps,
  resolveCase,
} from "./access";
import { type AdapterResult, err, ok } from "./result";

/** Everything the adapter calls, injected so the unit suite can supply fakes. */
export interface EvidenceDeps extends CaseGateDeps {
  addCaseDocument(input: {
    caseId: string;
    name: string;
    criterion: string;
    facts: readonly string[];
    source: string;
    status?: string;
  }): Promise<StoredDocument | null>;
  getCaseDocuments(caseId: string): Promise<readonly StoredDocument[]>;
  removeCaseDocument(caseId: string, documentId: string): Promise<void>;
  refileCaseDocument(
    caseId: string,
    documentId: string,
    criterion: string,
  ): Promise<void>;
}

let cached: EvidenceDeps | null = null;

async function defaultDeps(): Promise<EvidenceDeps> {
  if (cached) return cached;
  const [evidence, petitions, store] = await Promise.all([
    import("@/lib/data/evidence"),
    import("@/lib/data/petitions"),
    import("@/lib/db/store"),
  ]);
  cached = {
    addCaseDocument: evidence.addCaseDocument,
    getCaseDocuments: evidence.getCaseDocuments,
    removeCaseDocument: evidence.removeCaseDocument,
    refileCaseDocument: evidence.refileCaseDocument,
    getCaseForUser: petitions.getCaseForUser,
    getCaseAnyOwner: petitions.getCaseAnyOwner,
    isConfiguredAttorney,
    storeConfigured: async () => (await store.getStore()) !== null,
  };
  return cached;
}

export class EvidenceAdapter {
  constructor(private readonly injected?: EvidenceDeps) {}

  private deps(): Promise<EvidenceDeps> {
    return this.injected ? Promise.resolve(this.injected) : defaultDeps();
  }

  private gate(
    deps: EvidenceDeps,
    access: CaseAccess,
    caseId: string,
  ): Promise<AdapterResult<unknown>> {
    return resolveCase(deps, access, caseId);
  }

  /** Add a document to a case's vault. Gated by case access. */
  async addDocument(
    access: CaseAccess,
    input: {
      caseId: string;
      name: string;
      criterion: string;
      facts: readonly string[];
      source: string;
      status?: string;
    },
  ): Promise<AdapterResult<StoredDocument>> {
    const deps = await this.deps();
    const gate = await this.gate(deps, access, input.caseId);
    if (!gate.ok) return gate;
    try {
      const doc = await deps.addCaseDocument(input);
      return doc ? ok(doc) : err("store_error");
    } catch (cause) {
      return err("store_error", cause);
    }
  }

  /** Every document in a case's vault, exhibit order. Gated. */
  async getDocuments(
    access: CaseAccess,
    caseId: string,
  ): Promise<AdapterResult<readonly StoredDocument[]>> {
    const deps = await this.deps();
    const gate = await this.gate(deps, access, caseId);
    if (!gate.ok) return gate;
    try {
      return ok(await deps.getCaseDocuments(caseId));
    } catch (cause) {
      return err("store_error", cause);
    }
  }

  /** Remove a document from a case's vault. Gated. */
  async removeDocument(
    access: CaseAccess,
    caseId: string,
    documentId: string,
  ): Promise<AdapterResult<void>> {
    const deps = await this.deps();
    const gate = await this.gate(deps, access, caseId);
    if (!gate.ok) return gate;
    try {
      await deps.removeCaseDocument(caseId, documentId);
      return ok(undefined);
    } catch (cause) {
      return err("store_error", cause);
    }
  }

  /** Re-file a document under a different criterion bucket. Gated. */
  async refileDocument(
    access: CaseAccess,
    caseId: string,
    documentId: string,
    criterion: string,
  ): Promise<AdapterResult<void>> {
    const deps = await this.deps();
    const gate = await this.gate(deps, access, caseId);
    if (!gate.ok) return gate;
    try {
      await deps.refileCaseDocument(caseId, documentId, criterion);
      return ok(undefined);
    } catch (cause) {
      return err("store_error", cause);
    }
  }
}

/** Shared singleton for route/action callers that don't inject deps. */
export const evidence = new EvidenceAdapter();
