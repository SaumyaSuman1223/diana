"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm text-muted">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        className="field"
        placeholder="you@example.com"
      />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Sending…" : "Send sign-in link"}
      </button>
      {state.message && (
        <p role="status" className={state.status === "error" ? "text-sm text-danger" : "text-sm text-muted"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
