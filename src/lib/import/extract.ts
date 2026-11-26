import mammoth from "mammoth";
import { extractText } from "unpdf";
import { htmlToStructuredText } from "@/lib/import/html";
import { inspectDocxArchive } from "@/lib/import/docx";
import { runWithTimeout } from "@/lib/import/timeout";
import {
  IMPORT_MAX_TEXT_CHARS,
  detectImportFileKind,
  type ImportFileError,
  type ImportFileKind,
} from "@/lib/import/files";

export const IMPORT_PARSE_TIMEOUT_MS = 20_000;

export type ImportExtractError = ImportFileError | "no_text_extracted" | "parse_failed";

export type ImportExtractResult =
  | {
      ok: true;
      kind: ImportFileKind;
      text: string;
      truncated: boolean;
    }
  | { ok: false; error: ImportExtractError };

function normaliseText(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\u2060]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function capText(text: string): { text: string; truncated: boolean } {
  if (text.length <= IMPORT_MAX_TEXT_CHARS) {
    return { text, truncated: false };
  }

  return {
    text: text.slice(0, IMPORT_MAX_TEXT_CHARS),
    truncated: true,
  };
}

/**
 * Runs entirely on the server. No uploaded byte leaves the process: DOCX is
 * parsed by mammoth, PDF text by PDF.js through unpdf, and TXT by TextDecoder.
 */
export async function extractImportFile(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  maxBytes?: number;
}): Promise<ImportExtractResult> {
  const kind = detectImportFileKind(input);

  if (!kind.ok) {
    return kind;
  }

  let raw: string;

  try {
    if (kind.kind === "docx") {
      const inspection = inspectDocxArchive(input.bytes);

      if (!inspection.ok) {
        return inspection;
      }

      const parsed = await runWithTimeout(
        (async () => {
          const converted = await mammoth.convertToHtml({
            buffer: Buffer.from(input.bytes),
          });
          let value = htmlToStructuredText(converted.value);

          if (value.trim() === "") {
            const fallback = await mammoth.extractRawText({
              buffer: Buffer.from(input.bytes),
            });
            value = fallback.value;
          }

          return value;
        })(),
        IMPORT_PARSE_TIMEOUT_MS,
      );

      if (parsed.kind !== "value") {
        return { ok: false, error: "parse_failed" };
      }

      raw = parsed.value;
    } else if (kind.kind === "pdf") {
      const parsed = await runWithTimeout(
        (async () => {
          const extracted = await extractText(new Uint8Array(input.bytes), {
            mergePages: true,
          });
          return extracted.text;
        })(),
        IMPORT_PARSE_TIMEOUT_MS,
      );

      if (parsed.kind !== "value") {
        return { ok: false, error: "parse_failed" };
      }

      raw = parsed.value;
    } else {
      raw = new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
    }
  } catch {
    return { ok: false, error: "parse_failed" };
  }

  const text = normaliseText(raw);

  if (text === "") {
    return { ok: false, error: "no_text_extracted" };
  }

  return { ok: true, kind: kind.kind, ...capText(text) };
}
