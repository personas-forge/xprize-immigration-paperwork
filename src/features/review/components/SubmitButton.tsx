"use client";

import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * A form submit button that DISABLES itself (and swaps its label) while the
 * form's server action is pending — `useFormStatus().pending`. On the attorney
 * console every action is legally meaningful (submit for review, sign & file,
 * record decision), so a second click during the in-flight gap must be blocked
 * and the pending state must be visible, not just the raw label.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...rest
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...rest} type="submit" disabled={pending} aria-busy={pending}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
