import "server-only";

/**
 * Server-only secrets. Importing this module from a Client Component fails
 * at build time. No value here may ever be prefixed with NEXT_PUBLIC_.
 */

export function getServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export type GoogleSheetsConfig = {
  mockMode: boolean;
  clientEmail: string | null;
  privateKey: string | null;
  spreadsheetId: string | null;
  sheetName: string;
};

export function getGoogleSheetsConfig(): GoogleSheetsConfig {
  return {
    // Local safety switch for development. Production uses the admin-only
    // `reporting_settings.mock_mode` row; an explicit "true" here still wins.
    mockMode:
      (process.env.GOOGLE_SHEETS_MOCK_MODE ?? "false").toLowerCase() === "true",
    clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim() || null,
    privateKey:
      process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() ||
      null,
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || null,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME?.trim() || "Results",
  };
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}
