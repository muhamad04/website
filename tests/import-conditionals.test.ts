import { describe, expect, it } from "vitest";
import { extractImportFile } from "@/lib/import/extract";
import { DOCX_MIME } from "./fixtures/import-fixtures";
import { buildImportDraft } from "@/lib/import/parser";
import { gradeObjectiveAnswer } from "@/lib/assessments/grading";
import type { ImportSettings } from "@/lib/import/types";
import {
  CONDITIONALS_ANSWER_FILE_NAME,
  CONDITIONALS_QUESTIONS,
  CONDITIONALS_QUIZ_FILE_NAME,
  buildConditionalsAnswerKeyDocx,
  buildConditionalsQuizDocx,
} from "./fixtures/import-fixtures";

const settings: ImportSettings = {
  type: "quiz",
  gradeId: "11000000-0000-4000-8000-000000000001",
  titleEn: "",
  instructionsEn: "",
  timeLimitMinutes: 30,
  resultsVisibility: "after_review",
  allowRetakes: false,
  maxAttempts: 1,
  availableFrom: "",
  availableUntil: "",
};

async function buildDraft() {
  const quizBytes = await buildConditionalsQuizDocx();
  const keyBytes = await buildConditionalsAnswerKeyDocx();
  const quiz = await extractImportFile({
    fileName: CONDITIONALS_QUIZ_FILE_NAME,
    mimeType: DOCX_MIME,
    bytes: quizBytes,
  });
  const key = await extractImportFile({
    fileName: CONDITIONALS_ANSWER_FILE_NAME,
    mimeType: DOCX_MIME,
    bytes: keyBytes,
  });

  if (!quiz.ok || !key.ok) {
    throw new Error("fixtures did not extract");
  }

  return buildImportDraft({
    questionText: quiz.text,
    answerText: key.text,
    fileName: CONDITIONALS_QUIZ_FILE_NAME,
    settings,
  });
}

describe("Conditionals_Quiz.docx import", () => {
  it("parses 10 four-option MCQs worth 10 marks", async () => {
    const draft = await buildDraft();
    const questions = draft.sections.flatMap((section) => section.questions);

    expect(questions).toHaveLength(10);
    expect(draft.stats).toMatchObject({
      questionCount: 10,
      totalMarks: 10,
      matchedAnswers: 10,
      unmatchedAnswers: 0,
      warningCount: 0,
    });

    for (const [index, question] of questions.entries()) {
      expect(question.sourceNumber).toBe(CONDITIONALS_QUESTIONS[index].number);
      expect(question.type).toBe("multiple_choice");
      expect(question.confidence).toBe("high");
      expect(question.marks).toBe(1);
      expect(question.gradingMethod).toBe("automatic");
      expect(question.options).toHaveLength(4);
      expect(question.options.filter((option) => option.correct)).toHaveLength(1);
      expect(
        question.options.findIndex((option) => option.correct),
      ).toBe(CONDITIONALS_QUESTIONS[index].correctIndex);
    }
  });

  it("matches every answer-key entry and raises no false warnings", async () => {
    const draft = await buildDraft();

    expect(draft.warnings).toEqual([]);
    expect(draft.answerKey).toHaveLength(10);
    expect(draft.answerKey.every((entry) => entry.status === "matched")).toBe(
      true,
    );

    for (const [index, entry] of draft.answerKey.entries()) {
      expect(entry.questionNumber).toBe(CONDITIONALS_QUESTIONS[index].number);
      expect(entry.letter).toBe(
        String.fromCharCode(65 + CONDITIONALS_QUESTIONS[index].correctIndex),
      );
    }

    const questions = draft.sections.flatMap((section) => section.questions);

    for (const question of questions) {
      expect(question.warnings).not.toContain("answer_text_mismatch");
      expect(question.warnings).not.toContain("answer_mismatch");
      expect(question.warnings).not.toContain("ambiguous_answer");
    }
  });

  it("auto-grades the correct option and rejects a wrong one", async () => {
    const draft = await buildDraft();
    const questions = draft.sections.flatMap((section) => section.questions);

    for (const [index, question] of questions.entries()) {
      const options = question.options.map((option, optionIndex) => ({
        id: `option-${index}-${optionIndex}`,
        is_correct: option.correct,
      }));
      const correctId = options.find((option) => option.is_correct)?.id;
      const wrongId = options.find((option) => !option.is_correct)?.id;

      expect(correctId).toBeDefined();
      expect(wrongId).toBeDefined();

      const gradable = {
        id: `question-${index}`,
        type: "multiple_choice" as const,
        marks: question.marks,
        grading_method: "automatic" as const,
        correct_answer: null,
        options,
        pairs: [],
      };

      expect(
        gradeObjectiveAnswer(gradable, { selectedOptionId: correctId }),
      ).toBe(true);
      expect(
        gradeObjectiveAnswer(gradable, { selectedOptionId: wrongId }),
      ).toBe(false);
    }
  });
});
