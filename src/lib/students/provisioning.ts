import "server-only";

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/env.server";
import { studentAuthEmail } from "@/lib/auth/student-identity";
import { normaliseStudentId } from "@/lib/validation/student-id";
import type { StudentErrorCode } from "@/lib/validation/students";

/**
 * Account provisioning. This is the only Phase 2 module that touches the
 * service-role key, and it is imported exclusively by server actions that call
 * requireTeacher() first. Passwords and access links are never logged.
 *
 * Student Auth identities are deterministic private addresses derived from the
 * Student ID. A student's optional contact e-mail is stored only in
 * public.profiles.email and is never used as an Auth login identifier.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export type ProvisionStudentInput = {
  email: string | null;
  full_name_en: string;
  full_name_ar: string;
  username: string | null;
  student_number: string;
  grade_id: string;
  class_id: string;
  initial_password: string | null;
};

export type ProvisionStudentResult =
  | { ok: true; userId: string; accessUrl: string | null }
  | { ok: false; error: StudentErrorCode };

function mapAuthError(error: {
  code?: string;
  status?: number;
  message?: string;
}): StudentErrorCode {
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
    // The only e-mail an admin write can collide on is the private identity
    // derived from a Student ID, so report the student-facing reason.
    return "student_id_taken";
  }

  if (message.includes("service_role") || message.includes("not configured")) {
    return "service_unavailable";
  }

  console.error("student provisioning failed", error.code ?? "", message);
  return "unknown";
}

function mapProvisionWriteError(message: string): StudentErrorCode {
  if (message.includes("profiles_student_number_unique")) {
    return "student_id_taken";
  }

  if (
    message.includes("profiles_student_number_required") ||
    message.includes("profiles_student_number_format")
  ) {
    return "student_id_invalid";
  }

  if (message.includes("profiles_username_unique")) {
    return "username_taken";
  }

  if (message.includes("profiles_class_grade_fk")) {
    return "grade_class_mismatch";
  }

  console.error("student profile provisioning failed", message);
  return "unknown";
}

export function generateTemporaryPassword(): string {
  // Random, never shown and never stored in the database. The student receives
  // a one-time recovery link instead of this value.
  return `${randomBytes(24).toString("base64url")}Aa1!`;
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
  authEmail: string,
): Promise<string | null> {
  const redirectTo = new URL("/auth/callback", getAppUrl());
  redirectTo.searchParams.set("next", "/set-password");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: authEmail,
    options: { redirectTo: redirectTo.toString() },
  });

  const token = data?.properties?.hashed_token;

  if (error || !token) {
    console.error(
      "recovery link generation failed",
      error?.code ?? "",
      error?.message ?? "missing hashed_token",
    );
    return null;
  }

  return buildAccessUrl(token);
}

/**
 * Creates an email-confirmed student account whose Auth e-mail is the private
 * Student-ID identity. `initial_password` is optional: when absent, a random
 * unusable password is generated and the one-time setup link is the only way in.
 */
export async function createStudentAccount(
  input: ProvisionStudentInput,
): Promise<ProvisionStudentResult> {
  let admin: AdminClient;

  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "service_unavailable" };
  }

  const authEmail = studentAuthEmail(input.student_number);

  if (!authEmail) {
    return { ok: false, error: "student_id_invalid" };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail,
    password: input.initial_password ?? generateTemporaryPassword(),
    email_confirm: true,
    app_metadata: {
      app_role: "student",
      grade_id: input.grade_id,
      class_id: input.class_id,
      student_number: input.student_number,
      // Never populated with the internal Auth address. The database trigger
      // also refuses to copy an @accounts.internal address into profiles.
      contact_email: input.email,
    },
    user_metadata: {
      full_name_en: input.full_name_en,
      full_name_ar: input.full_name_ar,
      username: input.username,
    },
  });

  if (error || !data.user) {
    return { ok: false, error: mapAuthError(error ?? {}) };
  }

  // The hosted auth trigger does not reliably see app_metadata at insert time,
  // so write the profile explicitly with the service-role client. Upsert also
  // covers environments where the auth trigger is missing. This is the only
  // place role is written, and it is always 'student'.
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: data.user.id,
      role: "student",
      full_name_en: input.full_name_en,
      full_name_ar: input.full_name_ar,
      email: input.email,
      username: input.username,
      grade_id: input.grade_id,
      class_id: input.class_id,
      student_number: input.student_number,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    // Never leave an auth user without a profile behind.
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: mapProvisionWriteError(profileError.message) };
  }

  const accessUrl = await generateRecoveryLink(admin, authEmail);

  return { ok: true, userId: data.user.id, accessUrl };
}

/** Issues a fresh one-time password setup link for an existing student. */
export async function issueStudentAccessLink(
  studentNumber: string,
): Promise<string | null> {
  const authEmail = studentAuthEmail(studentNumber);

  if (!authEmail) {
    return null;
  }

  try {
    return await generateRecoveryLink(createAdminClient(), authEmail);
  } catch {
    return null;
  }
}

/**
 * Changes the private Auth identity when a teacher changes the Student ID.
 * The caller must already have validated the new ID and checked uniqueness.
 * Returns the previous identity so the caller can roll back if the profile
 * write fails.
 */
export async function changeStudentAuthIdentity(
  userId: string,
  newStudentNumber: string,
): Promise<{ ok: true } | { ok: false; error: StudentErrorCode }> {
  const authEmail = studentAuthEmail(newStudentNumber);

  if (!authEmail) {
    return { ok: false, error: "student_id_invalid" };
  }

  let admin: AdminClient;

  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "service_unavailable" };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: authEmail,
    email_confirm: true,
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  return { ok: true };
}

export async function restoreStudentAuthIdentity(
  userId: string,
  previousStudentNumber: string,
): Promise<void> {
  const previousEmail = studentAuthEmail(previousStudentNumber);

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
    console.error("student identity rollback failed", error);
  }
}

/** Normalised key used for duplicate checks before touching Auth or profiles. */
export function studentIdentityKey(studentNumber: string): string {
  return normaliseStudentId(studentNumber);
}
