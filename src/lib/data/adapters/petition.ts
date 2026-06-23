/**
 * PetitionAdapter (ADR-0010) — the single seam between routes/server-actions and
 * the petition domain (`src/lib/data/petitions.ts`).
 *
 * Wraps the existing module-level data functions (it does NOT re-plumb the
 * `Store`) and adds the three contracts the function layer lacks: every method
 * returns an {@link AdapterResult} (never a bare nullable, never throws), every
 * case-scoped method gates through the single {@link resolveCase} first, and
 * every store call is caught into `store_error`.
 *
 * TESTABILITY: like `operation.ts`, the `server-only` data layer is reached via
 * lazy dynamic import in {@link defaultDeps}, never a static top-level import, so
 * this module loads under `tsx --test` and the suite injects fakes.
 */

import { isConfiguredAttorney, isConfiguredOps } from "@/lib/auth/roles";
import type {
  CreatedCase,
  CriterionInput,
  DraftSectionRow,
  StoredCase,
  StoredCriterion,
  StoredDraft,
} from "@/lib/data/petitions";
import {
  type CaseAccess,
  type CaseGateDeps,
  makeCached,
  resolveCase,
  storeConfigured,
} from "./access";
import { type AdapterResult, err, ok, wrapStore } from "./result";

/** Everything the adapter calls, injected so the unit suite can supply fakes. */
export interface PetitionDeps extends CaseGateDeps {
  /** Every case a user OWNS (owner-scoped list). */
  getCasesForUser(userId: string): Promise<readonly StoredCase[]>;
  /** Every case awaiting attorney review — CROSS-TENANT; gated in the adapter. */
  getCasesInReview(): Promise<readonly StoredCase[]>;
  /** Read-only ops/case-manager allow-list check (queue VIEW co-gate). */
  isConfiguredOps(email: string | null | undefined): boolean;
  createCaseWithCriteria(input: {
    userId: string;
    petitioner: string;
    classification?: string;
    approvalLikelihood: number;
    criteria: readonly CriterionInput[];
  }): Promise<CreatedCase | null>;
  getCriteriaForCase(caseId: string): Promise<readonly StoredCriterion[]>;
  saveDraft(
    caseId: string,
    sections: readonly DraftSectionRow[],
    source: string,
  ): Promise<number | null>;
  getLatestDraft(caseId: string): Promise<StoredDraft | null>;
  saveRfeResponse(
    caseId: string,
    rfeText: string,
    sections: readonly DraftSectionRow[],
    source: string,
  ): Promise<number | null>;
}

const defaultDeps = makeCached<PetitionDeps>(async () => {
  const data = await import("@/lib/data/petitions");
  return {
    getCaseForUser: data.getCaseForUser,
    getCaseAnyOwner: data.getCaseAnyOwner,
    getCasesForUser: data.getCasesForUser,
    getCasesInReview: data.getCasesInReview,
    createCaseWithCriteria: data.createCaseWithCriteria,
    getCriteriaForCase: data.getCriteriaForCase,
    saveDraft: data.saveDraft,
    getLatestDraft: data.getLatestDraft,
    saveRfeResponse: data.saveRfeResponse,
    isConfiguredAttorney,
    isConfiguredOps,
    storeConfigured,
  };
});

export class PetitionAdapter {
  constructor(private readonly injected?: PetitionDeps) {}

  private deps(): Promise<PetitionDeps> {
    return this.injected ? Promise.resolve(this.injected) : defaultDeps();
  }

  /** Owner-or-attorney case resolution, fail-closed. The single gate. */
  async resolveCase(
    access: CaseAccess,
    caseId: string,
  ): Promise<AdapterResult<StoredCase>> {
    return resolveCase(await this.deps(), access, caseId);
  }

  /**
   * Owner-only check: is `userId` the OWNER of `caseId`? Resolves with
   * `email: null` so the configured-attorney cross-tenant fallback never fires —
   * the single home for the `email: null ⇒ owner-only` trick the review actions
   * and case-detail page used to each re-express inline. Fail-closed: any non-ok
   * resolve (forbidden / not_found / unconfigured / store_error) ⇒ not owner.
   */
  async isCaseOwner(userId: string, caseId: string): Promise<boolean> {
    return (await this.resolveCase({ userId, email: null }, caseId)).ok;
  }

  /**
   * Every case the caller OWNS, newest first. Owner-scoped list analogue of
   * `getCaseForUser` — fail-closed when there's no user id. A no-store build
   * degrades to an empty list (ok([])), matching the single-case read.
   */
  async listOwnedCases(
    access: CaseAccess,
  ): Promise<AdapterResult<readonly StoredCase[]>> {
    if (!access.userId) return err("forbidden");
    const userId = access.userId;
    const deps = await this.deps();
    return wrapStore(() => deps.getCasesForUser(userId));
  }

  /**
   * The CROSS-TENANT attorney/ops review queue (every applicant's case awaiting
   * review). The IDOR gate lives HERE, not at the call site (ADR-0010's whole
   * promise): fail-closed unless the caller is a configured attorney OR a
   * read-only ops/case-manager. A second review surface can never forget the
   * `canView` line now — it's enforced inside the seam.
   */
  async listReviewQueue(
    access: CaseAccess,
  ): Promise<AdapterResult<readonly StoredCase[]>> {
    const deps = await this.deps();
    const allowed =
      deps.isConfiguredAttorney(access.email) || deps.isConfiguredOps(access.email);
    if (!allowed) return err("forbidden");
    return wrapStore(() => deps.getCasesInReview());
  }

  /** Persist a qualification as a new owned case + criteria. */
  async createCase(
    access: CaseAccess,
    input: {
      petitioner: string;
      classification?: string;
      approvalLikelihood: number;
      criteria: readonly CriterionInput[];
    },
  ): Promise<AdapterResult<CreatedCase>> {
    if (!access.userId) return err("forbidden");
    const deps = await this.deps();
    if (!(await deps.storeConfigured())) return err("unconfigured");
    try {
      const created = await deps.createCaseWithCriteria({
        userId: access.userId,
        ...input,
      });
      // Store is configured yet the write produced nothing: treat as a store
      // fault. Attach a descriptive cause so the adapter's `store_error` log
      // carries context instead of a useless `undefined` (a null-write and a real
      // backend throw must be distinguishable in ops).
      return created
        ? ok(created)
        : err(
            "store_error",
            new Error("createCaseWithCriteria returned null despite a configured store"),
          );
    } catch (cause) {
      return err("store_error", cause);
    }
  }

  /** Scored criteria for a case the caller may access. */
  async getCriteria(
    access: CaseAccess,
    caseId: string,
  ): Promise<AdapterResult<readonly StoredCriterion[]>> {
    const gate = await this.resolveCase(access, caseId);
    if (!gate.ok) return gate;
    const deps = await this.deps();
    return wrapStore(() => deps.getCriteriaForCase(caseId));
  }

  /** Persist a petition draft as a new version. Gated. Returns the version. */
  async saveDraft(
    access: CaseAccess,
    caseId: string,
    sections: readonly DraftSectionRow[],
    source: string,
  ): Promise<AdapterResult<number>> {
    const gate = await this.resolveCase(access, caseId);
    if (!gate.ok) return gate;
    const deps = await this.deps();
    try {
      const version = await deps.saveDraft(caseId, sections, source);
      return version === null ? err("unconfigured") : ok(version);
    } catch (cause) {
      return err("store_error", cause);
    }
  }

  /** The latest draft for a case (`null` = none yet — still a success). Gated. */
  async getLatestDraft(
    access: CaseAccess,
    caseId: string,
  ): Promise<AdapterResult<StoredDraft | null>> {
    const gate = await this.resolveCase(access, caseId);
    if (!gate.ok) return gate;
    const deps = await this.deps();
    return wrapStore(() => deps.getLatestDraft(caseId));
  }

  /** Persist an RFE response as a new version. Gated. Returns the version. */
  async saveRfeResponse(
    access: CaseAccess,
    caseId: string,
    rfeText: string,
    sections: readonly DraftSectionRow[],
    source: string,
  ): Promise<AdapterResult<number>> {
    const gate = await this.resolveCase(access, caseId);
    if (!gate.ok) return gate;
    const deps = await this.deps();
    try {
      const version = await deps.saveRfeResponse(
        caseId,
        rfeText,
        sections,
        source,
      );
      return version === null ? err("unconfigured") : ok(version);
    } catch (cause) {
      return err("store_error", cause);
    }
  }

}

/** Shared singleton for route/action callers that don't inject deps. */
export const petitions = new PetitionAdapter();
