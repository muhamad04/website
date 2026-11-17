import { describe, expect, it } from "vitest";
import { extractImportFile } from "@/lib/import/extract";
import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_TEXT_CHARS,
  detectImportFileKind,
} from "@/lib/import/files";
import {
  DOCX_MIME,
  buildDocx,
  buildTextFile,
  buildTextPdf,
} from "./fixtures/import-fixtures";

describe("import file guards", () => {
  it("accepts a real DOCX name, MIME and magic bytes", async () => {
    const bytes = await buildDocx(["Unit 3 Quiz"]);
    const result = detectImportFileKind({
      fileName: "unit-3-quiz.docx",
      mimeType: DOCX_MIME,
      bytes,
    });

    expect(result).toEqual({ ok: true, kind: "docx" });
  });

  it("rejects a DOCX with the wrong declared MIME type", async () => {
    const bytes = await buildDocx(["Quiz"]);

    expect(
      detectImportFileKind({
        fileName: "quiz.docx",
        mimeType: "text/plain",
        bytes,
      }),
    ).toEqual({ ok: false, error: "file_type_invalid" });
  });

  it("rejects a ZIP that is not a Word document", () => {
    const bytes = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    expect(
      detectImportFileKind({
        fileName: "fake.docx",
        mimeType: DOCX_MIME,
        bytes,
      }),
    ).toEqual({ ok: false, error: "file_type_invalid" });
  });

  it("rejects a PDF that does not start with a PDF header", () => {
    const bytes = buildTextFile("not really a pdf");

    expect(
      detectImportFileKind({
        fileName: "paper.pdf",
        mimeType: "application/pdf",
        bytes,
      }),
    ).toEqual({ ok: false, error: "file_type_invalid" });
  });

  it("rejects binary content disguised as text", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00]);

    expect(
      detectImportFileKind({
        fileName: "paper.txt",
        mimeType: "text/plain",
        bytes,
      }),
    ).toEqual({ ok: false, error: "file_type_invalid" });
  });

  it("rejects unsupported extensions and empty files", () => {
    expect(
      detectImportFileKind({
        fileName: "paper.doc",
        mimeType: "application/msword",
        bytes: buildTextFile("Question 1"),
      }),
    ).toEqual({ ok: false, error: "file_type_invalid" });

    expect(
      detectImportFileKind({
        fileName: "paper.txt",
        mimeType: "text/plain",
        bytes: new Uint8Array(),
      }),
    ).toEqual({ ok: false, error: "file_empty" });
  });

  it("rejects files above the size limit", () => {
    const bytes = new Uint8Array(IMPORT_MAX_FILE_BYTES + 1);

    expect(
      detectImportFileKind({
        fileName: "big.txt",
        mimeType: "text/plain",
        bytes,
      }),
    ).toEqual({ ok: false, error: "file_too_large" });
  });
});

describe("local extraction", () => {
  it("extracts DOCX text through mammoth without a network call", async () => {
    const bytes = await buildDocx([
      "Unit 3 Quiz",
      "1. Choose the correct answer.",
      "A. cat",
      "B. dog",
    ]);

    const result = await extractImportFile({
      fileName: "unit-3-quiz.docx",
      mimeType: DOCX_MIME,
      bytes,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.kind).toBe("docx");
    expect(result.truncated).toBe(false);
    expect(result.text).toContain("Unit 3 Quiz");
    expect(result.text).toContain("1. Choose the correct answer.");
    expect(result.text).toContain("A. cat");
    expect(result.text).toContain("B. dog");
  });

  it("extracts text-based PDF content", async () => {
    const bytes = buildTextPdf([
      "Unit 3 Quiz",
      "1. Choose the correct answer.",
      "A. cat",
      "B. dog",
    ]);

    const result = await extractImportFile({
      fileName: "unit-3-quiz.pdf",
      mimeType: "application/pdf",
      bytes,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.kind).toBe("pdf");
    expect(result.text).toContain("Unit 3 Quiz");
    expect(result.text).toContain("Choose the correct answer");
  });

  it("extracts plain UTF-8 text and normalises line endings", async () => {
    const bytes = buildTextFile("Unit 3 Quiz\r\n1. True or false?\r\n");

    const result = await extractImportFile({
      fileName: "quiz.txt",
      mimeType: "text/plain",
      bytes,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.text).toBe("Unit 3 Quiz\n1. True or false?");
  });

  it("caps extracted text at the documented character limit", async () => {
    const bytes = buildTextFile("a".repeat(IMPORT_MAX_TEXT_CHARS + 500));

    const result = await extractImportFile({
      fileName: "long.txt",
      mimeType: "text/plain",
      bytes,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(IMPORT_MAX_TEXT_CHARS);
  });

  it("reports unreadable PDFs instead of guessing", async () => {
    const result = await extractImportFile({
      fileName: "broken.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array(Buffer.from("%PDF-1.4\nnot really", "latin1")),
    });

    expect(result.ok).toBe(false);
  });
});
