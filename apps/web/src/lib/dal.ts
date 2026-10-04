import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabase } from "./supabase/server";

/** The verified user id for this request, or null. Memoised per render pass. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
});

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return userId;
}
