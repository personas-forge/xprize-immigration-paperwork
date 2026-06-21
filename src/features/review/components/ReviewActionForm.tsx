"use client";

import { type ReactNode, useActionState } from "react";
import { type ReviewActionState } from "../actions";

/**
 * A `<form>` for a review action that surfaces the action's `{ ok, error }`
 * result (via useActionState) as a visible `role="alert"` message. Without this,
 * a failed/no-op status change returned nothing to the client — a swallowed
 * sign-and-file looked identical to success on a legal filing flow.
 *
 * Children are the form's fields + its <SubmitButton> (which reads
 * useFormStatus); the error renders after them.
 */
export function ReviewActionForm({
  action,
  className,
  children,
}: {
  /** A caseId-bound review action: `(prevState, formData) => Promise<state>`. */
  action: (prev: ReviewActionState, formData: FormData) => Promise<ReviewActionState>;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, { ok: true });
  return (
    <form action={formAction} className={className}>
      {children}
      {state.ok === false && state.error ? (
        <p
          role="alert"
          className="rounded-control border border-danger/40 bg-danger-soft/50 px-3 py-2 font-sans text-[14.5px] text-danger"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
