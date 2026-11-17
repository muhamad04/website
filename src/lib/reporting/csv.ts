/**
 * CSV serialisation for the teacher results export.
 *
 * Two concerns are handled deliberately:
 *
 *  1. RFC 4180 quoting, so commas, quotes and newlines inside feedback or
 *     names do not break the file.
 *  2. Formula-injection neutralisation. Excel and Google Sheets execute cells
 *     that start with = + - @ or a control character, so untrusted text is
 *     prefixed with an apostrophe. Numbers are written bare.
 */

export type CsvValue = string | number | null | undefined;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function sanitiseText(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  const text = sanitiseText(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/**
 * Joins a header row and data rows with CRLF line endings. The returned value
 * starts with a UTF-8 BOM so Excel opens Arabic names correctly.
 */
export function buildCsv(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<CsvValue>>,
): string {
  const lines = [headers.map(escapeCell).join(",")];

  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Turns an attempt id into a stable, safe download file name. */
export function exportFileName(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `results-${year}-${month}-${day}.csv`;
}
