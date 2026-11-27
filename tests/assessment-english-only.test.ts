import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAssessmentWrite,
  buildSectionWrite,
} from "@/lib/import/save";
import type { ImportSectionInput, ImportSettingsInput } from "@/lib/import/validation";

const root = process.cwd();
const actionsPath = join(
  root,
  "src",
  "app",
  "(app)",
  "teacher",
  "assessments",
  "actions.ts",
);
const domainTypesPath = join(root, "src", "lib", "domain", "types.ts");
const migrationsDir = join(root, "supabase", "migrations");

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);

  if (start === -1) {
    throw new Error(`missing function ${name}`);
  }

  const end = source.indexOf("\nexport ", start + 1);

  return source.slice(start, end === -1 ? undefined : end);
}

const settings: ImportSettingsInput = {
  type: "exam",
  gradeId: "11000000-0000-4000-8000-000000000001",
  titleEn: "Unit 3 exam",
  instructionsEn: "Answer all questions.",
  timeLimitMinutes: 45,
  resultsVisibility: "hidden",
  allowRetakes: true,
  maxAttempts: 3,
  availableFrom: "",
  availableUntil: "",
};

const section: ImportSectionInput = {
  key: "s-1",
  titleEn: "Multiple choice",
  instructionsEn: "Choose one.",
  kind: "standard",
  dialogueLines: [],
  questions: [],
};

describe("English-only assessment writes stay compatible with the legacy schema", () => {
  it("mirrors the English title into the NOT NULL Arabic column on insert", () => {
    const assessment = buildAssessmentWrite({
      settings,
      gradingMode: "automatic",
      createdBy: "22000000-0000-4000-8000-000000000001",
    });

    expect(assessment.title_en).toBe("Unit 3 exam");
    expect(assessment.title_ar).toBe("Unit 3 exam");
    expect(assessment.is_published).toBe(false);

    const sectionWrite = buildSectionWrite({
      section,
      assessmentId: "33000000-0000-4000-8000-000000000001",
      position: 0,
    });

    expect(sectionWrite.title_en).toBe("Multiple choice");
    expect(sectionWrite.title_ar).toBe("Multiple choice");
  });

  it("keeps the legacy Arabic columns and types in place", () => {
    const types = readSource(domainTypesPath);

    for (const column of [
      "title_ar",
      "instructions_ar",
      "prompt_ar",
      "help_text_ar",
      "explanation_ar",
      "text_ar",
      "left_text_ar",
      "right_text_ar",
    ]) {
      expect(types, column).toContain(column);
    }

    const migrations = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readSource(join(migrationsDir, file)))
      .join("\n");

    expect(migrations).not.toMatch(/drop\s+column\s+(if\s+exists\s+)?\w*_ar\b/i);
    expect(migrations).toContain("title_ar text not null");
  });
});

describe("assessment authoring is English-only without overwriting Arabic data", () => {
  const actions = readSource(actionsPath);

  it("creates assessments and sections with an English title fallback", () => {
    expect(functionBody(actions, "createAssessmentAction")).toContain(
      "title_ar: data.title_en",
    );
    expect(functionBody(actions, "createSectionAction")).toContain(
      "title_ar: parsed.data.title_en",
    );
  });

  it("never writes legacy Arabic content on update, so existing rows keep it", () => {
    expect(functionBody(actions, "updateAssessmentAction")).not.toMatch(
      /\btitle_ar\s*:/,
    );
    expect(functionBody(actions, "updateSectionAction")).not.toMatch(
      /\btitle_ar\s*:/,
    );

    const questionUpdate = functionBody(actions, "updateQuestionAction");
    expect(questionUpdate).not.toMatch(
      /\b(prompt_ar|help_text_ar|explanation_ar|text_ar|left_text_ar|right_text_ar)\s*:/,
    );
  });

  it("has no Arabic authoring inputs left in the assessment builder", () => {
    for (const file of [
      "assessment-form.tsx",
      "question-form.tsx",
      "section-manager.tsx",
      "import-review.tsx",
    ]) {
      const source = readSource(
        join(root, "src", "components", "assessments", file),
      );

      expect(source, file).not.toMatch(
        /\b(title_ar|titleAr|instructions_ar|instructionsAr|prompt_ar|promptAr|help_text_ar|explanation_ar)\b/,
      );
    }
  });
});

describe("unrelated website sections remain bilingual", () => {
  it.each([
    ["src/components/layout/app-header.tsx", /ar=\{/],
    ["src/components/resources/resource-card.tsx", /title_ar/],
    ["src/app/(app)/student/page.tsx", /\.ar\b/],
    ["src/app/(app)/teacher/page.tsx", /\.ar\b/],
  ])("%s still renders Arabic", (relativePath, pattern) => {
    expect(readSource(join(root, relativePath))).toMatch(pattern);
  });
});
