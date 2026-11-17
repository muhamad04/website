import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AssessmentType,
  AttemptStatus,
  GradingMode,
  ManualReviewStatus,
  ResultsVisibility,
} from "@/lib/domain/types";
import { getGoogleSheetsConfig } from "@/lib/env.server";
import { getReportingSettingsForSync } from "@/lib/reporting/settings";
import {
  buildSyncPayload,
  type SyncFeedbackEntry,
  type SyncPayload,
} from "@/lib/reporting/payload";
import {
  findSubmissionRow,
  planSheetSync,
  rowReference,
  type SyncLogState,
} from "@/lib/reporting/plan";
import {
  appendRow,
  ensureHeaderRow,
  readSubmissionColumn,
  resolveSheetsConfig,
  SheetsError,
  updateRow,
} from "@/lib/reporting/sheets";

/**
 * Google Sheets worker.
 *
 * Submission and grading call `requestAttemptSync` through `after()`, so a
 * Google outage can never fail or delay the student's submission. Every
 * attempt gets at most one log row (unique attempt_id) and at most one sheet
 * row (submission id is searched in column A before writing).
 */

type AttemptSyncRow = {
  id: string;
  attempt_number: number;
  student_id: string;
  assessment_id: string;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  score: number | string | null;
  max_score: number | string | null;
  percentage: number | string | null;
  manual_review_status: ManualReviewStatus;
  assessment: {
    title_en: string;
    title_ar: string | null;
    type: AssessmentType;
    grading_mode: GradingMode;
    results_visibility: ResultsVisibility;
    time_limit_minutes: number;
  } | null;
  student: {
    id: string;
    full_name_en: string;
    full_name_ar: string | null;
    email: string | null;
    student_number: string | null;
    grade: { name_en: string; name_ar: string } | null;
    class: { name_en: string; name_ar: string } | null;
  } | null;
};

type SyncLogRow = {
  status: SyncLogState["status"];
  payload: unknown;
  row_reference: string | null;
  attempt_count: number;
};

export type SyncOutcome = {
  status: "synced" | "failed" | "skipped";
  reason:
    | "written"
    | "updated"
    | "unchanged"
    | "mock_mode"
    | "disabled"
    | "attempt_open"
    | "not_found"
    | "not_configured"
    | "error";
  rowReference: string | null;
  error: string | null;
};

const FINALIZED_STATUSES: AttemptStatus[] = [
  "submitted",
  "grading",
  "graded",
  "expired",
];

const SYNC_ATTEMPT_SELECT = `
  id,
  attempt_number,
  student_id,
  assessment_id,
  status,
  started_at,
  submitted_at,
  score,
  max_score,
  percentage,
  manual_review_status,
  assessment:assessments!attempts_assessment_id_fkey (
    title_en,
    title_ar,
    type,
    grading_mode,
    results_visibility,
    time_limit_minutes
  ),
  student:profiles!attempts_student_id_fkey (
    id,
    full_name_en,
    full_name_ar,
    email,
    student_number,
    grade:grades ( name_en, name_ar ),
    class:classes ( name_en, name_ar )
  )
`;

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof SheetsError) {
    return `${error.code}: ${error.message}`.slice(0, 500);
  }

  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return "unknown_error";
}

async function upsertLog(
  values: {
    attemptId: string;
    status: SyncLogState["status"];
    attemptCount: number;
    spreadsheetId: string | null;
    sheetName: string;
    rowReference: string | null;
    payload: SyncPayload;
    lastError: string | null;
    synced: boolean;
  },
): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin.from("google_sheet_sync_logs").upsert(
      {
        attempt_id: values.attemptId,
        status: values.status,
        attempt_count: values.attemptCount,
        spreadsheet_id: values.spreadsheetId,
        sheet_name: values.sheetName,
        row_reference: values.rowReference,
        payload: values.payload,
        last_error: values.lastError,
        last_attempted_at: now,
        synced_at: values.synced ? now : null,
      },
      { onConflict: "attempt_id" },
    );

    if (error) {
      console.error("sheet sync log write failed", error.message);
    }
  } catch (error) {
    console.error(
      "sheet sync log write failed",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

async function readLog(attemptId: string): Promise<SyncLogRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("google_sheet_sync_logs")
    .select("status, payload, row_reference, attempt_count")
    .eq("attempt_id", attemptId)
    .maybeSingle();

  if (error) {
    console.error("sheet sync log read failed", error.message);
    return null;
  }

  return (data as SyncLogRow | null) ?? null;
}

async function loadFeedback(attemptId: string): Promise<SyncFeedbackEntry[]> {
  const admin = createAdminClient();
  // Only the feedback fields are selected. Responses, files, prompts and
  // answer keys never enter the reporting layer.
  const { data, error } = await admin
    .from("answers")
    .select("feedback_en, feedback_ar")
    .eq("attempt_id", attemptId);

  if (error) {
    console.error("sheet sync feedback lookup failed", error.message);
    return [];
  }

  return (data ?? []) as SyncFeedbackEntry[];
}

export async function syncAttempt(attemptId: string): Promise<SyncOutcome> {
  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return {
      status: "failed",
      reason: "not_configured",
      rowReference: null,
      error: "service_role_unavailable",
    };
  }

  const { data: attemptData, error: attemptError } = await admin
    .from("attempts")
    .select(SYNC_ATTEMPT_SELECT)
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) {
    console.error("sheet sync attempt lookup failed", attemptError.message);
    return {
      status: "failed",
      reason: "error",
      rowReference: null,
      error: attemptError.message.slice(0, 500),
    };
  }

  const attempt = attemptData as unknown as AttemptSyncRow | null;

  if (!attempt) {
    return {
      status: "skipped",
      reason: "not_found",
      rowReference: null,
      error: null,
    };
  }

  if (!FINALIZED_STATUSES.includes(attempt.status)) {
    return {
      status: "skipped",
      reason: "attempt_open",
      rowReference: null,
      error: null,
    };
  }

  const settings = await getReportingSettingsForSync();
  const env = getGoogleSheetsConfig();
  const existing = await readLog(attemptId);
  const attemptCount = (existing?.attempt_count ?? 0) + 1;
  const feedback = await loadFeedback(attemptId);

  const payload = buildSyncPayload({
    attempt: {
      id: attempt.id,
      attempt_number: attempt.attempt_number,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      status: attempt.status,
      score: toNumberOrNull(attempt.score),
      max_score: toNumberOrNull(attempt.max_score),
      percentage: toNumberOrNull(attempt.percentage),
      manual_review_status: attempt.manual_review_status,
    },
    assessment: {
      title_en: attempt.assessment?.title_en ?? "",
      title_ar: attempt.assessment?.title_ar ?? null,
      type: attempt.assessment?.type ?? "quiz",
      grading_mode: attempt.assessment?.grading_mode ?? "manual",
      results_visibility: attempt.assessment?.results_visibility ?? "hidden",
      time_limit_minutes: attempt.assessment?.time_limit_minutes ?? 0,
    },
    student: {
      id: attempt.student?.id ?? attempt.student_id,
      full_name_en: attempt.student?.full_name_en ?? "",
      full_name_ar: attempt.student?.full_name_ar ?? null,
      email: attempt.student?.email ?? "",
      student_number: attempt.student?.student_number ?? null,
      grade_name_en: attempt.student?.grade?.name_en ?? null,
      grade_name_ar: attempt.student?.grade?.name_ar ?? null,
      class_name_en: attempt.student?.class?.name_en ?? null,
      class_name_ar: attempt.student?.class?.name_ar ?? null,
    },
    feedback,
  });

  const sheetName = settings.sheetName || env.sheetName;
  const spreadsheetId = env.spreadsheetId;

  if (!settings.syncEnabled) {
    await upsertLog({
      attemptId,
      status: "skipped",
      attemptCount,
      spreadsheetId,
      sheetName,
      rowReference: existing?.row_reference ?? null,
      payload,
      lastError: null,
      synced: existing?.status === "synced",
    });

    return {
      status: "skipped",
      reason: "disabled",
      rowReference: null,
      error: null,
    };
  }

  const mockMode = settings.mockMode || env.mockMode;

  if (mockMode) {
    await upsertLog({
      attemptId,
      status: "skipped",
      attemptCount,
      spreadsheetId,
      sheetName,
      rowReference: existing?.row_reference ?? null,
      payload,
      lastError: null,
      synced: existing?.status === "synced",
    });

    return {
      status: "skipped",
      reason: "mock_mode",
      rowReference: null,
      error: null,
    };
  }

  try {
    const config = resolveSheetsConfig(sheetName);
    await ensureHeaderRow(config);
    const column = await readSubmissionColumn(config);
    const foundRowNumber = findSubmissionRow(column, attemptId);
    const plan = planSheetSync({
      existing: existing
        ? {
            status: existing.status,
            payload: existing.payload,
            rowReference: existing.row_reference,
          }
        : null,
      nextPayload: payload,
      foundRowNumber,
    });

    if (plan.action === "skip") {
      await upsertLog({
        attemptId,
        status: "synced",
        attemptCount: existing?.attempt_count ?? attemptCount,
        spreadsheetId: config.spreadsheetId,
        sheetName: config.sheetName,
        rowReference: existing?.row_reference ?? null,
        payload,
        lastError: null,
        synced: true,
      });

      return {
        status: "synced",
        reason: "unchanged",
        rowReference: existing?.row_reference ?? null,
        error: null,
      };
    }

    let rowNumber: number | null = null;

    if (plan.action === "update") {
      await updateRow(config, plan.rowNumber, payload);
      rowNumber = plan.rowNumber;
    } else {
      rowNumber = await appendRow(config, payload);
    }

    const reference = rowNumber
      ? rowReference(config.sheetName, rowNumber)
      : existing?.row_reference ?? null;

    await upsertLog({
      attemptId,
      status: "synced",
      attemptCount,
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      rowReference: reference,
      payload,
      lastError: null,
      synced: true,
    });

    return {
      status: "synced",
      reason: plan.action === "update" ? "updated" : "written",
      rowReference: reference,
      error: null,
    };
  } catch (error) {
    const message = errorMessage(error);
    await upsertLog({
      attemptId,
      status: "failed",
      attemptCount,
      spreadsheetId,
      sheetName,
      rowReference: existing?.row_reference ?? null,
      payload,
      lastError: message,
      synced: false,
    });

    console.error("Google Sheets sync failed", message);

    return {
      status: "failed",
      reason:
        error instanceof SheetsError && error.code === "not_configured"
          ? "not_configured"
          : "error",
      rowReference: existing?.row_reference ?? null,
      error: message,
    };
  }
}

/**
 * Fire-and-forget entry point for `after()`. Never throws, so a reporting
 * problem cannot turn a successful submission into an error page.
 */
export async function requestAttemptSync(attemptId: string): Promise<void> {
  try {
    await syncAttempt(attemptId);
  } catch (error) {
    console.error(
      "background sheet sync crashed",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
