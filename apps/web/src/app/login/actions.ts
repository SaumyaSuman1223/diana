"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabase } from "@/lib/supabase/server";

export type SendState = { status: "idle" | "sent" | "error"; email?: string; message?: string };
export type VerifyState = { error?: string };

/**
 * Email a one-time code (and a link). The code works on any device; the link only
 * in the browser that requested it, because of PKCE.
 */
export async function sendCode(_prev: SendState, form: FormData): Promise<SendState> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { status: "error", message: "Enter a valid email address." };

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { status: "error", message: error.message };
  return { status: "sent", email: email.data };
}

export async function verifyCode(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const input = z
    .object({ email: z.email(), token: z.string().trim().regex(/^\d{6,10}$/) })
    .safeParse({ email: form.get("email"), token: form.get("token") });
  if (!input.success) return { error: "Enter the code from the email (digits only)." };

  const supabase = await createSupabase();
  const { error } = await supabase.auth.verifyOtp({ ...input.data, type: "email" });
  if (error) return { error: "That code is wrong or has expired. Request a new one." };
  redirect("/today");
}
