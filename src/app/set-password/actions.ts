"use server";

import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsFrom,
  setPasswordSchema,
  type PasswordErrorCode,
} from "@/lib/validation/students";

export type SetPasswordResult =
  | { ok: true }
  | {
      ok: false;
      error: PasswordErrorCode;
      fieldErrors?: Record<string, string>;
    };

/**
 * Completes a recovery/activation link. Requires an existing session created by
 * /auth/callback, so a stranger cannot call it to change another account.
 */
export async function setPasswordAction(
  input: unknown,
): Promise<SetPasswordResult> {
  const user = await getSessionUser();

  if (!user) {
    return { ok: false, error: "session_expired" };
  }

  const parsed = setPasswordSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues);
    const first = Object.values(fieldErrors)[0];
    const error: PasswordErrorCode =
      first === "password_mismatch" ||
      first === "password_short" ||
      first === "password_required"
        ? first
        : "unknown";

    return { ok: false, error, fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (!error) {
    return { ok: true };
  }

  if (error.status === 429) {
    return { ok: false, error: "rate_limited" };
  }

  if (error.code === "weak_password") {
    return {
      ok: false,
      error: "password_short",
      fieldErrors: { password: "password_short" },
    };
  }

  if (error.status === 401 || error.code === "session_not_found") {
    return { ok: false, error: "session_expired" };
  }

  console.error("password update failed", error.code ?? "", error.message);
  return { ok: false, error: "unknown" };
}
