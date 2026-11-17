"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listFailedAttemptIds } from "@/lib/data/reporting";
import { logReportingEvent } from "@/lib/reporting/audit";
import { readReportingSettings } from "@/lib/reporting/settings";
import { syncAttempt } from "@/lib/reporting/sync";
import { checkConnectivity, resolveSheetsConfig } from "@/lib/reporting/sheets";
import {
  booleanFromForm,
  reportingSettingsSchema,
  retrySyncSchema,
  type ReportingActionResult,
} from "@/lib/validation/reporting";

/**
 * Admin-only reporting actions. Every entry point re-checks the session role,
 * re-validates its input and appends to the reporting audit log.
 */

export async function updateReportingSettingsAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const parsed = reportingSettingsSchema.safeParse({
    sync_enabled: booleanFromForm(formData.get("sync_enabled")),
    mock_mode: booleanFromForm(formData.get("mock_mode")),
    sheet_name: String(formData.get("sheet_name") ?? ""),
  });

  if (!parsed.success) {
    redirect("/teacher/reporting?error=validation_failed");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reporting_settings")
    .update({
      sync_enabled: parsed.data.sync_enabled,
      mock_mode: parsed.data.mock_mode,
      sheet_name: parsed.data.sheet_name,
      updated_by: admin.id,
    })
    .eq("id", 1);

  if (error) {
    console.error("reporting settings update failed", error.message);
    redirect("/teacher/reporting?error=settings_save_failed");
  }

  await logReportingEvent(admin.id, "settings_updated", {
    sync_enabled: parsed.data.sync_enabled,
    mock_mode: parsed.data.mock_mode,
    sheet_name: parsed.data.sheet_name,
  });

  revalidatePath("/teacher/reporting");
  redirect("/teacher/reporting?saved=1");
}

export async function checkReportingConnectivityAction(): Promise<ReportingActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const settings = await readReportingSettings(supabase);

  try {
    const config = resolveSheetsConfig(settings.sheetName);
    const result = await checkConnectivity(config);

    await logReportingEvent(admin.id, "connectivity_checked", {
      ok: result.ok,
      tab_found: result.tabFound,
      sheet_name: result.sheetName,
    });

    revalidatePath("/teacher/reporting");

    return {
      ok: result.ok,
      error: result.ok ? undefined : "connectivity_failed",
      message: result.message,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 300) : "unknown";

    await logReportingEvent(admin.id, "connectivity_checked", {
      ok: false,
    });

    console.error("reporting connectivity check failed", message);

    return { ok: false, error: "connectivity_failed", message };
  }
}

export async function retrySyncAction(
  input: unknown,
): Promise<ReportingActionResult> {
  return runManualSync(input, "sync_retry");
}

export async function syncAttemptNowAction(
  input: unknown,
): Promise<ReportingActionResult> {
  return runManualSync(input, "sync_manual");
}

async function runManualSync(
  input: unknown,
  action: "sync_manual" | "sync_retry",
): Promise<ReportingActionResult> {
  const admin = await requireAdmin();
  const parsed = retrySyncSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "validation_failed" };
  }

  const outcome = await syncAttempt(parsed.data.attempt_id);

  await logReportingEvent(admin.id, action, {
    attempt_id: parsed.data.attempt_id,
    status: outcome.status,
    reason: outcome.reason,
    error: outcome.error,
  });

  revalidatePath("/teacher/reporting");

  if (outcome.status === "failed") {
    return {
      ok: false,
      error: "retry_failed",
      message: outcome.error ?? undefined,
    };
  }

  if (outcome.reason === "disabled") {
    return { ok: false, error: "sync_disabled" };
  }

  return { ok: true, message: outcome.reason };
}

export async function retryAllFailedSyncAction(): Promise<ReportingActionResult> {
  const admin = await requireAdmin();
  const attemptIds = await listFailedAttemptIds(20);

  if (attemptIds.length === 0) {
    return { ok: true, message: "none" };
  }

  let succeeded = 0;

  for (const attemptId of attemptIds) {
    const outcome = await syncAttempt(attemptId);

    if (outcome.status !== "failed") {
      succeeded += 1;
    }

    await logReportingEvent(admin.id, "sync_retry", {
      attempt_id: attemptId,
      status: outcome.status,
      reason: outcome.reason,
      error: outcome.error,
      batch: true,
    });
  }

  revalidatePath("/teacher/reporting");

  return succeeded === attemptIds.length
    ? { ok: true, message: `${succeeded}/${attemptIds.length}` }
    : {
        ok: false,
        error: "retry_failed",
        message: `${succeeded}/${attemptIds.length}`,
      };
}
