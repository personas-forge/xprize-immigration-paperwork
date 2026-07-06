"use client";

import { type ReactNode, useActionState, useId } from "react";
import { type ReviewActionState } from "../actions";

/** Passed to the render-prop `children` so the field(s) inside can wire
 *  `aria-invalid`/`aria-describedby` at the one error message this form can
 *  show — see the field-error-association a11y pass. */
export interface ReviewActionFormFieldProps {
  /** True exactly when the error `<p>` below is being rendered. */
  invalid: boolean;
  /** Stable id of the error `<p>` (present in the DOM only when `invalid`). */
  errorId: string;
}

/**
 * A `<form>` for a review action that surfaces the action's `{ ok, error }`
 * result (via useActionState) as a visible `role="alert"` message. Without this,
 * a failed/no-op status change returned nothing to the client — a swallowed
 * sign-and-file looked identical to success on a legal filing flow.
 *
 * Children are the form's fields + its <SubmitButton> (which reads
 * useFormStatus); the error renders after them. `children` is a render-prop
 * (not plain ReactNode) so the field(s) can read `invalid`/`errorId` and
 * point their own `aria-invalid`/`aria-describedby` at this form's error.
 */
export function ReviewActionForm({
  action,
  className,
  children,
}: {
  /** A caseId-bound review action: `(prevState, formData) => Promise<state>`. */
  action: (prev: ReviewActionState, formData: FormData) => Promise<ReviewActionState>;
  className?: string;
  children: (fieldProps: ReviewActionFormFieldProps) => ReactNode;
}) {
  const [state, formAction] = useActionState(action, { ok: true });
  const errorId = useId();
  const invalid = state.ok === false && Boolean(state.error);
  return (
    <form action={formAction} className={className}>
      {children({ invalid, errorId })}
      {invalid ? (
        <p
          id={errorId}
          role="alert"
          className="rounded-control border border-danger/40 bg-danger-soft/50 px-3 py-2 font-sans text-[14.5px] text-danger"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
