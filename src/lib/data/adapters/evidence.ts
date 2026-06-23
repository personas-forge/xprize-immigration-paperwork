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
import type { StoredCase } from "@/lib/data/petitions";
import {
  type CaseAccess,
  type CaseGateDeps,
  makeCached,
  resolveCase,
  storeConfigured,
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
  removeCaseDocument(
    caseId: string,
    documentId: string,
    deletedBy?: string | null,
  ): Promise<boolean>;
  restoreCaseDocument(caseId: string, documentId: string): Promise<boolean>;
  refileCaseDocument(
    caseId: string,
    documentId: string,
    criterion: string,
  ): Promise<boolean>;
}

const defaultDeps = makeCached<EvidenceDeps>(async () => {
  const [evidence, petitions] = await Promise.all([
    import("@/lib/data/evidence"),
    import("@/lib/data/petitions"),
  ]);
  return {
    addCaseDocument: evidence.addCaseDocument,
    getCaseDocuments: evidence.getCaseDocuments,
    removeCaseDocument: evidence.removeCaseDocument,
    restoreCaseDocument: evidence.restoreCaseDocument,
    refileCaseDocument: evidence.refileCaseDocument,
    getCaseForUser: petitions.getCaseForUser,
    getCaseAnyOwner: petitions.getCaseAnyOwner,
    isConfiguredAttorney,
    storeConfigured,
  };
});

export class EvidenceAdapter {
  constructor(private readonly injected?: EvidenceDeps) {}

  private deps(): Promise<EvidenceDeps> {
    return this.injected ? Promise.resolve(this.injected) : defaultDeps();
  }

  private gate(
    deps: EvidenceDeps,
    access: CaseAccess,
    caseId: string,
  ): Promise<AdapterResult<StoredCase>> {
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
      if (doc) return ok(doc);
      // `addCaseDocument` returns null ONLY when no store is configured (a no-op);
      // a real store FAULT throws (caught below). Map the no-store case to
      // `unconfigured` (503 "temporarily unavailable") to match petition.saveDraft
      // — NOT `store_error` (500), which alarms ops and tells anxious users it's a
      // non-retryable internal error.
      return (await deps.storeConfigured()) ? err("store_error") : err("unconfigured");
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

  /** SOFT-delete a document from a case's vault (recoverable via
   *  {@link restoreDocument}). Gated; records the remover for the audit trail. */
  async removeDocument(
    access: CaseAccess,
    caseId: string,
    documentId: string,
  ): Promise<AdapterResult<void>> {
    const deps = await this.deps();
    const gate = await this.gate(deps, access, caseId);
    if (!gate.ok) return gate;
    try {
      // false = no LIVE row matched (wrong case / already-removed id) → report
      // not_found instead of a false success on a mutation that changed nothing.
      const removed = await deps.removeCaseDocument(caseId, documentId, access.userId);
      return removed ? ok(undefined) : err("not_found");
    } catch (cause) {
      return err("store_error", cause);
    }
  }

  /** Restore a soft-deleted document (keeps its original exhibit ordinal). Gated.
   *  not_found when there's no matching deleted document. */
  async restoreDocument(
    access: CaseAccess,
    caseId: string,
    documentId: string,
  ): Promise<AdapterResult<void>> {
    const deps = await this.deps();
    const gate = await this.gate(deps, access, caseId);
    if (!gate.ok) return gate;
    try {
      const restored = await deps.restoreCaseDocument(caseId, documentId);
      return restored ? ok(undefined) : err("not_found");
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
      const refiled = await deps.refileCaseDocument(caseId, documentId, criterion);
      return refiled ? ok(undefined) : err("not_found");
    } catch (cause) {
      return err("store_error", cause);
    }
  }
}

/** Shared singleton for route/action callers that don't inject deps. */
export const evidence = new EvidenceAdapter();
