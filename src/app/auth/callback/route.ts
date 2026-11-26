import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeInternalPath } from "@/lib/auth/redirects";

/**
 * Handles Supabase email links (invite, recovery, magic link). Student
 * registration itself is closed; the teacher creates accounts.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeInternalPath(url.searchParams.get("next"), "/");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=config", url.origin));
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }

    console.error("Auth code exchange failed", error.code ?? "unknown");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }

    console.error("Auth token verification failed", error.code ?? "unknown");
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", url.origin),
  );
}
