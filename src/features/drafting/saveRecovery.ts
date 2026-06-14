/**
 * saveFailed recovery helpers (pure, client-safe).
 *
 * When /api/draft charges + generates but version persistence fails, the
 * response carries `saveFailed: true` and the user is holding work product
 * that exists only in component state. These helpers power the recovery UI:
 * copy the draft out, or retry the save against /api/draft/save (a no-charge,
 * persistence-only endpoint — never a re-generate, which would bill again).
 *
 * No `server-only`, no Node built-ins — imported by the client component AND
 * by the save route (the request parser), and unit-tested under `tsx --test`
 * with an injected fetch.
 */

import { type DraftSection, toSection } from "./drafting";
import { asModelSource, type ModelSource } from "@/lib/llm/label";

/** The exact copy the recovery alert shows — asserted by the component tests. */
export const SAVE_FAILED_MESSAGE =
  "Draft generated but not saved — copy it now or retry saving";

/** Body for POST /api/draft/save. */
export interface SaveDraftRequest {
  caseId: string;
  sections: DraftSection[];
  source: ModelSource;
}

/** Plain-text rendering of the draft for the clipboard: heading, blank line,
 *  body, separated by rules — readable when pasted into any editor. */
export function draftClipboardText(sections: readonly DraftSection[]): string {
  return sections
    .map((s) => `${s.heading}\n\n${s.body}`)
    .join("\n\n---\n\n");
}

/**
 * Copy the draft to the clipboard. `writeText` is injectable for tests; the
 * default binds `navigator.clipboard` at call time (it doesn't exist under
 * the test runner, and may be denied in the browser — both report `false`
 * so the UI can tell the user the copy did NOT happen).
 */
export async function copyDraftToClipboard(
  sections: readonly DraftSection[],
  writeText?: (text: string) => Promise<void>,
): Promise<boolean> {
  const write =
    writeText ??
    (typeof navigator !== "undefined" && navigator.clipboard
      ? navigator.clipboard.writeText.bind(navigator.clipboard)
      : undefined);
  if (!write) return false;
  try {
    await write(draftClipboardText(sections));
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a /api/draft/save body. Strict on shape (caseId + at least one
 * usable section) but lenient on `source` — an unknown source persists as
 * "mock" rather than rejecting a paid draft the user is trying to rescue.
 */
export function parseSaveDraftRequest(
  body: unknown,
): { ok: true; value: SaveDraftRequest } | { ok: false; error: string } {
  const record = (body ?? {}) as Record<string, unknown>;
  const caseId = typeof record.caseId === "string" ? record.caseId.trim() : "";
  if (caseId === "") {
    return { ok: false, error: "caseId is required." };
  }
  const raw = Array.isArray(record.sections) ? record.sections : [];
  const sections = raw.map(toSection).filter((s): s is DraftSection => s !== null);
  if (sections.length === 0) {
    return { ok: false, error: "sections must contain at least one heading/body pair." };
  }
  const source: ModelSource = asModelSource(record.source);
  return { ok: true, value: { caseId, sections, source } };
}

export type RetrySaveResult =
  | { ok: true; version: number | null }
  | { ok: false; error: string };

/**
 * Re-attempt version persistence for an already-generated draft. Costs no
 * tokens. `fetchImpl` is injectable so success/failure paths are unit-testable
 * without a DOM or network.
 */
export async function retrySaveDraft(
  payload: SaveDraftRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<RetrySaveResult> {
  try {
    const res = await fetchImpl("/api/draft/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as
      | { version?: number | null; error?: string }
      | null;
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error ?? "Saving failed again — please try once more.",
      };
    }
    return { ok: true, version: data?.version ?? null };
  } catch {
    return { ok: false, error: "Network error — the draft is still unsaved." };
  }
}
