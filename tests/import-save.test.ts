import { describe, expect, it } from "vitest";
import {
  answerKeyForImportedQuestion,
  buildAssessmentWrite,
  buildOptionWrites,
  buildPairWrites,
  buildQuestionWrite,
  buildSectionWrite,
  computeGradingMode,
  computeTotalMarks,
} from "@/lib/import/save";
import type {
  ImportQuestionInput,
  ImportSectionInput,
  ImportSettingsInput,
} from "@/lib/import/validation";

const GRADE_ID = "11000000-0000-4000-8000-000000000001";
const OWNER_ID = "22000000-0000-4000-8000-000000000002";
const ASSESSMENT_ID = "33000000-0000-4000-8000-000000000003";
const SECTION_ID = "44000000-0000-4000-8000-000000000004";

const settings: ImportSettingsInput = {
  type: "exam",
  gradeId: GRADE_ID,
  titleEn: "Unit 3 exam",
  instructionsEn: "Answer all questions.",
  timeLimitMinutes: 45,
  resultsVisibility: "hidden",
  allowRetakes: true,
  maxAttempts: 3,
  availableFrom: undefined,
  availableUntil: undefined,
};

function question(
  overrides: Partial<ImportQuestionInput>,
): ImportQuestionInput {
  return {
    key: "q-1",
    sourceNumber: "1",
    type: "multiple_choice",
    promptEn: "Choose the correct answer.",
    helpTextEn: "",
    marks: 2,
    confidence: "high",
    confidenceScore: 0.9,
    evidence: [],
    reviewed: true,
    gradingMethod: "automatic",
    options: [
      { text: "cat", correct: true },
      { text: "dog", correct: false },
    ],
    pairs: [],
    accepted: [],
    correctValue: null,
    explanationEn: "",
    warnings: [],
    raw: "",
    ...overrides,
  };
}

describe("imported assessment mapping", () => {
  it("always creates an unpublished assessment", () => {
    const write = buildAssessmentWrite({
      settings,
      gradingMode: "automatic",
      createdBy: OWNER_ID,
    });

    expect(write).toMatchObject({
      grade_id: GRADE_ID,
      type: "exam",
      title_en: "Unit 3 exam",
      // The legacy NOT NULL Arabic column mirrors the English title.
      title_ar: "Unit 3 exam",
      instructions_en: "Answer all questions.",
      time_limit_minutes: 45,
      results_visibility: "hidden",
      allow_retakes: true,
      max_attempts: 3,
      is_published: false,
      created_by: OWNER_ID,
    });
    expect(write.available_from).toBeNull();
    expect(write.available_until).toBeNull();
  });

  it("computes the grading mode from the reviewed questions", () => {
    const automatic = question({ gradingMethod: "automatic" });
    const manual = question({ gradingMethod: "manual" });

    expect(computeGradingMode([automatic, automatic])).toBe("automatic");
    expect(computeGradingMode([manual, manual])).toBe("manual");
    expect(computeGradingMode([automatic, manual])).toBe("mixed");
    expect(computeGradingMode([])).toBe("manual");
    expect(computeTotalMarks([automatic, { ...manual, marks: 3.5 }])).toBe(5.5);
  });

  it("maps sections in order with the English title mirrored for the legacy column", () => {
    const section: ImportSectionInput = {
      key: "s-1",
      titleEn: "Multiple choice",
      instructionsEn: "Choose one.",
      questions: [],
    };

    expect(
      buildSectionWrite({ section, assessmentId: ASSESSMENT_ID, position: 2 }),
    ).toEqual({
      assessment_id: ASSESSMENT_ID,
      title_en: "Multiple choice",
      title_ar: "Multiple choice",
      instructions_en: "Choose one.",
      position: 2,
    });
  });

  it("writes question answer keys in the existing format", () => {
    const trueFalse = question({
      type: "true_false",
      correctValue: "false",
      options: [],
    });
    const shortAnswer = question({
      type: "short_answer",
      accepted: ["played", "did play"],
      options: [],
    });
    const essay = question({ type: "essay", gradingMethod: "manual" });

    expect(answerKeyForImportedQuestion(trueFalse)).toEqual({ value: false });
    expect(answerKeyForImportedQuestion(shortAnswer)).toEqual({
      accepted: ["played", "did play"],
      caseSensitive: false,
    });
    expect(answerKeyForImportedQuestion(essay)).toBeNull();
    expect(answerKeyForImportedQuestion(question({}))).toBeNull();
  });

  it("writes question rows without inventing Arabic content", () => {
    const write = buildQuestionWrite({
      question: question({
        explanationEn: "Because it is a pet.",
      }),
      sectionId: SECTION_ID,
      position: 1,
    });

    expect(write).toMatchObject({
      section_id: SECTION_ID,
      type: "multiple_choice",
      prompt_en: "Choose the correct answer.",
      prompt_ar: null,
      marks: 2,
      is_required: true,
      position: 1,
      grading_method: "automatic",
      explanation_en: "Because it is a pet.",
      explanation_ar: null,
    });
    expect(write.correct_answer).toBeNull();
  });

  it("writes choice labels and positions", () => {
    const writes = buildOptionWrites(
      SECTION_ID,
      question({
        options: [
          { text: "cat", correct: false },
          { text: "dog", correct: true },
          { text: "bird", correct: false },
        ],
      }),
    );

    expect(writes.map((option) => option.label)).toEqual(["A", "B", "C"]);
    expect(writes.map((option) => option.is_correct)).toEqual([
      false,
      true,
      false,
    ]);
    expect(writes.map((option) => option.position)).toEqual([0, 1, 2]);
    expect(writes.every((option) => option.text_ar === null)).toBe(true);
  });

  it("writes matching pairs in order and ignores other types", () => {
    const pairs = buildPairWrites(
      SECTION_ID,
      question({
        type: "matching",
        gradingMethod: "automatic",
        options: [],
        pairs: [
          { left: "cat", right: "animal" },
          { left: "dog", right: "pet" },
        ],
      }),
    );

    expect(pairs).toEqual([
      {
        question_id: SECTION_ID,
        left_text_en: "cat",
        left_text_ar: null,
        right_text_en: "animal",
        right_text_ar: null,
        position: 0,
      },
      {
        question_id: SECTION_ID,
        left_text_en: "dog",
        left_text_ar: null,
        right_text_en: "pet",
        right_text_ar: null,
        position: 1,
      },
    ]);
    expect(buildPairWrites(SECTION_ID, question({}))).toEqual([]);
    expect(buildOptionWrites(SECTION_ID, question({ type: "essay" }))).toEqual(
      [],
    );
  });
});
