"use client";

import { useActionState, type ReactNode } from "react";

type State = { error?: string; ok?: number };

/**
 * A form bound to a server action that reports errors inline. With `resetOnSuccess`
 * the fields are cleared after a successful submit.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {} as State);
  return (
    <form key={resetOnSuccess ? state.ok : undefined} action={formAction} className={className}>
      {children}
      {state.error && (
        <p role="alert" className="w-full text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
