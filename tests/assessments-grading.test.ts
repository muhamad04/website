import { describe, expect, it } from "vitest";
import {
  buildAutomaticResults,
  gradeObjectiveAnswer,
  isAnswerProvided,
  normalizeAnswerText,
  type GradableAnswer,
  type GradableQuestion,
} from "@/lib/assessments/grading";

function question(
  overrides: Partial<GradableQuestion> & Pick<GradableQuestion, "type">,
): GradableQuestion {
  return {
    id: "q1",
    marks: 2,
    grading_method: "automatic",
    correct_answer: null,
    options: [],
    pairs: [],
    ...overrides,
  };
}

const optionA = { id: "option-a", is_correct: false };
const optionB = { id: "option-b", is_correct: true };

describe("automatic grading", () => {
  it("normalizes text only when case sensitivity is off", () => {
    expect(normalizeAnswerText("  Light   Reaction ")).toBe("light reaction");
    expect(normalizeAnswerText("Light Reaction", true)).toBe("Light Reaction");
  });

  it("grades multiple choice against the correct option id", () => {
    const item = question({
      type: "multiple_choice",
      options: [optionA, optionB],
    });

    expect(gradeObjectiveAnswer(item, { selectedOptionId: "option-b" })).toBe(
      true,
    );
    expect(gradeObjectiveAnswer(item, { selectedOptionId: "option-a" })).toBe(
      false,
    );
    expect(gradeObjectiveAnswer(item, {})).toBeNull();
  });

  it("grades true/false from the stored key", () => {
    const item = question({
      type: "true_false",
      correct_answer: { value: false },
    });

    expect(gradeObjectiveAnswer(item, { value: false })).toBe(true);
    expect(gradeObjectiveAnswer(item, { value: true })).toBe(false);
    expect(gradeObjectiveAnswer(item, { value: "false" })).toBeNull();
  });

  it("grades matching only when every pair matches", () => {
    const item = question({
      type: "matching",
      pairs: [
        { id: "p1", right_key: "r1" },
        { id: "p2", right_key: "r2" },
      ],
    });

    expect(
      gradeObjectiveAnswer(item, { pairs: { p1: "r1", p2: "r2" } }),
    ).toBe(true);
    expect(
      gradeObjectiveAnswer(item, { pairs: { p1: "r1", p2: "r1" } }),
    ).toBe(false);
    expect(gradeObjectiveAnswer(item, { pairs: {} })).toBe(false);
  });

  it("accepts case-insensitive text alternatives", () => {
    const item = question({
      type: "short_answer",
      correct_answer: {
        accepted: ["Photosynthesis", "light reaction"],
        caseSensitive: false,
      },
    });

    expect(gradeObjectiveAnswer(item, { text: "  LIGHT   reaction " })).toBe(
      true,
    );
    expect(gradeObjectiveAnswer(item, { text: "respiration" })).toBe(false);
    expect(gradeObjectiveAnswer(item, { text: "" })).toBeNull();
  });

  it("honours case sensitivity for rewrite and find-the-mistake", () => {
    const rewrite = question({
      type: "rewrite",
      correct_answer: { accepted: ["She goes home."], caseSensitive: true },
    });

    expect(gradeObjectiveAnswer(rewrite, { text: "She goes home." })).toBe(true);
    expect(gradeObjectiveAnswer(rewrite, { text: "she goes home." })).toBe(false);

    const mistake = question({
      type: "find_the_mistake",
      correct_answer: { accepted: ["went"], caseSensitive: false },
    });
    expect(gradeObjectiveAnswer(mistake, { text: "WENT" })).toBe(true);
  });

  it("returns null for manual questions and missing keys", () => {
    expect(
      gradeObjectiveAnswer(
        question({ type: "short_answer", grading_method: "manual" }),
        { text: "x" },
      ),
    ).toBeNull();

    expect(
      gradeObjectiveAnswer(question({ type: "essay" }), { text: "x" }),
    ).toBeNull();

    expect(
      gradeObjectiveAnswer(
        question({
          type: "multiple_choice",
          options: [{ id: "only", is_correct: false }],
        }),
        { selectedOptionId: "only" },
      ),
    ).toBeNull();
  });

  it("detects whether a question was answered", () => {
    const mc = question({ type: "multiple_choice", options: [optionA, optionB] });
    expect(isAnswerProvided(mc, { question_id: "q1", response: {}, file_path: null })).toBe(false);
    expect(
      isAnswerProvided(mc, {
        question_id: "q1",
        response: { selectedOptionId: "option-a" },
        file_path: null,
      }),
    ).toBe(true);

    const matching = question({
      type: "matching",
      pairs: [
        { id: "p1", right_key: "r1" },
        { id: "p2", right_key: "r2" },
      ],
    });
    expect(
      isAnswerProvided(matching, {
        question_id: "q1",
        response: { pairs: { p1: "r1" } },
        file_path: null,
      }),
    ).toBe(false);
    expect(
      isAnswerProvided(matching, {
        question_id: "q1",
        response: { pairs: { p1: "r1", p2: "r2" } },
        file_path: null,
      }),
    ).toBe(true);

    expect(
      isAnswerProvided(question({ type: "file_upload", grading_method: "manual" }), {
        question_id: "q1",
        response: {},
        file_path: "uid/attempt/file.pdf",
      }),
    ).toBe(true);
  });
});

describe("buildAutomaticResults", () => {
  const questions: GradableQuestion[] = [
    question({
      id: "mc",
      type: "multiple_choice",
      marks: 2,
      options: [optionA, optionB],
    }),
    question({
      id: "essay",
      type: "essay",
      marks: 10,
      grading_method: "manual",
    }),
    question({
      id: "tf",
      type: "true_false",
      marks: 1,
      correct_answer: { value: true },
    }),
    question({
      id: "unanswered",
      type: "short_answer",
      marks: 3,
      correct_answer: { accepted: ["ok"], caseSensitive: false },
    }),
  ];

  const answers: GradableAnswer[] = [
    { question_id: "mc", response: { selectedOptionId: "option-b" }, file_path: null },
    { question_id: "essay", response: { text: "My essay" }, file_path: null },
    { question_id: "tf", response: { value: false }, file_path: null },
    { question_id: "unanswered", response: {}, file_path: null },
  ];

  it("scores objective answers and skips manual and unanswered ones", () => {
    const results = buildAutomaticResults({
      gradingMode: "mixed",
      questions,
      answers,
    });

    expect(results).toEqual([
      { question_id: "mc", marks_awarded: 2, is_correct: true },
      { question_id: "tf", marks_awarded: 0, is_correct: false },
    ]);
  });

  it("skips all automatic marks when the assessment is manual", () => {
    expect(
      buildAutomaticResults({ gradingMode: "manual", questions, answers }),
    ).toEqual([]);
  });

  it("ignores answers for questions outside the assessment", () => {
    expect(
      buildAutomaticResults({
        gradingMode: "mixed",
        questions,
        answers: [
          {
            question_id: "not-in-this-assessment",
            response: { text: "x" },
            file_path: null,
          },
        ],
      }),
    ).toEqual([]);
  });
});
