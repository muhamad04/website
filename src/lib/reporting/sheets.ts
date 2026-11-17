import "server-only";

import { createSign } from "node:crypto";
import { getGoogleSheetsConfig } from "@/lib/env.server";
import { SHEET_HEADERS, SHEET_COLUMN_COUNT } from "@/lib/reporting/payload";

/**
 * Minimal Google Sheets client for the reporting worker.
 *
 * Only the two REST endpoints the app needs are implemented (values append /
 * update plus spreadsheet metadata), authenticated with a service-account JWT.
 * Credentials are read from the server environment and never leave this
 * module: no public function returns the private key or the full config.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const REQUEST_TIMEOUT_MS = 10_000;

export type SheetsErrorCode =
  | "not_configured"
  | "auth_failed"
  | "sheet_not_found"
  | "request_failed";

export class SheetsError extends Error {
  code: SheetsErrorCode;

  constructor(code: SheetsErrorCode, message: string) {
    super(message);
    this.name = "SheetsError";
    this.code = code;
  }
}

export type ResolvedSheetsConfig = {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
  sheetName: string;
};

export type CredentialStatus = {
  clientEmailConfigured: boolean;
  privateKeyConfigured: boolean;
  spreadsheetConfigured: boolean;
  configured: boolean;
  sheetName: string;
};

/** Booleans only — never the credential values themselves. */
export function getSheetsCredentialStatus(
  sheetName?: string,
): CredentialStatus {
  const config = getGoogleSheetsConfig();
  const clientEmailConfigured = Boolean(config.clientEmail);
  const privateKeyConfigured = Boolean(config.privateKey);
  const spreadsheetConfigured = Boolean(config.spreadsheetId);

  return {
    clientEmailConfigured,
    privateKeyConfigured,
    spreadsheetConfigured,
    configured:
      clientEmailConfigured && privateKeyConfigured && spreadsheetConfigured,
    sheetName: sheetName ?? config.sheetName,
  };
}

export function resolveSheetsConfig(sheetName: string): ResolvedSheetsConfig {
  const config = getGoogleSheetsConfig();

  if (!config.clientEmail || !config.privateKey || !config.spreadsheetId) {
    throw new SheetsError(
      "not_configured",
      "Google Sheets credentials are not configured on the server.",
    );
  }

  return {
    clientEmail: config.clientEmail,
    privateKey: config.privateKey,
    spreadsheetId: config.spreadsheetId,
    sheetName: sheetName.trim() || config.sheetName,
  };
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildAssertion(config: ResolvedSheetsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;

  try {
    const signature = createSign("RSA-SHA256")
      .update(unsigned)
      .sign(config.privateKey);
    return `${unsigned}.${base64Url(signature)}`;
  } catch {
    throw new SheetsError(
      "auth_failed",
      "The Google service-account private key could not be used. Check GOOGLE_SHEETS_PRIVATE_KEY.",
    );
  }
}

type TokenCache = {
  email: string;
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

async function fetchAccessToken(
  config: ResolvedSheetsConfig,
): Promise<string> {
  const now = Date.now();

  if (
    tokenCache &&
    tokenCache.email === config.clientEmail &&
    tokenCache.expiresAt > now + 60_000
  ) {
    return tokenCache.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: buildAssertion(config),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new SheetsError(
      "auth_failed",
      `Google rejected the service-account token request (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new SheetsError(
      "auth_failed",
      "Google did not return an access token.",
    );
  }

  const expiresIn = Number(payload.expires_in ?? 3600);
  tokenCache = {
    email: config.clientEmail,
    token: payload.access_token,
    expiresAt: now + Math.max(60, expiresIn - 60) * 1000,
  };

  return payload.access_token;
}

function quotedSheet(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

export function sheetRange(sheetName: string, suffix: string): string {
  return `${quotedSheet(sheetName)}!${suffix}`;
}

async function sheetsFetch(
  config: ResolvedSheetsConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await fetchAccessToken(config);
  const response = await fetch(`${SHEETS_BASE}/${config.spreadsheetId}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (response.ok) {
    return response;
  }

  const detail = (await response.text()).slice(0, 300);
  const code: SheetsErrorCode =
    response.status === 401 || response.status === 403
      ? "auth_failed"
      : response.status === 404
        ? "sheet_not_found"
        : "request_failed";

  throw new SheetsError(
    code,
    `Google Sheets request failed (HTTP ${response.status}). ${detail}`,
  );
}

async function readValues(
  config: ResolvedSheetsConfig,
  range: string,
): Promise<string[][]> {
  const response = await sheetsFetch(
    config,
    `/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
  );
  const payload = (await response.json()) as { values?: unknown };
  const values = payload.values;

  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [],
  );
}

async function writeValues(
  config: ResolvedSheetsConfig,
  range: string,
  values: ReadonlyArray<ReadonlyArray<string | number>>,
  mode: "update" | "append",
): Promise<void> {
  const suffix =
    mode === "append"
      ? `:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
      : `?valueInputOption=RAW`;
  const path =
    mode === "append"
      ? `/values/${encodeURIComponent(range)}${suffix}`
      : `/values/${encodeURIComponent(range)}${suffix}`;

  await sheetsFetch(config, path, {
    method: mode === "append" ? "POST" : "PUT",
    body: JSON.stringify({
      range,
      majorDimension: "ROWS",
      values: values.map((row) => [...row]),
    }),
  });
}

/** Writes the header row when it is missing or different. */
export async function ensureHeaderRow(
  config: ResolvedSheetsConfig,
): Promise<void> {
  const range = sheetRange(
    config.sheetName,
    `A1:${String.fromCharCode(65 + SHEET_COLUMN_COUNT - 1)}1`,
  );
  const existing = await readValues(config, range);
  const current = existing[0] ?? [];
  const matches =
    current.length >= SHEET_COLUMN_COUNT &&
    SHEET_HEADERS.every((header, index) => current[index] === header);

  if (matches) {
    return;
  }

  await writeValues(config, range, [SHEET_HEADERS], "update");
}

export async function readSubmissionColumn(
  config: ResolvedSheetsConfig,
): Promise<string[][]> {
  return readValues(config, sheetRange(config.sheetName, "A:A"));
}

export async function appendRow(
  config: ResolvedSheetsConfig,
  values: ReadonlyArray<string | number>,
): Promise<number | null> {
  const response = await sheetsFetch(
    config,
    `/values/${encodeURIComponent(sheetRange(config.sheetName, "A:R"))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({
        range: sheetRange(config.sheetName, "A:R"),
        majorDimension: "ROWS",
        values: [[...values]],
      }),
    },
  );
  const payload = (await response.json()) as {
    updates?: { updatedRange?: string };
  };
  const match = /![A-Z]+(\d+):/.exec(payload.updates?.updatedRange ?? "");
  const row = match ? Number.parseInt(match[1], 10) : Number.NaN;

  return Number.isInteger(row) && row > 0 ? row : null;
}

export async function updateRow(
  config: ResolvedSheetsConfig,
  rowNumber: number,
  values: ReadonlyArray<string | number>,
): Promise<void> {
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new SheetsError(
      "request_failed",
      "Refusing to update a row outside the data area.",
    );
  }

  await writeValues(
    config,
    sheetRange(config.sheetName, `A${rowNumber}:R${rowNumber}`),
    [values],
    "update",
  );
}

export type ConnectivityResult = {
  ok: boolean;
  spreadsheetTitle: string | null;
  sheetName: string;
  tabFound: boolean;
  message: string;
};

/**
 * Verifies the token and spreadsheet access without writing anything.
 * A missing tab is reported with an actionable message; it is not created
 * automatically because the configured tab name is an admin decision.
 */
export async function checkConnectivity(
  config: ResolvedSheetsConfig,
): Promise<ConnectivityResult> {
  const response = await sheetsFetch(
    config,
    "?fields=properties.title,sheets.properties.title",
  );
  const payload = (await response.json()) as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  const tabNames = (payload.sheets ?? []).map(
    (sheet) => sheet.properties?.title ?? "",
  );
  const tabFound = tabNames.includes(config.sheetName);

  return {
    ok: tabFound,
    spreadsheetTitle: payload.properties?.title ?? null,
    sheetName: config.sheetName,
    tabFound,
    message: tabFound
      ? "Connected to the spreadsheet and the configured tab."
      : `The spreadsheet is reachable but no tab is named "${config.sheetName}". Create it in Google Sheets first.`,
  };
}
