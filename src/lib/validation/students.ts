import { z } from "zod";
import {
  fieldErrorsFrom,
  type FieldErrors,
} from "@/lib/validation/fields";
import {
  canonicalStudentId,
  isValidStudentId,
} from "@/lib/validation/student-id";
import { slugify } from "@/lib/slug";

export { fieldErrorsFrom, slugify };
export type { FieldErrors };

/**
 * Stable error codes only. The UI turns them into bilingual sentences, so the
 * server never leaks provider wording (and never leaks another student's data
 * through a duplicate-ID message that names them).
 */
export const STUDENT_ERROR_CODES = [
  "validation_failed",
  "student_id_required",
  "student_id_invalid",
  "student_id_taken",
  "grade_required",
  "class_required",
  "email_required",
  "email_invalid",
  "name_required",
  "name_too_long",
  "username_invalid",
  "username_taken",
  "name_taken",
  "slug_taken",
  "grade_class_mismatch",
  "not_found",
  "not_a_student",
  "forbidden",
  "service_unavailable",
  "rate_limited",
  "reset_failed",
  "unknown",
] as const;

export type StudentErrorCode = (typeof STUDENT_ERROR_CODES)[number];

export type StudentActionResult = {
  ok: boolean;
  error?: StudentErrorCode;
  fieldErrors?: FieldErrors;
  /** One-time activation link. Never persisted, never logged. */
  accessUrl?: string | null;
  studentId?: string;
  studentName?: string;
};

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z
      .string()
      .trim()
      .max(max, { error: "name_too_long" })
      .optional(),
  );

const requiredUuid = (message: "grade_required" | "class_required") =>
  z
    .string({ error: message })
    .trim()
    .min(1, { error: message })
    .pipe(z.uuid({ error: message }));

const username = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{3,40}$/, { error: "username_invalid" })
    .optional(),
);

/** Student ID as typed by a teacher or student. Canonicalised, never lowered. */
export const studentIdValue = z
  .string({ error: "student_id_required" })
  .transform(canonicalStudentId)
  .refine((value) => value.length > 0, { error: "student_id_required" })
  .refine(isValidStudentId, { error: "student_id_invalid" });

const optionalEmail = z.preprocess(
  (value) =>
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
      ? undefined
      : value,
  z
    .string()
    .trim()
    .pipe(z.email({ error: "email_invalid" }))
    .optional(),
);

const initialPassword = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(8, { error: "password_short" }).optional(),
);

export const createStudentSchema = z
  .object({
    full_name_en: z
      .string({ error: "name_required" })
      .trim()
      .min(1, { error: "name_required" })
      .max(120, { error: "name_too_long" }),
    full_name_ar: z
      .string({ error: "name_required" })
      .trim()
      .min(1, { error: "name_required" })
      .max(120, { error: "name_too_long" }),
    email: optionalEmail,
    username,
    student_number: studentIdValue,
    grade_id: requiredUuid("grade_required"),
    class_id: requiredUuid("class_required"),
    password_mode: z.enum(["link", "set"]).default("link"),
    initial_password: initialPassword,
  })
  .superRefine((value, context) => {
    if (value.password_mode === "set" && !value.initial_password) {
      context.addIssue({
        code: "custom",
        path: ["initial_password"],
        message: "password_required",
      });
    }
  });

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  student_id: z.uuid({ error: "validation_failed" }),
  full_name_en: z
    .string({ error: "name_required" })
    .trim()
    .min(1, { error: "name_required" })
    .max(120, { error: "name_too_long" }),
  full_name_ar: z
    .string({ error: "name_required" })
    .trim()
    .min(1, { error: "name_required" })
    .max(120, { error: "name_too_long" }),
  email: optionalEmail,
  username,
  student_number: studentIdValue,
  grade_id: requiredUuid("grade_required"),
  class_id: requiredUuid("class_required"),
});

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const studentIdSchema = z.object({
  student_id: z.uuid({ error: "validation_failed" }),
});

export const setStudentActiveSchema = z.object({
  student_id: z.uuid({ error: "validation_failed" }),
  is_active: z.enum(["true", "false"]),
});

export const accessRequestSchema = z.object({
  student_id: z.uuid({ error: "validation_failed" }),
});

export const gradeSchema = z.object({
  name_en: z
    .string()
    .trim()
    .min(1, { error: "name_required" })
    .max(80, { error: "name_too_long" }),
  name_ar: z
    .string()
    .trim()
    .min(1, { error: "name_required" })
    .max(80, { error: "name_too_long" }),
  slug: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{2,40}$/, { error: "validation_failed" })
      .optional(),
  ),
  sort_order: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? 0 : value),
    z.coerce.number().int().min(0).max(999).default(0),
  ),
});

export type GradeInput = z.infer<typeof gradeSchema>;

export const classSchema = z.object({
  grade_id: z.uuid({ error: "validation_failed" }),
  name_en: z
    .string()
    .trim()
    .min(1, { error: "name_required" })
    .max(80, { error: "name_too_long" }),
  name_ar: z
    .string()
    .trim()
    .min(1, { error: "name_required" })
    .max(80, { error: "name_too_long" }),
  academic_year: optionalText(20),
});

export type ClassInput = z.infer<typeof classSchema>;

export const PASSWORD_ERROR_CODES = [
  "password_required",
  "password_short",
  "password_mismatch",
  "session_expired",
  "rate_limited",
  "unknown",
] as const;

export type PasswordErrorCode = (typeof PASSWORD_ERROR_CODES)[number];

export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, { error: "password_required" })
      .min(8, { error: "password_short" }),
    confirm_password: z
      .string()
      .min(1, { error: "password_required" }),
  })
  .refine((value) => value.password === value.confirm_password, {
    error: "password_mismatch",
    path: ["confirm_password"],
  });

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;




