import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SAVE_FAILED_MESSAGE,
  copyDraftToClipboard,
  draftClipboardText,
  parseSaveDraftRequest,
  retrySaveDraft,
} from "./saveRecovery";
import { SaveFailedAlert, type CopyState, type RetryState } from "./components/SaveFailedAlert";

const SECTIONS = [
  { heading: "Introduction", body: "The beneficiary is extraordinary." },
  { heading: "Awards", body: "Documented national prize." },
];

// — clipboard text + copy action ─────────────────────────────────────────────

test("draftClipboardText renders heading/body pairs separated by rules", () => {
  const text = draftClipboardText(SECTIONS);
  assert.equal(
    text,
    "Introduction\n\nThe beneficiary is extraordinary.\n\n---\n\nAwards\n\nDocumented national prize.",
  );
});

test("copyDraftToClipboard resolves true and writes the full draft", async () => {
  let written: string | null = null;
  const ok = await copyDraftToClipboard(SECTIONS, async (t) => {
    written = t;
  });
  assert.equal(ok, true);
  assert.equal(written, draftClipboardText(SECTIONS));
});

test("copyDraftToClipboard resolves false when the writer rejects", async () => {
  const ok = await copyDraftToClipboard(SECTIONS, async () => {
    throw new Error("denied");
  });
  assert.equal(ok, false);
});

test("copyDraftToClipboard resolves false with no clipboard available", async () => {
  // No injected writer and no `navigator` under node:test — the UI must be
  // told the copy did NOT happen rather than showing a false "Copied".
  assert.equal(await copyDraftToClipboard(SECTIONS), false);
});

// — retry-save action (success / failure) ────────────────────────────────────

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    assert.equal(url, "/api/draft/save");
    assert.equal(init?.method, "POST");
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
}

test("retrySaveDraft returns ok + version when the save endpoint succeeds", async () => {
  const result = await retrySaveDraft(
    { caseId: "case-1", sections: SECTIONS, source: "gemini" },
    fakeFetch(200, { caseId: "case-1", version: 4 }),
  );
  assert.deepEqual(result, { ok: true, version: 4 });
});

test("retrySaveDraft surfaces the server error on a non-2xx response", async () => {
  const result = await retrySaveDraft(
    { caseId: "case-1", sections: SECTIONS, source: "mock" },
    fakeFetch(500, { error: "A storage error occurred. Please try again." }),
  );
  assert.deepEqual(result, {
    ok: false,
    error: "A storage error occurred. Please try again.",
  });
});

test("retrySaveDraft fails closed when fetch itself rejects", async () => {
  const result = await retrySaveDraft(
    { caseId: "case-1", sections: SECTIONS, source: "mock" },
    (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch,
  );
  assert.equal(result.ok, false);
});

// — save-route request parsing ───────────────────────────────────────────────

test("parseSaveDraftRequest accepts a valid body and normalizes source", () => {
  const parsed = parseSaveDraftRequest({
    caseId: " case-1 ",
    sections: SECTIONS,
    source: "not-a-model",
  });
  assert.ok(parsed.ok);
  assert.equal(parsed.value.caseId, "case-1");
  assert.equal(parsed.value.sections.length, 2);
  // Unknown source persists as "mock" — never reject a rescue over a label.
  assert.equal(parsed.value.source, "mock");
});

test("parseSaveDraftRequest rejects a missing caseId and empty sections", () => {
  assert.equal(parseSaveDraftRequest({ sections: SECTIONS }).ok, false);
  assert.equal(
    parseSaveDraftRequest({ caseId: "c", sections: [{ heading: "", body: "" }] }).ok,
    false,
  );
});

// — failure-state alert markup (both actions present) ────────────────────────

function renderAlert(over: Partial<{ copyState: CopyState; retryState: RetryState; canRetry: boolean }> = {}): string {
  return renderToStaticMarkup(
    createElement(SaveFailedAlert, {
      copyState: over.copyState ?? "idle",
      retryState: over.retryState ?? "idle",
      onCopy: () => {},
      onRetry: () => {},
      canRetry: over.canRetry ?? true,
    }),
  );
}

test("failure state renders role=alert with the exact recovery message and both actions", () => {
  const html = renderAlert();
  assert.ok(html.includes('role="alert"'), html);
  assert.ok(html.includes(SAVE_FAILED_MESSAGE), html);
  assert.ok(html.includes("Copy draft"), html);
  assert.ok(html.includes("Retry saving"), html);
});

test("retry in flight disables the button and shows progress copy", () => {
  const html = renderAlert({ retryState: "saving" });
  assert.ok(html.includes("Saving…"), html);
  // The disabled ATTRIBUTE (renderToStaticMarkup emits `disabled=""`), not the
  // `disabled:` Tailwind variant that is always in the class list.
  assert.ok(html.includes('disabled=""'), html);
});

test("failed retry keeps the alert actionable and says the draft is still unsaved", () => {
  const html = renderAlert({ retryState: "failed" });
  assert.ok(html.includes("Saving failed again — your draft is still unsaved."), html);
  // Positive control: the retry button is back (not disabled) so the user can try again.
  assert.ok(html.includes("Retry saving"), html);
  assert.ok(!html.includes('disabled=""'), html);
});

test("copy feedback states render Copied / failure hint", () => {
  assert.ok(renderAlert({ copyState: "copied" }).includes("Copied ✓"));
  assert.ok(
    // `&` is HTML-escaped by renderToStaticMarkup.
    renderAlert({ copyState: "failed" }).includes("Copy failed — select &amp; copy manually"),
  );
});

test("without a caseId the retry action is hidden but copy remains", () => {
  const html = renderAlert({ canRetry: false });
  assert.ok(!html.includes("Retry saving"), html);
  assert.ok(html.includes("Copy draft"), html);
});
