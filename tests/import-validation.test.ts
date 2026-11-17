import { describe, expect, it } from "vitest";
import {
  importQuestionSchema,
  importSettingsSchema,
  importUploadMetaSchema,
  saveImportSchema,
  updateImportDraftSchema,
} from "@/lib/import/validation";

const GRADE_ID = "11000000-0000-4000-8000-000000000001";
const IMPORT_ID = "22000000-0000-4000-8000-000000000001";

const settingsBase = {
  type: "quiz",
  gradeId: GRADE_ID,
  titleEn: "Unit 3 quiz",
  titleAr: "",
  instructionsEn: "Answer all questions.",
  instructionsAr: "",
  timeLimitMinutes: "30",
  resultsVisibility: "after_review",
  allowRetakes: "false",
  maxAttempts: "1",
  availableFrom: "",
  availableUntil: "",
};

const questionBase = {
  key: "q-1",
  sourceNumber: "1",
  type: "multiple_choice",
  promptEn: "Choose the correct answer.",
  promptAr: "",
  helpTextEn: "",
  marks: "2",
  confidence: "high",
  gradingMethod: "automatic",
  options: [
    { text: "cat", correct: true },
    { text: "dog", correct: false },
  ],
  pairs: [],
  accepted: [],
  explanationEn: "",
  explanationAr: "",
  warnings: [],
  raw: "1. Choose the correct answer.",
};

describe("import upload metadata", () => {
  it("requires a grade UUID", () => {
    const result = importUploadMetaSchema.safeParse({ type: "quiz" });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("grade_required");
    }
  });

  it("accepts a quiz upload with only a grade and drops empty overrides", () => {
    const result = importUploadMetaSchema.safeParse({
      grade_id: GRADE_ID,
      type: "quiz",
      title_en: "   ",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.title_en).toBeUndefined();
    }
  });

  it("rejects an unknown assessment type", () => {
    const result = importUploadMetaSchema.safeParse({
      grade_id: GRADE_ID,
      type: "homework",
    });

    expect(result.success).toBe(false);
  });
});

describe("import settings validation", () => {
  it("accepts complete settings and coerces numeric strings", () => {
    const result = importSettingsSchema.safeParse(settingsBase);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.timeLimitMinutes).toBe(30);
      expect(result.data.maxAttempts).toBe(1);
      expect(result.data.allowRetakes).toBe(false);
    }
  });

  it("rejects a retake count that contradicts the retake flag", () => {
    const disabled = importSettingsSchema.safeParse({
      ...settingsBase,
      allowRetakes: "false",
      maxAttempts: "3",
    });
    const enabled = importSettingsSchema.safeParse({
      ...settingsBase,
      allowRetakes: "true",
      maxAttempts: "1",
    });

    expect(disabled.success).toBe(false);
    expect(enabled.success).toBe(false);
  });

  it("rejects an availability window that closes before it opens", () => {
    const result = importSettingsSchema.safeParse({
      ...settingsBase,
      availableFrom: "2026-11-20T10:00",
      availableUntil: "2026-11-19T10:00",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.message === "availability_invalid",
        ),
      ).toBe(true);
    }
  });
});

describe("imported question validation", () => {
  it("accepts each supported question type in a valid configuration", () => {
    const variants = [
      questionBase,
      {
        ...questionBase,
        type: "true_false",
        gradingMethod: "automatic",
        correctValue: "true",
        options: [],
      },
      {
        ...questionBase,
        type: "matching",
        gradingMethod: "automatic",
        options: [],
        pairs: [
          { left: "cat", right: "animal" },
          { left: "dog", right: "pet" },
        ],
      },
      {
        ...questionBase,
        type: "short_answer",
        gradingMethod: "automatic",
        options: [],
        accepted: "played\nplay",
      },
      { ...questionBase, type: "essay", gradingMethod: "manual", options: [] },
      {
        ...questionBase,
        type: "file_upload",
        gradingMethod: "manual",
        options: [],
      },
      {
        ...questionBase,
        type: "rewrite",
        gradingMethod: "automatic",
        options: [],
        accepted: ["he played"],
      },
      {
        ...questionBase,
        type: "find_the_mistake",
        gradingMethod: "automatic",
        options: [],
        accepted: ["She went"],
      },
    ];

    for (const variant of variants) {
      const result = importQuestionSchema.safeParse(variant);
      expect(result.success, variant.type).toBe(true);
    }
  });

  it("splits accepted answers typed as newline text", () => {
    const result = importQuestionSchema.safeParse({
      ...questionBase,
      type: "short_answer",
      gradingMethod: "automatic",
      options: [],
      accepted: "played\n  played  \ndid play",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.accepted).toEqual(["played", "played", "did play"]);
    }
  });

  it("forces manual grading for essays and file uploads", () => {
    for (const type of ["essay", "file_upload"]) {
      const result = importQuestionSchema.safeParse({
        ...questionBase,
        type,
        gradingMethod: "automatic",
        options: [],
      });

      expect(result.success).toBe(false);
    }
  });

  it("requires exactly one correct choice for automatic multiple choice", () => {
    const none = importQuestionSchema.safeParse({
      ...questionBase,
      options: [
        { text: "cat", correct: false },
        { text: "dog", correct: false },
      ],
    });
    const two = importQuestionSchema.safeParse({
      ...questionBase,
      options: [
        { text: "cat", correct: true },
        { text: "dog", correct: true },
      ],
    });

    expect(none.success).toBe(false);
    expect(two.success).toBe(false);
  });

  it("requires two choices and two matching pairs", () => {
    expect(
      importQuestionSchema.safeParse({
        ...questionBase,
        options: [{ text: "cat", correct: true }],
      }).success,
    ).toBe(false);

    expect(
      importQuestionSchema.safeParse({
        ...questionBase,
        type: "matching",
        gradingMethod: "manual",
        options: [],
        pairs: [{ left: "cat", right: "animal" }],
      }).success,
    ).toBe(false);
  });

  it("requires an answer for automatic true/false and text questions", () => {
    expect(
      importQuestionSchema.safeParse({
        ...questionBase,
        type: "true_false",
        options: [],
        correctValue: null,
      }).success,
    ).toBe(false);

    expect(
      importQuestionSchema.safeParse({
        ...questionBase,
        type: "short_answer",
        options: [],
        accepted: [],
      }).success,
    ).toBe(false);
  });
});

describe("import save and edit payloads", () => {
  const section = {
    key: "s-1",
    titleEn: "Questions",
    titleAr: "",
    instructionsEn: "",
    questions: [questionBase],
  };

  it("accepts a reviewed draft with at least one question", () => {
    const payload = {
      import_id: IMPORT_ID,
      settings: settingsBase,
      sections: [section],
    };

    expect(updateImportDraftSchema.safeParse(payload).success).toBe(true);
    expect(saveImportSchema.safeParse(payload).success).toBe(true);
  });

  it("refuses to save an assessment with no sections or no questions", () => {
    expect(
      saveImportSchema.safeParse({
        import_id: IMPORT_ID,
        settings: settingsBase,
        sections: [],
      }).success,
    ).toBe(false);

    expect(
      saveImportSchema.safeParse({
        import_id: IMPORT_ID,
        settings: settingsBase,
        sections: [{ ...section, questions: [] }],
      }).success,
    ).toBe(false);
  });

  it("rejects a non-UUID import id", () => {
    const result = updateImportDraftSchema.safeParse({
      import_id: "not-a-uuid",
      settings: settingsBase,
      sections: [section],
    });

    expect(result.success).toBe(false);
  });
});
