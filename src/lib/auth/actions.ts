"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { dashboardPathForRole, type UserRole } from "@/lib/domain/roles";
import { studentAuthEmail } from "@/lib/auth/student-identity";
import {
  loginSchema,
  type AuthErrorCode,
  type SignInActionResult,
} from "@/lib/validation/auth";

function mapAuthError(error: AuthError | null): AuthErrorCode {
  if (!error) {
    return "unknown";
  }

  if (error.status === 429) {
    return "rate_limited";
  }

  switch (error.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rate_limited";
    default:
      console.error("Supabase sign-in failed", error.code, error.message);
      return "unknown";
  }
}

export async function signInAction(
  input: unknown,
): Promise<SignInActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "config_missing" };
  }

  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "validation_failed" };
  }

  const isStudentLogin = parsed.data.mode === "student";
  let authEmail: string | null;

  if (parsed.data.mode === "student") {
    authEmail = studentAuthEmail(parsed.data.student_id);
  } else {
    authEmail = parsed.data.email.toLowerCase();
  }

  // The schema guarantees a valid ID, but never pass a missing identifier to
  // Supabase Auth: that would turn a validation bug into a login attempt.
  if (!authEmail) {
    return { ok: false, error: "validation_failed" };
  }

  const supabase = await createClient();

  let signInError: AuthError | null = null;
  let userId: string | null = null;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: parsed.data.password,
    });

    signInError = error;
    userId = data.user?.id ?? null;
  } catch (error) {
    console.error("Sign-in request crashed", error);
    return { ok: false, error: "unknown" };
  }

  if (signInError || !userId) {
    return { ok: false, error: mapAuthError(signInError) };
  }

  // Role and grade always come from the database, never from sign-in input.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle<{ role: UserRole; is_active: boolean }>();

  if (profileError || !profile) {
    redirect("/account-pending");
  }

  // The student form accepts only students, and the staff form accepts only
  // staff. Cross-area sign-in fails with the same generic message as a wrong
  // password, so it never confirms which identifier exists.
  if (isStudentLogin !== (profile.role === "student")) {
    await supabase.auth.signOut();
    return { ok: false, error: "invalid_credentials" };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: "inactive_account" };
  }

  redirect(dashboardPathForRole(profile.role));
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
