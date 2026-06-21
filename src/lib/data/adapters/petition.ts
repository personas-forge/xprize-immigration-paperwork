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

import { isConfiguredAttorney } from "@/lib/auth/roles";
import type {
  CreatedCase,
  CriterionInput,
  DraftSectionRow,
  StoredCase,
  StoredCriterion,
  StoredDraft,
  StoredRfe,
} from "@/lib/data/petitions";
import {
  type CaseAccess,
  type CaseGateDeps,
  resolveCase,
} from "./access";
import { type AdapterResult, err, ok } from "./result";

/** Everything the adapter calls, injected so the unit suite can supply fakes. */
export interface PetitionDeps extends CaseGateDeps {
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
  getLatestRfeResponse(caseId: string): Promise<StoredRfe | null>;
}

let cached: PetitionDeps | null = null;

async function defaultDeps(): Promise<PetitionDeps> {
  if (cached) return cached;
  const [data, store] = await Promise.all([
    import("@/lib/data/petitions"),
    import("@/lib/db/store"),
  ]);
  cached = {
    getCaseForUser: data.getCaseForUser,
    getCaseAnyOwner: data.getCaseAnyOwner,
    createCaseWithCriteria: data.createCaseWithCriteria,
    getCriteriaForCase: data.getCriteriaForCase,
    saveDraft: data.saveDraft,
    getLatestDraft: data.getLatestDraft,
    saveRfeResponse: data.saveRfeResponse,
    getLatestRfeResponse: data.getLatestRfeResponse,
    isConfiguredAttorney,
    storeConfigured: async () => (await store.getStore()) !== null,
  };
  return cached;
}

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
    try {
      return ok(await deps.getCriteriaForCase(caseId));
    } catch (cause) {
      return err("store_error", cause);
    }
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
    try {
      return ok(await deps.getLatestDraft(caseId));
    } catch (cause) {
      return err("store_error", cause);
    }
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

  /** The latest RFE response (`null` = none yet — still a success). Gated. */
  async getLatestRfeResponse(
    access: CaseAccess,
    caseId: string,
  ): Promise<AdapterResult<StoredRfe | null>> {
    const gate = await this.resolveCase(access, caseId);
    if (!gate.ok) return gate;
    const deps = await this.deps();
    try {
      return ok(await deps.getLatestRfeResponse(caseId));
    } catch (cause) {
      return err("store_error", cause);
    }
  }
}

/** Shared singleton for route/action callers that don't inject deps. */
export const petitions = new PetitionAdapter();
