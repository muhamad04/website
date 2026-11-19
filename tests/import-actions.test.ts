import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "33000000-0000-4000-8000-000000000011", role: "teacher" } as {
    id: string;
    role: string;
  } | null,
  row: null as Record<string, unknown> | null,
  gradeExists: true,
  inserts: [] as Array<{ table: string; payload: unknown }>,
  updates: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  deletes: [] as string[],
  removed: [] as string[][],
  importMarker: [] as Array<{ id: string }>,
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("@/lib/auth/dal", () => ({
  requireTeacher: async () => {
    if (!state.actor) {
      throw new Error("redirect:/login");
    }

    return { id: state.actor.id, role: state.actor.role };
  },
}));

vi.mock("@/lib/data/imports", () => ({
  getAssessmentImport: async () => state.row,
}));

vi.mock("@/lib/data/resources", () => ({
  gradeExists: async () => state.gradeExists,
}));

vi.mock("@/lib/import/storage", () => ({
  removeImportObjects: async (paths: string[]) => {
    state.removed.push(paths);
    return true;
  },
}));

const IDS = {
  assessment: "44000000-0000-4000-8000-000000000001",
  section: "55000000-0000-4000-8000-000000000002",
  question: "66000000-0000-4000-8000-000000000003",
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        insert: (payload: unknown) => {
          state.inserts.push({ table, payload });
          return builder;
        },
        update: (payload: Record<string, unknown>) => {
          state.updates.push({ table, payload });
          return builder;
        },
        delete: () => {
          state.deletes.push(table);
          return builder;
        },
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        limit: () => builder,
        single: () => {
          if (table === "assessments") {
            return Promise.resolve({
              data: { id: IDS.assessment },
              error: null,
            });
          }

          if (table === "assessment_sections") {
            return Promise.resolve({ data: { id: IDS.section }, error: null });
          }

          if (table === "questions") {
            return Promise.resolve({ data: { id: IDS.question }, error: null });
          }

          return Promise.resolve({ data: null, error: null });
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => {
          const value =
            table === "assessment_admin_events"
              ? { data: state.importMarker, error: null }
              : { error: null };

          return Promise.resolve(value).then(resolve, reject);
        },
      };

      return builder;
    },
  }),
}));

import {
  cancelImportAction,
  saveImportedAssessmentAction,
  updateImportDraftAction,
} from "@/app/(app)/teacher/assessments/import/actions";

const IMPORT_ID = "22000000-0000-4000-8000-000000000099";

const draft = {
  settings: {
    type: "quiz",
    gradeId: "11000000-0000-4000-8000-000000000001",
    titleEn: "Unit 3 quiz",
    titleAr: "",
    instructionsEn: "",
    instructionsAr: "",
    timeLimitMinutes: 30,
    resultsVisibility: "after_review",
    allowRetakes: false,
    maxAttempts: 1,
    availableFrom: "",
    availableUntil: "",
  },
  sections: [
    {
      key: "s-1",
      titleEn: "Questions",
      titleAr: "",
      instructionsEn: "",
      questions: [
        {
          key: "q-1",
          sourceNumber: "1",
          type: "multiple_choice",
          promptEn: "Choose the correct answer.",
          promptAr: "",
          helpTextEn: "",
          marks: 2,
          confidence: "high",
          gradingMethod: "automatic",
          options: [
            { text: "cat", correct: true },
            { text: "dog", correct: false },
          ],
          pairs: [],
          accepted: [],
          correctValue: null,
          explanationEn: "",
          warnings: ["marks_defaulted"],
          raw: "1. Choose the correct answer.",
        },
      ],
    },
  ],
  answerKey: [
    {
      key: "a-1",
      number: "1",
      raw: "A",
      answers: ["A"],
      status: "matched",
      questionKey: "q-1",
      questionNumber: "1",
      warnings: [],
    },
  ],
  warnings: [{ code: "no_title_detected" }, { code: "marks_defaulted" }],
  sourceText: "1. Choose the correct answer.",
  answerText: "1. A",
  stats: {
    sectionCount: 1,
    questionCount: 1,
    totalMarks: 2,
    warningCount: 2,
    matchedAnswers: 1,
    unmatchedAnswers: 0,
  },
};

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: IMPORT_ID,
    created_by: "33000000-0000-4000-8000-000000000011",
    status: "draft",
    source_file_name: "unit-3.docx",
    source_mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    source_size: 1024,
    source_kind: "docx",
    answer_file_name: "answers.txt",
    answer_mime_type: "text/plain",
    answer_size: 32,
    answer_kind: "txt",
    source_path: `33000000-0000-4000-8000-000000000011/${IMPORT_ID}/questions-unit-3.docx`,
    answer_path: `33000000-0000-4000-8000-000000000011/${IMPORT_ID}/answers-answers.txt`,
    source_text: "1. Choose the correct answer.",
    answer_text: "1. A",
    draft,
    assessment_id: null,
    created_at: "2026-11-17T10:00:00.000Z",
    updated_at: "2026-11-17T10:00:00.000Z",
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function payload() {
  return {
    import_id: IMPORT_ID,
    settings: draft.settings,
    sections: draft.sections,
  };
}

beforeEach(() => {
  state.actor = {
    id: "33000000-0000-4000-8000-000000000011",
    role: "teacher",
  };
  state.row = makeRow();
  state.gradeExists = true;
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
  state.removed = [];
  state.importMarker = [];
});

describe("import server action permissions", () => {
  it("denies imports to anyone who is not staff", async () => {
    state.actor = null;

    await expect(updateImportDraftAction(payload())).rejects.toThrow(
      "redirect:/login",
    );

    expect(state.updates).toHaveLength(0);
    expect(state.inserts).toHaveLength(0);
  });

  it("does not let a teacher edit another teacher's import", async () => {
    state.row = makeRow({
      created_by: "33000000-0000-4000-8000-000000000099",
    });

    const result = await updateImportDraftAction(payload());

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(state.updates).toHaveLength(0);
  });

  it("does not let a teacher save an assessment into an unknown grade", async () => {
    state.gradeExists = false;

    const result = await saveImportedAssessmentAction(payload());

    expect(result.ok).toBe(false);
    expect(result.error).toBe("grade_not_found");
    expect(state.inserts).toHaveLength(0);
  });
});

describe("import server action behaviour", () => {
  it("saves an unpublished assessment with its sections, questions and options", async () => {
    const result = await saveImportedAssessmentAction(payload());

    expect(result).toEqual({
      ok: true,
      importId: IMPORT_ID,
      assessmentId: IDS.assessment,
    });

    const assessment = state.inserts.find(
      (entry) => entry.table === "assessments",
    );
    expect(assessment?.payload).toMatchObject({
      title_en: "Unit 3 quiz",
      is_published: false,
      grading_mode: "automatic",
    });

    const question = state.inserts.find(
      (entry) => entry.table === "questions",
    );
    expect(question?.payload).toMatchObject({
      type: "multiple_choice",
      prompt_en: "Choose the correct answer.",
      marks: 2,
      grading_method: "automatic",
    });

    const options = state.inserts.find(
      (entry) => entry.table === "question_options",
    );
    expect(options?.payload).toHaveLength(2);

    expect(state.removed).toHaveLength(1);
    expect(state.removed[0]).toHaveLength(2);

    const savedState = state.updates.find(
      (entry) =>
        entry.table === "assessment_imports" && entry.payload.status === "saved",
    );
    expect(savedState?.payload).toMatchObject({
      status: "saved",
      assessment_id: IDS.assessment,
      source_text: "",
      answer_text: "",
    });

    const auditActions = state.inserts
      .filter((entry) => entry.table === "assessment_admin_events")
      .map((entry) => (entry.payload as { action: string }).action);

    expect(auditActions).toEqual([
      "import_draft_edited",
      "import_draft_created",
    ]);

    expect(
      JSON.stringify(
        state.inserts.filter(
          (entry) => entry.table === "assessment_admin_events",
        ),
      ),
    ).not.toMatch(/Choose the correct answer|unit-3|answers\.txt|https?:/i);
  });

  it("persists reviewed edits and audits counts only", async () => {
    const result = await updateImportDraftAction(payload());

    expect(result).toEqual({ ok: true, importId: IMPORT_ID });
    expect(state.updates[0]?.payload.draft).toBeTruthy();

    const event = state.inserts.find(
      (entry) => entry.table === "assessment_admin_events",
    );
    expect(event?.payload).toMatchObject({ action: "import_draft_edited" });
    expect(JSON.stringify(event?.payload)).not.toMatch(
      /Choose the correct answer|A\. cat/,
    );
  });

  it("cancels an owned import and removes both private files", async () => {
    const result = await cancelImportAction({ import_id: IMPORT_ID });

    expect(result).toEqual({ ok: true, importId: IMPORT_ID });
    expect(state.removed[0]).toEqual([
      state.row?.answer_path,
      state.row?.source_path,
    ]);
    expect(state.deletes).toContain("assessment_imports");
  });
});
