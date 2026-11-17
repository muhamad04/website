import { z } from "zod";

export const REPORTING_ERROR_CODES = [
  "validation_failed",
  "forbidden",
  "not_found",
  "settings_save_failed",
  "connectivity_failed",
  "retry_failed",
  "sync_disabled",
  "unknown",
] as const;

export type ReportingErrorCode = (typeof REPORTING_ERROR_CODES)[number];

export type ReportingActionResult = {
  ok: boolean;
  error?: ReportingErrorCode;
  /** Short, already-sanitised detail for the UI. Never contains credentials. */
  message?: string;
  redirectTo?: string;
};

const ILLEGAL_SHEET_CHARACTERS = /[\\/?*[\]:]/;

export const reportingSettingsSchema = z.object({
  sync_enabled: z.boolean(),
  mock_mode: z.boolean(),
  sheet_name: z
    .string({ error: "validation_failed" })
    .trim()
    .min(1, { error: "validation_failed" })
    .max(100, { error: "validation_failed" })
    .refine((value) => !ILLEGAL_SHEET_CHARACTERS.test(value), {
      error: "validation_failed",
    }),
});

export type ReportingSettingsInput = z.infer<typeof reportingSettingsSchema>;

export const retrySyncSchema = z.object({
  attempt_id: z.uuid({ error: "validation_failed" }),
});

export type RetrySyncInput = z.infer<typeof retrySyncSchema>;

export function booleanFromForm(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}
