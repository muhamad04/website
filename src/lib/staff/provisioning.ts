import "server-only";

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/env.server";
import type { StaffRole } from "@/lib/domain/roles";
import type { StaffErrorCode } from "@/lib/validation/staff";

/**
 * Staff account provisioning. This module is the only place the staff feature
 * touches the service-role key, and it is imported exclusively by server
 * actions that call requireAdmin() first.
 *
 * Passwords and setup links are never persisted or logged. The random password
 * created here is unusable to anyone: the staff member enters through a
 * single-use Supabase recovery link instead.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export type CreateStaffAccountInput = {
  email: string;
  full_name_en: string;
  full_name_ar: string;
  role: StaffRole;
  is_active: boolean;
};

export type CreateStaffAccountResult =
  | { ok: true; userId: string; accessUrl: string | null }
  | { ok: false; error: StaffErrorCode };

function mapAuthError(error: {
  code?: string;
  status?: number;
  message?: string;
}): StaffErrorCode {
  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  if (error.status === 429 || code.includes("rate_limit")) {
    return "rate_limited";
  }

  if (
    code === "email_exists" ||
    message.includes("already been registered") ||
    message.includes("already exists")
  ) {
    return "email_taken";
  }

  if (message.includes("invalid email") || message.includes("email address")) {
    return "email_invalid";
  }

  if (message.includes("service_role") || message.includes("not configured")) {
    return "service_unavailable";
  }

  console.error("staff auth operation failed", error.code ?? "", message);
  return "unknown";
}

function mapProfileWriteError(message: string): StaffErrorCode {
  if (
    message.includes("profiles_email_not_blank") ||
    message.includes("profiles_email_not_internal")
  ) {
    return "email_invalid";
  }

  if (message.includes("staff_admin")) {
    return "forbidden";
  }

  console.error("staff profile write failed", message);
  return "unknown";
}

export function generateTemporaryPassword(): string {
  // Random and never stored in the application database. Staff enter through
  // the one-time recovery link, so this value is not shown to anyone.
  return `${randomBytes(32).toString("base64url")}Aa1!`;
}

function buildAccessUrl(hashedToken: string): string {
  const url = new URL("/auth/callback", getAppUrl());
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("next", "/set-password");
  return url.toString();
}

async function generateRecoveryLink(
  admin: AdminClient,
  email: string,
): Promise<string | null> {
  const redirectTo = new URL("/auth/callback", getAppUrl());
  redirectTo.searchParams.set("next", "/set-password");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: redirectTo.toString() },
  });

  const token = data?.properties?.hashed_token;

  if (error || !token) {
    console.error(
      "staff recovery link generation failed",
      error?.code ?? "",
      error?.message ?? "missing hashed_token",
    );
    return null;
  }

  return buildAccessUrl(token);
}

export async function createStaffAccount(
  input: CreateStaffAccountInput,
): Promise<CreateStaffAccountResult> {
  let admin: AdminClient;

  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "service_unavailable" };
  }

  const email = input.email.trim().toLowerCase();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: generateTemporaryPassword(),
    email_confirm: true,
    app_metadata: {
      app_role: input.role,
      is_active: input.is_active,
    },
    user_metadata: {
      full_name_en: input.full_name_en,
      full_name_ar: input.full_name_ar,
    },
  });

  if (error || !data.user) {
    return { ok: false, error: mapAuthError(error ?? {}) };
  }

  // Hosted Auth applies app_metadata after the auth user insert, so write the
  // profile explicitly with the service-role client, exactly like students.
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: data.user.id,
      role: input.role,
      full_name_en: input.full_name_en,
      full_name_ar: input.full_name_ar,
      email,
      username: null,
      grade_id: null,
      class_id: null,
      student_number: null,
      is_active: input.is_active,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    // Never leave an Auth user without a profile behind.
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: mapProfileWriteError(profileError.message) };
  }

  const accessUrl = await generateRecoveryLink(admin, email);

  return { ok: true, userId: data.user.id, accessUrl };
}

/** Issues a fresh single-use password setup link for an existing staff member. */
export async function issueStaffAccessLink(
  email: string,
): Promise<string | null> {
  if (!email) {
    return null;
  }

  try {
    return await generateRecoveryLink(createAdminClient(), email);
  } catch {
    return null;
  }
}

export async function updateStaffAuthEmail(
  userId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: StaffErrorCode }> {
  let admin: AdminClient;

  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "service_unavailable" };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  return { ok: true };
}

export async function restoreStaffAuthEmail(
  userId: string,
  previousEmail: string | null,
): Promise<void> {
  if (!previousEmail) {
    return;
  }

  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(userId, {
      email: previousEmail,
      email_confirm: true,
    });
  } catch (error) {
    console.error("staff e-mail rollback failed", error);
  }
}

/**
 * Best-effort metadata sync. Profiles are the authorization source of truth, so
 * a metadata failure must not roll back a database role change.
 */
export async function syncStaffAuthMetadata(
  userId: string,
  metadata: { app_role?: StaffRole; is_active?: boolean },
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: metadata,
    });

    if (error) {
      console.error("staff auth metadata sync failed", error.code ?? "");
    }
  } catch (error) {
    console.error("staff auth metadata sync failed", error);
  }
}
