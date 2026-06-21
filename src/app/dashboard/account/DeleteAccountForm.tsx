"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { deleteAccount, type DeleteAccountState } from "./actions";

// — Danger zone: permanent account deletion ───────────────────────────────────
// Two-step + typed-phrase confirmation for an irreversible action. The first
// click reveals the confirm input; deletion only runs when the user types the
// exact phrase (validated again server-side in the action).

export function DeleteAccountForm() {
  const [revealed, setRevealed] = useState(false);
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    {},
  );

  if (!revealed) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="secondary" onClick={() => setRevealed(true)}>
          Delete my account
        </Button>
        <p className="microprint" style={{ color: "var(--muted)" }}>
          Permanently removes your account and all your case data — you&apos;ll
          confirm first. Consider downloading your data above beforehand.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-control border-2 border-double border-danger/50 bg-danger-soft/40 px-4 py-4"
    >
      <div className="microprint" style={{ color: "var(--danger)" }}>
        This cannot be undone
      </div>
      <p className="font-sans text-[15px] leading-snug text-foreground-soft">
        This permanently deletes your profile, consent history, token balance, and
        every case — drafts, evidence, and the review thread. Filed petitions are
        your attorney&apos;s record; this removes only your copy here.
      </p>
      <label className="block">
        <span className="microprint">
          Type <strong>delete my account</strong> to confirm
        </span>
        <input
          name="confirm"
          type="text"
          autoComplete="off"
          placeholder="delete my account"
          className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
        />
      </label>
      {state.error ? (
        <div
          role="alert"
          className="rounded-control border border-danger/40 bg-danger-soft/50 px-3 py-2 font-sans text-[14.5px] text-danger"
        >
          {state.error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-control bg-danger px-5 py-2.5 font-mono text-[14px] uppercase tracking-document text-background transition-[background-color,opacity] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)] disabled:opacity-60 disabled:pointer-events-none"
        >
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setRevealed(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
