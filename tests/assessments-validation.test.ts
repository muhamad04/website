import { describe, expect, it } from "vitest";
import {
  answerKeyForQuestion,
  createAssessmentSchema,
  createQuestionSchema,
  createSectionSchema,
  gradeAttemptSchema,
  isAutoGradableType,
  isManualOnlyType,
  prepareSubmissionUploadSchema,
  reorderQuestionsSchema,
  reorderSectionsSchema,
  saveAnswerSchema,
  setAssessmentPublishedSchema,
  updateAssessmentSchema,
  updateQuestionSchema,
} from "@/lib/validation/assessments";
import { ASSESSMENT_MAX_FILE_BYTES } from "@/lib/assessments/files";

const GRADE_ID = "11000000-0000-4000-8000-000000000001";
const ASSESSMENT_ID = "22000000-0000-4000-8000-000000000001";
const SECTION_ID = "33000000-0000-4000-8000-000000000001";
const QUESTION_ID = "44000000-0000-4000-8000-000000000001";
const ANSWER_ID = "55000000-0000-4000-8000-000000000001";
const ATTEMPT_ID = "66000000-0000-4000-8000-000000000001";

const assessmentBase = {
  type: "quiz",
  title_en: "Unit 3 quiz",
  title_ar: "اختبار الوحدة الثالثة",
  instructions_en: "Answer every question.",
  instructions_ar: "أجب عن كل سؤال.",
  grade_id: GRADE_ID,
  time_limit_minutes: "30",
  results_visibility: "after_review",
  grading_mode: "automatic",
  allow_retakes: "false",
  max_attempts: "1",
  available_from: "",
  available_until: "",
  is_published: "false",
};

const questionBase = {
  type: "short_answer",
  prompt_en: "Define photosynthesis.",
  prompt_ar: "عرّف البناء الضوئي.",
  help_text_en: "",
  help_text_ar: "",
  marks: "2",
  is_required: "true",
  grading_method: "automatic",
  explanation_en: "",
  explanation_ar: "",
};

describe("assessment validation", () => {
  it("accepts a complete quiz and coerces form strings", () => {
    const parsed = createAssessmentSchema.safeParse(assessmentBase);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.time_limit_minutes).toBe(30);
      expect(parsed.data.allow_retakes).toBe(false);
      expect(parsed.data.max_attempts).toBe(1);
      expect(parsed.data.is_published).toBe(false);
    }
  });

  it("requires a bilingual title and a grade", () => {
    expect(
      createAssessmentSchema.safeParse({
        ...assessmentBase,
        title_en: "  ",
        title_ar: "",
      }).success,
    ).toBe(false);

    expect(
      createAssessmentSchema.safeParse({
        ...assessmentBase,
        grade_id: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("rejects out-of-range time limits", () => {
    expect(
      createAssessmentSchema.safeParse({
        ...assessmentBase,
        time_limit_minutes: "0",
      }).success,
    ).toBe(false);

    expect(
      createAssessmentSchema.safeParse({
        ...assessmentBase,
        time_limit_minutes: "601",
      }).success,
    ).toBe(false);
  });

  it("keeps retake counts consistent with the retake flag", () => {
    expect(
      createAssessmentSchema.safeParse({
        ...assessmentBase,
        allow_retakes: "false",
        max_attempts: "3",
      }).success,
    ).toBe(false);

    expect(
      createAssessmentSchema.safeParse({
        ...assessmentBase,
        allow_retakes: "true",
        max_attempts: "1",
      }).success,
    ).toBe(false);

    const valid = createAssessmentSchema.safeParse({
      ...assessmentBase,
      type: "exam",
      allow_retakes: "true",
      max_attempts: "3",
    });
    expect(valid.success).toBe(true);
  });

  it("requires the closing time to follow the opening time", () => {
    expect(
      createAssessmentSchema.safeParse({
        ...assessmentBase,
        available_from: "2026-11-20T09:00:00.000Z",
        available_until: "2026-11-20T08:00:00.000Z",
      }).success,
    ).toBe(false);

    expect(
      createAssessmentSchema.safeParse({
        ...assessmentBase,
        available_from: "2026-11-20T08:00:00.000Z",
        available_until: "2026-11-20T09:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("validates update and publish payloads", () => {
    expect(
      updateAssessmentSchema.safeParse({
        ...assessmentBase,
        assessment_id: ASSESSMENT_ID,
      }).success,
    ).toBe(true);

    expect(
      updateAssessmentSchema.safeParse({
        ...assessmentBase,
        assessment_id: "nope",
      }).success,
    ).toBe(false);

    expect(
      setAssessmentPublishedSchema.safeParse({
        assessment_id: ASSESSMENT_ID,
        is_published: "true",
      }).success,
    ).toBe(true);

    expect(
      setAssessmentPublishedSchema.safeParse({
        assessment_id: ASSESSMENT_ID,
        is_published: "yes",
      }).success,
    ).toBe(false);
  });

  it("validates section payloads and reorder arrays", () => {
    expect(
      createSectionSchema.safeParse({
        assessment_id: ASSESSMENT_ID,
        title_en: "Part one",
        title_ar: "الجزء الأول",
        instructions_en: "",
        instructions_ar: "",
      }).success,
    ).toBe(true);

    expect(
      createSectionSchema.safeParse({
        assessment_id: ASSESSMENT_ID,
        title_en: "",
        title_ar: "",
      }).success,
    ).toBe(false);

    expect(
      reorderSectionsSchema.safeParse({
        assessment_id: ASSESSMENT_ID,
        section_ids: [SECTION_ID],
      }).success,
    ).toBe(true);

    expect(
      reorderSectionsSchema.safeParse({
        assessment_id: ASSESSMENT_ID,
        section_ids: [],
      }).success,
    ).toBe(false);

    expect(
      reorderQuestionsSchema.safeParse({
        section_id: SECTION_ID,
        question_ids: [QUESTION_ID],
      }).success,
    ).toBe(true);
  });
});

describe("question validation", () => {
  it("accepts a short answer with accepted alternatives", () => {
    const parsed = createQuestionSchema.safeParse({
      ...questionBase,
      section_id: SECTION_ID,
      accepted: "photosynthesis\nlight reaction",
      case_sensitive: "false",
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(answerKeyForQuestion(parsed.data)).toEqual({
        accepted: ["photosynthesis", "light reaction"],
        caseSensitive: false,
      });
    }
  });

  it("requires at least two multiple-choice options and a valid answer", () => {
    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        type: "multiple_choice",
        options: [{ text_en: "Only one" }],
        correct_index: 0,
      }).success,
    ).toBe(false);

    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        type: "multiple_choice",
        options: [{ text_en: "A" }, { text_en: "B" }],
        correct_index: 2,
      }).success,
    ).toBe(false);

    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        type: "multiple_choice",
        options: [{ text_en: "A" }, { text_en: "B" }],
        correct_index: 1,
      }).success,
    ).toBe(true);
  });

  it("validates true/false, matching and essay questions", () => {
    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        type: "true_false",
        correct_value: "true",
      }).success,
    ).toBe(true);

    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        type: "true_false",
      }).success,
    ).toBe(false);

    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        type: "matching",
        pairs: [
          { left_text_en: "A", right_text_en: "1" },
          { left_text_en: "B", right_text_en: "2" },
        ],
      }).success,
    ).toBe(true);

    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        type: "matching",
        pairs: [{ left_text_en: "A", right_text_en: "1" }],
      }).success,
    ).toBe(false);

    const essay = createQuestionSchema.safeParse({
      ...questionBase,
      section_id: SECTION_ID,
      type: "essay",
      grading_method: "manual",
    });
    expect(essay.success).toBe(true);

    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        type: "essay",
        grading_method: "automatic",
      }).success,
    ).toBe(false);
  });

  it("forces file uploads and essays to manual grading", () => {
    expect(isManualOnlyType("file_upload")).toBe(true);
    expect(isManualOnlyType("essay")).toBe(true);
    expect(isManualOnlyType("matching")).toBe(false);
    expect(isAutoGradableType("matching")).toBe(true);
    expect(isAutoGradableType("file_upload")).toBe(false);
  });

  it("rejects automatic grading for unsupported types", () => {
    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        type: "file_upload",
        grading_method: "automatic",
      }).success,
    ).toBe(false);
  });

  it("validates marks to two decimal places", () => {
    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        accepted: "x",
        marks: "0.005",
      }).success,
    ).toBe(false);

    expect(
      createQuestionSchema.safeParse({
        ...questionBase,
        section_id: SECTION_ID,
        accepted: "x",
        marks: "0.25",
      }).success,
    ).toBe(true);
  });

  it("validates updates and answer-free question ids", () => {
    expect(
      updateQuestionSchema.safeParse({
        ...questionBase,
        question_id: QUESTION_ID,
        accepted: "photosynthesis",
      }).success,
    ).toBe(true);

    expect(
      updateQuestionSchema.safeParse({
        ...questionBase,
        question_id: "bad-id",
        accepted: "photosynthesis",
      }).success,
    ).toBe(false);
  });
});

describe("attempt, answer and grading validation", () => {
  it("validates saved answers and optional file paths", () => {
    expect(
      saveAnswerSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        question_id: QUESTION_ID,
        response: { selectedOptionId: QUESTION_ID },
      }).success,
    ).toBe(true);

    expect(
      saveAnswerSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        question_id: QUESTION_ID,
        response: { text: "answer" },
        file_path: "",
      }).success,
    ).toBe(true);

    expect(
      saveAnswerSchema.safeParse({
        attempt_id: "bad",
        question_id: QUESTION_ID,
        response: {},
      }).success,
    ).toBe(false);
  });

  it("limits submission uploads to the bucket rules", () => {
    const base = {
      attempt_id: ATTEMPT_ID,
      question_id: QUESTION_ID,
      file_name: "essay.pdf",
      file_size: "1024",
      mime_type: "application/pdf",
    };

    expect(prepareSubmissionUploadSchema.safeParse(base).success).toBe(true);

    expect(
      prepareSubmissionUploadSchema.safeParse({
        ...base,
        file_size: String(ASSESSMENT_MAX_FILE_BYTES + 1),
      }).success,
    ).toBe(false);
  });

  it("validates manual grading payloads", () => {
    expect(
      gradeAttemptSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        grades: [
          {
            answer_id: ANSWER_ID,
            marks_awarded: "8.5",
            feedback_en: "Good work",
            feedback_ar: "",
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      gradeAttemptSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        grades: [],
      }).success,
    ).toBe(false);

    expect(
      gradeAttemptSchema.safeParse({
        attempt_id: ATTEMPT_ID,
        grades: [{ answer_id: ANSWER_ID, marks_awarded: "101" }],
      }).success,
    ).toBe(false);
  });
});
