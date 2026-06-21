"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { updateMarketingPreference, type MarketingPreferenceState } from "./actions";

// — Marketing-email preference toggle ─────────────────────────────────────────
// `current` is the live opt-in state (from the latest consent row). Submitting
// records a NEW append-only consent row with the opposite value; revalidatePath
// in the action re-renders this with the updated `current`.

export function MarketingPreferenceForm({ current }: { current: boolean }) {
  const [state, formAction, pending] = useActionState<MarketingPreferenceState, FormData>(
    updateMarketingPreference,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="optIn" value={current ? "false" : "true"} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-sans text-[15.5px] text-foreground-soft">
          Marketing &amp; product emails:{" "}
          <strong className="text-foreground">{current ? "On" : "Off"}</strong>
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending
            ? "Saving…"
            : current
              ? "Turn off marketing emails"
              : "Turn on marketing emails"}
        </Button>
      </div>
      {state.ok ? (
        <p role="status" className="font-sans text-[14px] text-success">
          Preference updated.
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="font-sans text-[14px] text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
