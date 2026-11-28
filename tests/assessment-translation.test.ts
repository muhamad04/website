import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import StudentAssessmentLayout, {
  metadata as assessmentLayoutMetadata,
} from "@/app/(app)/student/assessments/[id]/layout";
import { assessmentsUi } from "@/lib/i18n/assessments";
import type { StudentAssessmentSection } from "@/lib/domain/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/(app)/student/assessments/actions", () => ({
  heartbeatAttemptAction: vi.fn(async () => ({ ok: true, closed: false })),
  prepareSubmissionUploadAction: vi.fn(async () => ({ ok: false })),
  saveAnswerAction: vi.fn(async () => ({ ok: true })),
  submitAttemptAction: vi.fn(async () => ({ ok: true })),
}));

const root = process.cwd();
const assessmentRouteDir = join(
  root,
  "src",
  "app",
  "(app)",
  "student",
  "assessments",
);
const assessmentIntroPage = join(assessmentRouteDir, "[id]", "page.tsx");
const assessmentLayout = join(assessmentRouteDir, "[id]", "layout.tsx");
const resultPage = join(
  assessmentRouteDir,
  "[id]",
  "attempt",
  "[attemptId]",
  "result",
  "page.tsx",
);

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

function readSourceFiles(directory: string): Array<{
  path: string;
  source: string;
}> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return readSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name)
      ? [{ path: fullPath, source: readFileSync(fullPath, "utf-8") }]
      : [];
  });
}

/** The protected shell must be the outermost element and must contain every
 * rendered fragment, including text that comes from the database. */
function expectProtectedShell(markup: string, fragments: string[]) {
  const openEnd = markup.indexOf(">");
  expect(openEnd).toBeGreaterThan(-1);

  const rootOpenTag = markup.slice(0, openEnd + 1);
  expect(rootOpenTag).toMatch(/^<div\b/);
  expect(rootOpenTag).toMatch(/\btranslate="no"/);
  expect(rootOpenTag).toMatch(/\bclass="[^"]*\bnotranslate\b/);

  const closeTag = "</div>";
  const closeStart = markup.lastIndexOf(closeTag);
  expect(closeStart).toBe(markup.length - closeTag.length);
  expect(closeStart).toBeGreaterThan(openEnd);

  const inner = markup.slice(openEnd + 1, closeStart);

  for (const fragment of fragments) {
    expect(inner, `expected protected shell to contain "${fragment}"`).toContain(
      fragment,
    );
  }
}

const sections: StudentAssessmentSection[] = [
  {
    id: "section-1",
    kind: "standard",
    title_en: "Section SENTINEL title",
    title_ar: "عنوان القسم",
    instructions_en: "Section instructions SENTINEL",
    instructions_ar: "تعليمات القسم",
    passage_en: null,
    vocabulary_en: null,
    source_en: null,
    dialogue_lines: [],
    position: 1,
    questions: [
      {
        id: "question-1",
        type: "multiple_choice",
        prompt_en: "Question prompt SENTINEL",
        prompt_ar: "نص السؤال",
        help_text_en: "Help text SENTINEL",
        help_text_ar: "نص المساعدة",
        topic_en: null,
        min_words: null,
        max_words: null,
        rubric_en: null,
        marks: 2,
        is_required: true,
        position: 1,
        options: [
          {
            id: "option-a",
            label: "A",
            text_en: "Choice ALPHA SENTINEL",
            text_ar: "الخيار الأول",
          },
          {
            id: "option-b",
            label: "B",
            text_en: "Choice BETA SENTINEL",
            text_ar: "الخيار الثاني",
          },
        ],
        left_items: [],
        right_items: [],
      },
      {
        id: "question-2",
        type: "file_upload",
        prompt_en: "File upload prompt SENTINEL",
        prompt_ar: "سؤال رفع ملف",
        help_text_en: null,
        help_text_ar: null,
        topic_en: null,
        min_words: null,
        max_words: null,
        rubric_en: null,
        marks: 5,
        is_required: false,
        position: 2,
        options: [],
        left_items: [],
        right_items: [],
      },
    ],
  },
];

async function renderRunner(strictExamMode = false): Promise<string> {
  const { AttemptRunner } = await import(
    "@/components/assessments/attempt-runner"
  );
  const serverTime = "2026-11-23T10:00:00.000Z";
  const expiresAt = "2026-11-23T11:00:00.000Z";

  return renderToStaticMarkup(
    createElement(AttemptRunner, {
      attemptId: "attempt-1",
      assessmentId: "assessment-1",
      expiresAt,
      serverTime,
      sections,
      initialAnswers: [],
      strictExamMode,
    }),
  );
}

describe("student assessment translation guard", () => {
  it("renders every /student/assessments/[id] route inside the shell", () => {
    const layoutSource = readSource(assessmentLayout);
    const markup = renderToStaticMarkup(
      createElement(StudentAssessmentLayout, null, "assessment child"),
    );

    expect(markup).toBe(
      '<div translate="no" class="notranslate">assessment child</div>',
    );
    expect(layoutSource).toContain('translate="no"');
    expect(layoutSource).toContain('className="notranslate"');

    // The intro, runner and result pages all live below this layout segment.
    for (const route of [assessmentIntroPage, resultPage]) {
      expect(readSource(route)).toContain('translate="no"');
    }
  });

  it("declares the google notranslate metadata for the assessment shell", () => {
    expect(assessmentLayoutMetadata.other).toMatchObject({
      google: "notranslate",
    });

    // Next merges `other` from the segment layout into child page metadata.
    for (const page of [assessmentIntroPage, resultPage]) {
      expect(readSource(page)).not.toMatch(/other\s*:/);
    }
  });

  it("keeps questions, choices, instructions, timer and submission text inside the protected runner", async () => {
    const markup = await renderRunner();

    expectProtectedShell(markup, [
      "Section SENTINEL title",
      "Section instructions SENTINEL",
      "Question prompt SENTINEL",
      "Help text SENTINEL",
      "Choice ALPHA SENTINEL",
      "Choice BETA SENTINEL",
      "File upload prompt SENTINEL",
      assessmentsUi.student.fileHint.en,
      assessmentsUi.actions.upload.en,
      // Countdown and submission messages. Platform chrome is English-only
      // here; only login/authentication and the main navigation are bilingual.
      "1:00:00",
      assessmentsUi.actions.submit.en,
      assessmentsUi.student.submitHint.en,
    ]);

    // Authored Arabic content and Arabic platform chrome are not rendered.
    expect(markup).not.toContain("نص السؤال");
    expect(markup).not.toContain("الخيار الأول");
    expect(markup).not.toContain("سؤال رفع ملف");
    expect(markup).not.toContain(assessmentsUi.actions.submit.ar);
  });

  it("keeps strict-mode warnings inside the protected runner", async () => {
    const markup = await renderRunner(true);

    expectProtectedShell(markup, [
      assessmentsUi.strict.runnerBanner.en,
      assessmentsUi.strict.copyBlocked.en,
    ]);
  });

  it("does not disable translation outside student assessment pages", () => {
    const unaffected = [
      join(root, "src", "app", "(app)", "teacher", "assessments"),
      join(root, "src", "app", "(app)", "teacher", "resources"),
      join(root, "src", "app", "(app)", "student", "resources"),
      join(root, "src", "app", "layout.tsx"),
    ].flatMap((target) =>
      target.endsWith(".tsx")
        ? [{ path: target, source: readSource(target) }]
        : readSourceFiles(target),
    );

    expect(unaffected.length).toBeGreaterThan(0);

    for (const file of unaffected) {
      expect(file.source, file.path).not.toContain("notranslate");
      expect(file.source, file.path).not.toMatch(/translate="no"/);
    }
  });
});
