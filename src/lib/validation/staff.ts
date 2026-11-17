import { z } from "zod";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/validation/fields";

export { fieldErrorsFrom };
export type { FieldErrors };

/**
 * Stable staff-management error codes. The UI translates these; provider
 * wording and duplicate-account details never reach the browser.
 */
export const STAFF_ERROR_CODES = [
  "validation_failed",
  "email_required",
  "email_invalid",
  "email_taken",
  "name_required",
  "name_too_long",
  "role_invalid",
  "not_found",
  "not_staff",
  "forbidden",
  "self_role_change_forbidden",
  "self_deactivation_forbidden",
  "last_admin_protected",
  "service_unavailable",
  "rate_limited",
  "reset_failed",
  "unknown",
] as const;

export type StaffErrorCode = (typeof STAFF_ERROR_CODES)[number];

export type StaffActionResult = {
  ok: boolean;
  error?: StaffErrorCode;
  fieldErrors?: FieldErrors;
  /** One-time password setup link. Never persisted, logged or returned twice. */
  accessUrl?: string | null;
  staffId?: string;
  staffName?: string;
};

export const STAFF_ROLE_VALUES = ["teacher", "admin"] as const;

const requiredName = z
  .string({ error: "name_required" })
  .trim()
  .min(1, { error: "name_required" })
  .max(120, { error: "name_too_long" });

const requiredEmail = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z
    .string({ error: "email_required" })
    .min(1, { error: "email_required" })
    .pipe(z.email({ error: "email_invalid" })),
);

const roleValue = z.enum(STAFF_ROLE_VALUES, { error: "role_invalid" });

const activeValue = z.preprocess(
  (value) => {
    if (value === true || value === "true") {
      return "true";
    }

    if (value === false || value === "false") {
      return "false";
    }

    return value;
  },
  z.enum(["true", "false"], { error: "validation_failed" }),
);

export const createStaffSchema = z.object({
  full_name_en: requiredName,
  full_name_ar: requiredName,
  email: requiredEmail,
  role: roleValue,
  is_active: activeValue.default("true"),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  staff_id: z.uuid({ error: "validation_failed" }),
  full_name_en: requiredName,
  full_name_ar: requiredName,
  email: requiredEmail,
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const changeStaffRoleSchema = z.object({
  staff_id: z.uuid({ error: "validation_failed" }),
  role: roleValue,
});

export type ChangeStaffRoleInput = z.infer<typeof changeStaffRoleSchema>;

export const setStaffActiveSchema = z.object({
  staff_id: z.uuid({ error: "validation_failed" }),
  is_active: activeValue,
});

export const staffAccessRequestSchema = z.object({
  staff_id: z.uuid({ error: "validation_failed" }),
});
