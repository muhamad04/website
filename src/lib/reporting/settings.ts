import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleSheetsConfig } from "@/lib/env.server";

export type ReportingSettings = {
  syncEnabled: boolean;
  mockMode: boolean;
  sheetName: string;
  updatedAt: string | null;
};

export const DEFAULT_REPORTING_SETTINGS: ReportingSettings = {
  syncEnabled: true,
  mockMode: true,
  sheetName: "Results",
  updatedAt: null,
};

type SettingsRow = {
  sync_enabled: boolean;
  mock_mode: boolean;
  sheet_name: string;
  updated_at: string | null;
};

function fromRow(row: SettingsRow | null): ReportingSettings {
  if (!row) {
    return DEFAULT_REPORTING_SETTINGS;
  }

  return {
    syncEnabled: row.sync_enabled,
    mockMode: row.mock_mode,
    sheetName: row.sheet_name,
    updatedAt: row.updated_at,
  };
}

/**
 * Reads the singleton settings row. Pass a request-scoped client on the admin
 * page so the admin-only RLS policy is exercised; pass the service-role client
 * from the sync worker, where no end-user session exists.
 */
export async function readReportingSettings(
  client: SupabaseClient,
): Promise<ReportingSettings> {
  const { data, error } = await client
    .from("reporting_settings")
    .select("sync_enabled, mock_mode, sheet_name, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("reporting settings read failed", error.message);
    return DEFAULT_REPORTING_SETTINGS;
  }

  return fromRow(data as SettingsRow | null);
}

/** Service-role settings used by the background sync worker. */
export async function getReportingSettingsForSync(): Promise<ReportingSettings> {
  try {
    return await readReportingSettings(createAdminClient());
  } catch {
    return {
      ...DEFAULT_REPORTING_SETTINGS,
      sheetName: getGoogleSheetsConfig().sheetName,
    };
  }
}
