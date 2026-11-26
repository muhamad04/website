import { z } from "zod";
import { studentIdValue } from "@/lib/validation/students";

/**
 * Messages are stable codes, not sentences. The UI renders them in both
 * languages, and the server never leaks provider-specific details.
 */

const password = z
  .string({ error: "password_required" })
  .min(1, { error: "password_required" })
  .min(6, { error: "password_short" });

/** Teacher/admin sign-in is unchanged: e-mail + password. */
export const staffLoginSchema = z.object({
  mode: z.literal("staff").optional(),
  email: z
    .string({ error: "email_required" })
    .trim()
    .min(1, { error: "email_required" })
    .pipe(z.email({ error: "email_invalid" })),
  password,
});

/** Student sign-in: Student ID + password. E-mail is never requested. */
export const studentLoginSchema = z.object({
  mode: z.literal("student"),
  student_id: studentIdValue,
  password,
});

export const loginSchema = z.union([studentLoginSchema, staffLoginSchema]);

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;
export type StudentLoginInput = z.infer<typeof studentLoginSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const AUTH_ERROR_CODES = [
  "validation_failed",
  "invalid_credentials",
  "email_not_confirmed",
  "rate_limited",
  "profile_missing",
  "config_missing",
  "unknown",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export type SignInActionResult =
  | { ok: true }
  | { ok: false; error: AuthErrorCode };
