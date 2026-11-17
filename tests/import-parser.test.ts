import { describe, expect, it } from "vitest";
import {
  applyAnswerKey,
  buildImportDraft,
  parseAnswerKey,
  parseQuestionDocument,
  parseBoolean,
  splitAnswers,
} from "@/lib/import/parser";
import type { ImportSettings } from "@/lib/import/types";

const settings: ImportSettings = {
  type: "quiz",
  gradeId: "11000000-0000-4000-8000-000000000001",
  titleEn: "",
  titleAr: "",
  instructionsEn: "",
  instructionsAr: "",
  timeLimitMinutes: 30,
  resultsVisibility: "after_review",
  allowRetakes: false,
  maxAttempts: 1,
  availableFrom: "",
  availableUntil: "",
};

const PAPER = `Unit 3 Quiz
Time: 30 minutes
Instructions: Answer all questions.

Section A: Multiple choice
1. Choose the correct answer. (2 marks)
A. cat
B. dog *
C. bird

2. Choose the correct answer. (1 mark)
A. run
B. jump

Section B: True or false
3. True or false? The sun is hot. (1 mark)
4. True or false? Plants need water. (1 mark)

Section C: Matching
5. Match the words with their meanings. (4 marks)
cat - a small animal
dog - a loyal pet

Section D: Short answers
6. Write the past tense of play. ________ (1 mark)
`;

const KEY = `Answer key
1. B
2. B
3. True
4. True
5. 1-a, 2-b
6. played
`;

describe("question paper parsing", () => {
  it("detects sections, questions, choices, marks and types", () => {
    const parsed = parseQuestionDocument(PAPER, {
      fileName: "unit-3-quiz.docx",
    });

    expect(parsed.titleEn).toBe("Unit 3 Quiz");
    expect(parsed.instructionsEn).toBe("Answer all questions.");
    expect(parsed.suggestedTimeLimit).toBe(30);
    expect(parsed.sections).toHaveLength(4);
    expect(parsed.sections.map((section) => section.titleEn)).toEqual([
      "Multiple choice",
      "True or false",
      "Matching",
      "Short answers",
    ]);

    const [multipleChoice, trueFalse, matching, shortAnswer] = parsed.sections;
    const q1 = multipleChoice.questions[0];

    expect(q1.sourceNumber).toBe("1");
    expect(q1.promptEn).toBe("Choose the correct answer.");
    expect(q1.marks).toBe(2);
    expect(q1.type).toBe("multiple_choice");
    expect(q1.confidence).toBe("high");
    expect(q1.options.map((option) => option.text)).toEqual([
      "cat",
      "dog",
      "bird",
    ]);
    expect(q1.options.map((option) => option.correct)).toEqual([
      false,
      true,
      false,
    ]);

    expect(multipleChoice.questions[1].type).toBe("multiple_choice");
    expect(trueFalse.questions.map((question) => question.type)).toEqual([
      "true_false",
      "true_false",
    ]);
    expect(matching.questions[0].type).toBe("matching");
    expect(matching.questions[0].pairs).toEqual([
      { left: "cat", right: "a small animal" },
      { left: "dog", right: "a loyal pet" },
    ]);
    expect(shortAnswer.questions[0].type).toBe("short_answer");
  });

  it("applies a matching answer key without inventing answers", () => {
    const parsed = parseQuestionDocument(PAPER);
    const key = parseAnswerKey(KEY);

    expect(key.entries).toHaveLength(6);
    expect(key.entries.map((entry) => entry.status)).toEqual([
      "unmatched",
      "unmatched",
      "unmatched",
      "unmatched",
      "unmatched",
      "unmatched",
    ]);

    const applied = applyAnswerKey(parsed.sections, key.entries);
    const questions = applied.sections.flatMap((section) => section.questions);

    expect(applied.answerKey.map((entry) => entry.status)).toEqual([
      "matched",
      "matched",
      "matched",
      "matched",
      "matched",
      "matched",
    ]);
    expect(questions[0].gradingMethod).toBe("automatic");
    expect(questions[1].options[1].correct).toBe(true);
    expect(questions[2].correctValue).toBe("true");
    expect(questions[3].correctValue).toBe("true");
    expect(questions[4].gradingMethod).toBe("automatic");
    expect(questions[4].pairs).toEqual([
      { left: "cat", right: "a small animal" },
      { left: "dog", right: "a loyal pet" },
    ]);
    expect(questions[5].accepted).toEqual(["played"]);
    expect(questions[5].gradingMethod).toBe("automatic");
    expect(applied.warnings).toEqual([]);
  });

  it("builds a complete draft with statistics", () => {
    const draft = buildImportDraft({
      questionText: PAPER,
      answerText: KEY,
      fileName: "unit-3-quiz.docx",
      settings,
    });

    expect(draft.settings.titleEn).toBe("Unit 3 Quiz");
    expect(draft.settings.timeLimitMinutes).toBe(30);
    expect(draft.stats).toEqual({
      sectionCount: 4,
      questionCount: 6,
      totalMarks: 10,
      warningCount: 0,
      matchedAnswers: 6,
      unmatchedAnswers: 0,
    });
  });

  it("keeps unanswered questions on manual grading", () => {
    const parsed = parseQuestionDocument(
      "1. Choose the correct answer.\nA. cat\nB. dog\n\n2. True or false? The sun is hot.\n\n3. Write the past tense of play. ______\n",
    );
    const applied = applyAnswerKey(parsed.sections, []);
    const questions = applied.sections.flatMap((section) => section.questions);

    expect(questions).toHaveLength(3);

    for (const question of questions) {
      expect(question.gradingMethod).toBe("manual");
      expect(question.warnings).toContain("missing_answer");
    }
  });

  it("uses the file name and warns when no title is present", () => {
    const parsed = parseQuestionDocument("1. Choose one.\nA. yes\nB. no\n", {
      fileName: "unit-5-quiz.docx",
    });

    expect(parsed.warnings).toContain("no_title_detected");
    expect(parsed.titleEn.length).toBeGreaterThan(0);
  });

  it("warns and defaults marks when none are printed", () => {
    const parsed = parseQuestionDocument(
      "1. Choose the correct answer.\nA. cat\nB. dog\n",
    );
    const question = parsed.sections[0].questions[0];

    expect(question.marks).toBe(1);
    expect(question.warnings).toContain("marks_defaulted");
  });

  it("recognises numbered choices after a choose instruction", () => {
    const parsed = parseQuestionDocument(
      "1. Choose the correct answer.\n1) cat\n2) dog\n",
    );
    const question = parsed.sections[0].questions[0];

    expect(question.type).toBe("multiple_choice");
    expect(question.options.map((option) => option.text)).toEqual([
      "cat",
      "dog",
    ]);
  });

  it("infers every supported question type", () => {
    const parsed = parseQuestionDocument(`Types of questions

1. Choose the correct answer.
A. one
B. two

2. True or false? The earth is round.

3. Match the words.
big - large
small - tiny

4. Write the past tense of play. ______

5. Write an essay about your school.

6. Upload a file with your project.

7. Rewrite the sentence in the past tense.

8. Find the mistake and correct it.
`);

    const questions = parsed.sections.flatMap(
      (section) => section.questions,
    );

    expect(questions.map((question) => question.type)).toEqual([
      "multiple_choice",
      "true_false",
      "matching",
      "short_answer",
      "essay",
      "file_upload",
      "rewrite",
      "find_the_mistake",
    ]);
    expect(questions[4].gradingMethod).toBe("manual");
    expect(questions[5].gradingMethod).toBe("manual");
  });

  it("marks ambiguous question types as low confidence drafts", () => {
    const parsed = parseQuestionDocument(
      "1. What is your favourite colour?\n",
    );
    const question = parsed.sections[0].questions[0];

    expect(question.confidence).toBe("low");
    expect(question.type).toBe("short_answer");
    expect(question.warnings).toContain("low_confidence_type");
  });

  it("applies an inline answer line but flags it for checking", () => {
    const parsed = parseQuestionDocument(
      "1. Choose the correct answer.\nA. cat\nB. dog\nAnswer: B\n",
    );
    const question = parsed.sections[0].questions[0];

    expect(question.options[1].correct).toBe(true);
    expect(question.warnings).toContain("answer_key_in_question_file");
  });

  it("parses Arabic section headings without inventing translations", () => {
    const parsed = parseQuestionDocument(
      "القسم الأول: الخيارات\n1. اختر الإجابة الصحيحة.\nأ. قط\nب. كلب\n",
    );

    expect(parsed.sections[0].titleEn).toBe("الخيارات");
    expect(parsed.sections[0].titleAr).toBe("");
    expect(parsed.sections[0].questions[0].promptAr).toBe("");
  });
});

describe("answer key parsing and matching", () => {
  it("supports true/false synonyms and multiple accepted answers", () => {
    expect(parseBoolean("T")).toBe("true");
    expect(parseBoolean("صح")).toBe("true");
    expect(parseBoolean("F")).toBe("false");
    expect(parseBoolean("خطأ")).toBe("false");
    expect(splitAnswers("played; did play")).toEqual(["played", "did play"]);
    expect(splitAnswers("played / did play")).toEqual(["played", "did play"]);
  });

  it("never applies an answer to a missing question number", () => {
    const parsed = parseQuestionDocument(
      "1. Choose the correct answer.\nA. cat\nB. dog\n",
    );
    const key = parseAnswerKey("9. B");
    const applied = applyAnswerKey(parsed.sections, key.entries);

    expect(applied.answerKey[0].status).toBe("unmatched");
    expect(applied.answerKey[0].warnings).toContain("unmatched_answer");
    expect(
      applied.sections[0].questions[0].options.some(
        (option) => option.correct,
      ),
    ).toBe(false);
  });

  it("refuses duplicate answer numbers instead of picking one", () => {
    const parsed = parseQuestionDocument(
      "1. Choose the correct answer.\nA. cat\nB. dog\n",
    );
    const key = parseAnswerKey("1. A\n1. B");
    const applied = applyAnswerKey(parsed.sections, key.entries);

    expect(applied.answerKey.map((entry) => entry.status)).toEqual([
      "duplicate",
      "duplicate",
    ]);
    expect(
      applied.sections[0].questions[0].options.some(
        (option) => option.correct,
      ),
    ).toBe(false);
  });

  it("flags duplicate question numbers as ambiguous", () => {
    const parsed = parseQuestionDocument(
      "1. Choose the correct answer.\nA. cat\nB. dog\n\n1. Choose the correct answer.\nA. red\nB. blue\n",
    );
    const key = parseAnswerKey("1. A");
    const applied = applyAnswerKey(parsed.sections, key.entries);

    expect(applied.answerKey[0].status).toBe("ambiguous");
    expect(applied.answerKey[0].warnings).toContain("ambiguous_answer");
  });

  it("flags an answer letter that matches no choice", () => {
    const parsed = parseQuestionDocument(
      "1. Choose the correct answer.\nA. cat\nB. dog\n",
    );
    const key = parseAnswerKey("1. Z");
    const applied = applyAnswerKey(parsed.sections, key.entries);
    const question = applied.sections[0].questions[0];

    expect(applied.answerKey[0].warnings).toContain("answer_mismatch");
    expect(question.options.every((option) => !option.correct)).toBe(true);
    expect(question.gradingMethod).toBe("manual");
  });

  it("flags an incomplete matching mapping instead of guessing", () => {
    const parsed = parseQuestionDocument(
      "1. Match the words.\ncat - animal\ndog - pet\n",
    );
    const key = parseAnswerKey("1. 1-a");
    const applied = applyAnswerKey(parsed.sections, key.entries);

    expect(applied.answerKey[0].warnings).toContain(
      "matching_answer_not_applied",
    );
  });

  it("keeps essays and file uploads on manual grading when a key exists", () => {
    const parsed = parseQuestionDocument(
      "1. Write an essay about your school.\n2. Upload a file with your project.\n",
    );
    const key = parseAnswerKey("1. A good essay\n2. file.pdf");
    const applied = applyAnswerKey(parsed.sections, key.entries);

    expect(applied.answerKey.every((entry) => entry.status === "unmatched")).toBe(
      true,
    );
    expect(
      applied.answerKey.some((entry) =>
        entry.warnings.includes("manual_type_answer_ignored"),
      ),
    ).toBe(true);
  });

  it("treats an empty answer key as absent rather than an error", () => {
    const parsed = parseAnswerKey("");

    expect(parsed.entries).toEqual([]);
    expect(parsed.warnings).toEqual([]);
  });
});
