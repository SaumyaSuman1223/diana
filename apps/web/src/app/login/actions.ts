"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createSupabase } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { status: "error", message: "Enter a valid email address." };

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { status: "error", message: error.message };
  return { status: "sent", message: `Check ${email.data} for a sign-in link.` };
}
