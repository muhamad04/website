import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractImportFile } from "@/lib/import/extract";
import {
  DOCX_MIME,
  buildDocx,
  buildTextPdf,
} from "./fixtures/import-fixtures";

const root = process.cwd();
const importLibDir = join(root, "src", "lib", "import");
const importAppDir = join(root, "src", "app", "(app)", "teacher", "assessments", "import");
const importComponentDir = join(root, "src", "components", "assessments");

function readSourceFiles(
  directory: string,
  extensions = [".ts", ".tsx"],
): Array<{ path: string; source: string }> {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap<{ path: string; source: string }>((entry) => {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return readSourceFiles(fullPath, extensions);
      }

      return extensions.some((extension) => entry.name.endsWith(extension))
        ? [{ path: fullPath, source: readFileSync(fullPath, "utf-8") }]
        : [];
    });
}

const importSources = [
  ...readSourceFiles(importLibDir),
  ...readSourceFiles(importAppDir),
  ...readSourceFiles(importComponentDir).filter((file) =>
    file.path.includes("import-"),
  ),
];

const FORBIDDEN_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "generativelanguage",
  "googleapis",
  "amazonaws",
  "azure",
  "ocr.space",
  "textract",
  "vision.googleapis",
  "api.anthropic",
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("no external AI or OCR services", () => {
  it("never names a paid provider in the importer source", () => {
    for (const file of importSources) {
      for (const provider of FORBIDDEN_PROVIDERS) {
        const pattern = new RegExp(
          `\\b${provider.replace(/\./g, "\\.")}\\b`,
          "i",
        );

        expect(
          pattern.test(file.source),
          `${file.path} mentions ${provider}`,
        ).toBe(false);
      }
    }
  });

  it("never calls out to the network during DOCX or PDF extraction", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network access is forbidden in the importer");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const docx = await buildDocx(["Unit 3 Quiz", "1. Choose one."]);
    const pdf = buildTextPdf(["Unit 3 Quiz", "1. Choose one."]);

    const docxResult = await extractImportFile({
      fileName: "quiz.docx",
      mimeType: DOCX_MIME,
      bytes: docx,
    });
    const pdfResult = await extractImportFile({
      fileName: "quiz.pdf",
      mimeType: "application/pdf",
      bytes: pdf,
    });

    expect(docxResult.ok).toBe(true);
    expect(pdfResult.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("import save boundaries", () => {
  it("hard-codes unpublished inserts and never publishes inline", () => {
    const source = readFileSync(join(importLibDir, "save.ts"), "utf-8");

    expect(source).toContain("is_published: false");
    expect(source).not.toMatch(/is_published:\s*true/);
  });

  it("keeps the import bucket private in the migration", () => {
    const sql = readFileSync(
      join(root, "supabase", "migrations", "20261116150000_assessment_import.sql"),
      "utf-8",
    );

    expect(sql).toContain("'assessment-imports'");
    expect(sql).toMatch(
      /insert into storage\.buckets[\s\S]*?false,\s*4194304/,
    );
    expect(sql).toContain(
      "alter table public.assessment_imports enable row level security",
    );
    expect(sql).toContain("import_started");
    expect(sql).toContain("import_draft_created");
    expect(sql).toContain("import_draft_edited");
    expect(sql).toContain("import_published");
  });
});
