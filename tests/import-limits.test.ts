import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectImportFileKind,
  IMPORT_DEFAULT_MAX_FILE_BYTES,
  IMPORT_MAX_FILE_BYTES,
  isSuspiciousImportFileName,
} from "@/lib/import/files";
import {
  getImportMaxBytes,
  getImportMaxTotalBytes,
} from "@/lib/import/config";
import { buildTextFile } from "./fixtures/import-fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("importer size configuration", () => {
  it("defaults to 50 MiB per file", () => {
    expect(IMPORT_DEFAULT_MAX_FILE_BYTES).toBe(50 * 1024 * 1024);
    expect(IMPORT_MAX_FILE_BYTES).toBe(IMPORT_DEFAULT_MAX_FILE_BYTES);
    expect(getImportMaxBytes()).toBe(IMPORT_DEFAULT_MAX_FILE_BYTES);
  });

  it("reads ASSESSMENT_IMPORT_MAX_BYTES", () => {
    vi.stubEnv("ASSESSMENT_IMPORT_MAX_BYTES", String(10 * 1024 * 1024));
    expect(getImportMaxBytes()).toBe(10 * 1024 * 1024);
    expect(getImportMaxTotalBytes()).toBeGreaterThanOrEqual(
      getImportMaxBytes() * 2,
    );
  });

  it("clamps invalid, tiny and huge values", () => {
    vi.stubEnv("ASSESSMENT_IMPORT_MAX_BYTES", "not-a-number");
    expect(getImportMaxBytes()).toBe(IMPORT_DEFAULT_MAX_FILE_BYTES);

    vi.stubEnv("ASSESSMENT_IMPORT_MAX_BYTES", "10");
    expect(getImportMaxBytes()).toBe(1 * 1024 * 1024);

    vi.stubEnv("ASSESSMENT_IMPORT_MAX_BYTES", String(500 * 1024 * 1024));
    expect(getImportMaxBytes()).toBe(50 * 1024 * 1024);
  });
});

describe("importer file guards", () => {
  it("accepts a file exactly at the limit and rejects one byte more", () => {
    const limit = 1024;
    const exact = buildTextFile("a".repeat(limit));
    const over = buildTextFile("a".repeat(limit + 1));

    expect(
      detectImportFileKind({
        fileName: "paper.txt",
        mimeType: "text/plain",
        bytes: exact,
        maxBytes: limit,
      }),
    ).toEqual({ ok: true, kind: "txt" });

    expect(
      detectImportFileKind({
        fileName: "paper.txt",
        mimeType: "text/plain",
        bytes: over,
        maxBytes: limit,
      }),
    ).toEqual({ ok: false, error: "file_too_large" });
  });

  it("rejects executables, hidden files and path traversal", () => {
    for (const name of [
      "quiz.exe",
      "quiz.docx.exe",
      ".quiz.docx",
      "../quiz.docx",
      "folder/quiz.docx",
      "quiz:stream.docx",
      "quiz\u0000.docx",
    ]) {
      expect(isSuspiciousImportFileName(name)).toBe(true);
    }

    expect(isSuspiciousImportFileName("Conditionals_Quiz.docx")).toBe(false);
  });

  it("rejects a name with an executable extension before parsing", () => {
    expect(
      detectImportFileKind({
        fileName: "quiz.bat",
        mimeType: "text/plain",
        bytes: buildTextFile("hello"),
      }),
    ).toEqual({ ok: false, error: "file_name_invalid" });
  });
});
