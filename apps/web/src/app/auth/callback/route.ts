import { NextResponse, type NextRequest } from "next/server";
import { createSupabase } from "@/lib/supabase/server";

/** Email-link landing: exchange the PKCE code for a session cookie. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");

  // Supabase reports its own failures (expired or reused link) as query parameters.
  let reason = params.get("error_code") ?? params.get("error") ?? "missing_code";

  if (code) {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/today", request.url));
    console.error("auth callback: code exchange failed:", error.code, error.message);
    reason = "exchange_failed";
  } else {
    console.error("auth callback: no code:", reason, params.get("error_description"));
  }

  const failed = new URL("/login", request.url);
  failed.searchParams.set("error", reason);
  return NextResponse.redirect(failed);
}
