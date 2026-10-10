"use client";

import { useActionState, useState } from "react";
import { sendCode, verifyCode, type SendState, type VerifyState } from "./actions";

export function LoginForm() {
  // A new key remounts the flow, which is how "use a different email" starts over.
  const [attempt, setAttempt] = useState(0);
  return <LoginFlow key={attempt} onRestart={() => setAttempt((a) => a + 1)} />;
}

function LoginFlow({ onRestart }: { onRestart: () => void }) {
  const [sent, send, sending] = useActionState(sendCode, { status: "idle" } as SendState);
  const [verified, verify, verifying] = useActionState(verifyCode, {} as VerifyState);

  if (sent.status !== "sent") {
    return (
      <form action={send} className="flex flex-col gap-3">
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
        <button type="submit" disabled={sending} className="btn-primary">
          {sending ? "Sending…" : "Email me a sign-in code"}
        </button>
        {sent.message && (
          <p role="alert" className="text-sm text-danger">
            {sent.message}
          </p>
        )}
      </form>
    );
  }

  return (
    <form action={verify} className="flex flex-col gap-3">
      <p role="status" className="text-sm text-muted">
        We emailed {sent.email}. Type the code from that email here, or open its link on this device.
      </p>
      <input type="hidden" name="email" value={sent.email} />
      <label htmlFor="token" className="text-sm text-muted">
        Sign-in code
      </label>
      <input
        id="token"
        name="token"
        required
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6,10}"
        maxLength={10}
        className="field font-mono tracking-widest"
        placeholder="123456"
      />
      <button type="submit" disabled={verifying} className="btn-primary">
        {verifying ? "Signing in…" : "Sign in"}
      </button>
      {verified.error && (
        <p role="alert" className="text-sm text-danger">
          {verified.error}
        </p>
      )}
      <button type="button" onClick={onRestart} className="self-start text-sm text-muted hover:text-fg">
        Use a different email
      </button>
    </form>
  );
}
