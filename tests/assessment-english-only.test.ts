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

function readAllTsx(directory: string): Array<{
  relativePath: string;
  source: string;
}> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return readAllTsx(fullPath);
    }

    return /\.tsx$/.test(entry.name)
      ? [
          {
            relativePath: fullPath.slice(root.length + 1).replace(/\\/g, "/"),
            source: readFileSync(fullPath, "utf-8"),
          },
        ]
      : [];
  });
}

describe("website language policy", () => {
  it("keeps authentication and the main navigation bilingual", () => {
    for (const relativePath of [
      "src/app/login/page.tsx",
      "src/app/login/login-form.tsx",
      "src/app/set-password/page.tsx",
      "src/app/set-password/set-password-form.tsx",
      "src/app/account-pending/page.tsx",
      "src/app/account-disabled/page.tsx",
      "src/components/layout/app-header.tsx",
    ]) {
      const source = readSource(join(root, relativePath));

      expect(source, relativePath).toContain("bilingual");
      // Either inline Arabic copy or an explicit `.ar` dictionary reference.
      expect(source, relativePath).toMatch(/([\u0600-\u06FF]|\.ar\b)/);
    }
  });

  it("removes Arabic authoring inputs from English-only forms", () => {
    for (const relativePath of [
      "src/app/(app)/teacher/students/student-form.tsx",
      "src/app/(app)/teacher/staff/staff-form.tsx",
      "src/app/(app)/teacher/resources/resource-form.tsx",
      "src/app/(app)/teacher/resources/categories/category-manager.tsx",
      "src/components/assessments/manual-grading-form.tsx",
    ]) {
      const source = readSource(join(root, relativePath));

      expect(source, relativePath).not.toMatch(/dir="rtl"/);
      expect(source, relativePath).not.toMatch(/lang="ar"/);
    }
  });

  it("does not render stored Arabic columns in English-only pages", () => {
    for (const relativePath of [
      "src/app/(app)/teacher/students/page.tsx",
      "src/app/(app)/teacher/staff/page.tsx",
      "src/components/resources/resource-card.tsx",
      "src/components/resources/resource-filters-bar.tsx",
      "src/components/reporting/report-filters.tsx",
      "src/components/assessments/import-review.tsx",
    ]) {
      const source = readSource(join(root, relativePath));

      expect(source, relativePath).not.toMatch(
        /\{[^}]*\.(full_name_ar|name_ar|title_ar|description_ar|feedback_ar)\b/,
      );
    }
  });

  it("keeps metadata, captions and aria labels English-only outside auth and nav", () => {
    const approved = new Set([
      "src/components/layout/app-header.tsx",
      "src/components/layout/auth-shell.tsx",
      "src/components/layout/supabase-setup-notice.tsx",
      "src/app/login/page.tsx",
      "src/app/login/login-form.tsx",
      "src/app/set-password/page.tsx",
      "src/app/account-pending/page.tsx",
      "src/app/account-disabled/page.tsx",
    ]);

    const files = [
      ...readAllTsx(join(root, "src", "app", "(app)")),
      ...readAllTsx(join(root, "src", "components")),
      {
        relativePath: "src/app/not-found.tsx",
        source: readSource(join(root, "src", "app", "not-found.tsx")),
      },
      {
        relativePath: "src/app/error.tsx",
        source: readSource(join(root, "src", "app", "error.tsx")),
      },
    ].filter((file) => !approved.has(file.relativePath));

    for (const file of files) {
      for (const line of file.source.split("\n")) {
        if (
          /title:\s*"/.test(line) ||
          /aria-label=/.test(line) ||
          /<caption/.test(line)
        ) {
          expect(line, `${file.relativePath}: ${line.trim()}`).not.toMatch(
            /[\u0600-\u06FF]/,
          );
        }
      }
    }
  });
});
