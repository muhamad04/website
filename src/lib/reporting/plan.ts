/**
 * Idempotency rules for Google Sheets writes.
 *
 * `google_sheet_sync_logs` holds one row per attempt. The sheet itself is the
 * source of truth for whether a row exists, so the caller searches column A
 * for the submission id before deciding:
 *
 *   - no log                 → append
 *   - synced + same payload  → skip (no write at all)
 *   - changed payload        → update the existing row
 *   - failed/pending retry   → update if the row exists, otherwise append
 *
 * The last rule repairs a row that was deleted manually from the sheet and
 * keeps retries duplicate-free.
 */

import { isSyncPayload, payloadsEqual, type SyncPayload } from "./payload";

export type SyncLogState = {
  status: "pending" | "synced" | "failed" | "skipped";
  payload: unknown;
  rowReference: string | null;
};

export type SyncPlan =
  | { action: "append"; rowNumber: null }
  | { action: "update"; rowNumber: number }
  | { action: "skip"; reason: "unchanged" };

export function findSubmissionRow(
  columnA: ReadonlyArray<ReadonlyArray<string>>,
  submissionId: string,
): number | null {
  for (let index = 0; index < columnA.length; index += 1) {
    const cell = columnA[index]?.[0]?.trim();

    if (cell === submissionId) {
      return index + 1;
    }
  }

  return null;
}

export function rowReference(
  sheetName: string,
  rowNumber: number,
): string {
  return `${sheetName}!A${rowNumber}`;
}

export function parseRowNumber(reference: string | null): number | null {
  if (!reference) {
    return null;
  }

  const match = /![A-Z]+(\d+)$/.exec(reference);
  const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function planSheetSync(input: {
  existing: SyncLogState | null;
  nextPayload: SyncPayload;
  foundRowNumber: number | null;
}): SyncPlan {
  const { existing, nextPayload, foundRowNumber } = input;

  if (!existing) {
    return { action: "append", rowNumber: null };
  }

  const unchanged =
    isSyncPayload(existing.payload) &&
    payloadsEqual(existing.payload, nextPayload);

  if (unchanged && existing.status === "synced" && foundRowNumber !== null) {
    return { action: "skip", reason: "unchanged" };
  }

  if (foundRowNumber !== null) {
    return { action: "update", rowNumber: foundRowNumber };
  }

  return { action: "append", rowNumber: null };
}
