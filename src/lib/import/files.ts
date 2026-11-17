/**
 * Free, local assessment-import constants and file guards.
 *
 * Only DOCX, text-based PDF and plain UTF-8 text are accepted. The extension,
 * declared MIME type and magic bytes must all agree before any parser runs.
 */

export const IMPORT_BUCKET = "assessment-imports";
export const IMPORT_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const IMPORT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
export const IMPORT_MAX_TEXT_CHARS = 200_000;
export const IMPORT_RETENTION_HOURS = 24;
export const IMPORT_SAVED_RETENTION_DAYS = 7;

export const IMPORT_DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const IMPORT_MIME_TYPES = {
  docx: [IMPORT_DOCX_MIME],
  pdf: ["application/pdf"],
  txt: ["text/plain"],
} as const;

export type ImportFileKind = keyof typeof IMPORT_MIME_TYPES;

export type ImportFileError =
  | "file_required"
  | "file_type_invalid"
  | "file_too_large"
  | "file_empty";

export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

export function sanitizeImportFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);

  return cleaned || "file";
}

export function buildImportPath(options: {
  userId: string;
  importId: string;
  role: "questions" | "answers";
  fileName: string;
}): string {
  return `${options.userId}/${options.importId}/${options.role}-${sanitizeImportFileName(options.fileName)}`;
}

export function isImportPathFor(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`);
}

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((value, index) => bytes[index] === value);
}

function containsAscii(bytes: Uint8Array, needle: string, limit = 65_536): boolean {
  const max = Math.min(bytes.length, limit);
  const text = new TextDecoder("latin1").decode(bytes.subarray(0, max));
  return text.includes(needle);
}

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 8192));
  let printable = 0;
  let total = 0;

  for (const value of sample) {
    total += 1;

    if (value === 0) {
      return false;
    }

    if (
      value === 9 ||
      value === 10 ||
      value === 13 ||
      (value >= 32 && value !== 127)
    ) {
      printable += 1;
    }
  }

  return total === 0 || printable / total >= 0.9;
}

/**
 * Validates name, MIME and magic bytes together. A ZIP that does not contain
 * `word/document.xml` is rejected instead of being handed to mammoth.
 */
export function detectImportFileKind(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): { ok: true; kind: ImportFileKind } | { ok: false; error: ImportFileError } {
  if (input.bytes.length === 0) {
    return { ok: false, error: "file_empty" };
  }

  if (input.bytes.length > IMPORT_MAX_FILE_BYTES) {
    return { ok: false, error: "file_too_large" };
  }

  const extension = extensionOf(input.fileName);
  const mime = input.mimeType.trim().toLowerCase().split(";")[0]?.trim() ?? "";

  if (extension === "docx") {
    const allowed = IMPORT_MIME_TYPES.docx.some((type) => type === mime);

    if (
      !allowed ||
      !startsWithBytes(input.bytes, [0x50, 0x4b, 0x03, 0x04]) ||
      !containsAscii(input.bytes, "word/document.xml")
    ) {
      return { ok: false, error: "file_type_invalid" };
    }

    return { ok: true, kind: "docx" };
  }

  if (extension === "pdf") {
    if (
      !IMPORT_MIME_TYPES.pdf.some((type) => type === mime) ||
      !containsAscii(input.bytes, "%PDF-", 1024)
    ) {
      return { ok: false, error: "file_type_invalid" };
    }

    return { ok: true, kind: "pdf" };
  }

  if (extension === "txt") {
    if (
      !IMPORT_MIME_TYPES.txt.some((type) => type === mime) ||
      !looksLikeText(input.bytes)
    ) {
      return { ok: false, error: "file_type_invalid" };
    }

    return { ok: true, kind: "txt" };
  }

  return { ok: false, error: "file_type_invalid" };
}

/** Filename fallback title, e.g. "unit-3-quiz.docx" -> "unit 3 quiz". */
export function titleFromFileName(name: string): string {
  return (name.split(/[\\/]/).pop() ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(answer\s*key|answers|key|questions|quiz|exam|test)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
