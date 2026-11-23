import "server-only";

/**
 * Server-only secrets. Importing this module from a Client Component fails
 * at build time. No value here may ever be prefixed with NEXT_PUBLIC_.
 */

export function getServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export type OpenRouterConfig = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  maxRequestsPerImport: number;
  maxOutputTokens: number;
  timeoutMs: number;
};

function positiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value?.trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

/**
 * Optional, server-only OpenRouter assistance. AI is off unless both the
 * feature flag and a key are present. The key is never logged or sent to the
 * browser, and the importer keeps working with the deterministic parser alone.
 */
export function getOpenRouterConfig(): OpenRouterConfig {
  return {
    enabled:
      (process.env.ASSESSMENT_IMPORT_AI_ENABLED ?? "false").toLowerCase() ===
      "true",
    apiKey: process.env.OPENROUTER_API_KEY?.trim() || null,
    model: process.env.OPENROUTER_MODEL?.trim() || "openrouter/free",
    maxRequestsPerImport: positiveInt(
      process.env.OPENROUTER_MAX_REQUESTS_PER_IMPORT,
      3,
      10,
    ),
    maxOutputTokens: positiveInt(
      process.env.OPENROUTER_MAX_OUTPUT_TOKENS,
      12_000,
      32_000,
    ),
    timeoutMs: positiveInt(process.env.OPENROUTER_TIMEOUT_MS, 30_000, 120_000),
  };
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
