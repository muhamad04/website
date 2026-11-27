import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  }),
}));
import {
  createQuestionSchema,
  createSectionSchema,
  deleteSectionSchema,
  isManualOnlyType,
  isWritingType,
  moveQuestionSchema,
  updateSectionSchema,
} from "@/lib/validation/assessments";
import { parseQuestionDocument } from "@/lib/import/parser";
import { buildQuestionWrite, buildSectionWrite } from "@/lib/import/save";
import type { ImportQuestionInput, ImportSectionInput } from "@/lib/import/validation";
import type { ReportingAttemptRow } from "@/lib/data/reporting";
import {
  RESULTS_CSV_HEADERS,
  resultsCsvRows,
} from "@/lib/reporting/results-csv";
import type {
  StudentAssessmentSection,
  StudentQuestion,
} from "@/lib/domain/types";

const ASSESSMENT_ID = "22000000-0000-4000-8000-000000000001";
const SECTION_ID = "33000000-0000-4000-8000-000000000001";
const QUESTION_ID = "44000000-0000-4000-8000-000000000001";

const questionBase = {
  type: "multiple_choice" as const,
  prompt_en: "Choose one.",
  marks: "1",
  grading_method: "automatic" as const,
  options: [
    { text_en: "A", is_correct: true },
    { text_en: "B", is_correct: false },
  ],
  correct_index: 0,
};

describe("reading and writing validation", () => {
  it("requires passage text for a reading group", () => {
    const missing = createSectionSchema.safeParse({
      assessment_id: ASSESSMENT_ID,
      title_en: "Reading",
      kind: "reading_passage",
    });

    expect(missing.success).toBe(false);

    const valid = createSectionSchema.safeParse({
      assessment_id: ASSESSMENT_ID,
      title_en: "Reading",
      kind: "reading_passage",
      passage_en: "A short passage about water.",
      vocabulary_en: "evaporate = turn into gas",
      source_en: "Science textbook",
    });

    expect(valid.success).toBe(true);
    expect(valid.data?.kind).toBe("reading_passage");
    expect(valid.data?.dialogue_lines).toEqual([]);
  });

  it("requires at least one dialogue line and keeps speaker separation", () => {
    const missing = createSectionSchema.safeParse({
      assessment_id: ASSESSMENT_ID,
      title_en: "Dialogue",
      kind: "dialogue",
    });

    expect(missing.success).toBe(false);

    const valid = updateSectionSchema.safeParse({
      section_id: SECTION_ID,
      title_en: "Dialogue",
      kind: "dialogue",
      dialogue_lines: [
        { speaker: "Shopkeeper", text: "Hello." },
        { speaker: "Customer", text: "Hi." },
      ],
    });

    expect(valid.success).toBe(true);
    expect(valid.data?.dialogue_lines).toHaveLength(2);
  });

  it("treats paragraph questions as manual-only writing", () => {
    expect(isManualOnlyType("paragraph")).toBe(true);
    expect(isManualOnlyType("essay")).toBe(true);
    expect(isManualOnlyType("short_answer")).toBe(false);
    expect(isWritingType("paragraph")).toBe(true);
    expect(isWritingType("essay")).toBe(true);
    expect(isWritingType("file_upload")).toBe(false);

    const automatic = createQuestionSchema.safeParse({
      ...questionBase,
      section_id: SECTION_ID,
      type: "paragraph",
      grading_method: "automatic",
    });

    expect(automatic.success).toBe(false);

    const manual = createQuestionSchema.safeParse({
      ...questionBase,
      section_id: SECTION_ID,
      type: "paragraph",
      grading_method: "manual",
      topic_en: "My favourite place",
      min_words: "100",
      max_words: "150",
      rubric_en: "Clear topic sentence; accurate grammar.",
      options: undefined,
      correct_index: undefined,
    });

    expect(manual.success).toBe(true);
    expect(manual.data?.min_words).toBe(100);
    expect(manual.data?.max_words).toBe(150);
  });

  it("rejects inverted word limits", () => {
    const parsed = createQuestionSchema.safeParse({
      ...questionBase,
      section_id: SECTION_ID,
      type: "essay",
      grading_method: "manual",
      min_words: "200",
      max_words: "100",
      options: undefined,
      correct_index: undefined,
    });

    expect(parsed.success).toBe(false);
  });

  it("validates moving questions and deleting a group with a destination", () => {
    expect(
      moveQuestionSchema.safeParse({
        question_id: QUESTION_ID,
        section_id: SECTION_ID,
      }).success,
    ).toBe(true);

    expect(
      deleteSectionSchema.safeParse({
        section_id: SECTION_ID,
        move_questions_to_section_id: ASSESSMENT_ID,
      }).success,
    ).toBe(true);
  });
});

const GROUPED_PAPER = `Reading Passage: The Water Cycle
Water evaporates from the sea. It forms clouds and falls as rain.

1. What happens first? (2 marks)
A. Rain falls
B. Water evaporates *
C. Clouds disappear

Dialogue: At the shop
Shopkeeper: Good morning. Can I help you?
Customer: Yes, I would like a notebook.

2. What does the customer want? (1 mark)
A. A pen
B. A notebook *

Write a paragraph: Describe your favourite place. (120-150 words) (5 marks)
`;

describe("importer content groups", () => {
  it("detects a reading passage and attaches following questions to it", () => {
    const parsed = parseQuestionDocument(GROUPED_PAPER);
    const reading = parsed.sections[0];

    expect(reading.kind).toBe("reading_passage");
    expect(reading.titleEn).toBe("The Water Cycle");
    expect(reading.passageEn).toContain("Water evaporates from the sea");
    expect(reading.questions).toHaveLength(1);
    expect(reading.questions[0].type).toBe("multiple_choice");
    expect(reading.questions[0].marks).toBe(2);
  });

  it("detects a dialogue and preserves speaker lines", () => {
    const parsed = parseQuestionDocument(GROUPED_PAPER);
    const dialogue = parsed.sections[1];

    expect(dialogue.kind).toBe("dialogue");
    expect(dialogue.dialogueLines).toEqual([
      { speaker: "Shopkeeper", text: "Good morning. Can I help you?" },
      { speaker: "Customer", text: "Yes, I would like a notebook." },
    ]);
    expect(dialogue.questions).toHaveLength(1);
    expect(dialogue.questions[0].marks).toBe(1);
  });

  it("detects a paragraph prompt with word limits and marks", () => {
    const parsed = parseQuestionDocument(GROUPED_PAPER);
    const writing = parsed.sections[2];
    const question = writing.questions[0];

    expect(question.type).toBe("paragraph");
    expect(question.gradingMethod).toBe("manual");
    expect(question.promptEn).toBe("Describe your favourite place.");
    expect(question.minWords).toBe(120);
    expect(question.maxWords).toBe(150);
    expect(question.marks).toBe(5);
  });

  it("warns when a reading group has no attached questions", () => {
    const parsed = parseQuestionDocument(
      `Reading Comprehension: A lonely passage
Just one paragraph of text without any questions.
`,
    );

    expect(parsed.warnings).toContain("group_without_questions");
    expect(parsed.warnings).toContain("passage_without_questions");
  });

  it("warns when dialogue lines cannot be split into speakers", () => {
    const parsed = parseQuestionDocument(
      `Conversation: At the shop
Good morning. Can I help you?
Yes, I would like a notebook.
`,
    );

    expect(parsed.sections[0].kind).toBe("dialogue");
    expect(parsed.sections[0].dialogueLines).toEqual([]);
    expect(parsed.warnings).toContain("grouping_uncertain");
  });

  it("detects an essay heading with word limits and marks", () => {
    const parsed = parseQuestionDocument(
      `Essay: Discuss the advantages of reading. (200-250 words) (10 marks)
`,
    );
    const question = parsed.sections[0].questions[0];

    expect(question.type).toBe("essay");
    expect(question.gradingMethod).toBe("manual");
    expect(question.promptEn).toBe("Discuss the advantages of reading.");
    expect(question.minWords).toBe(200);
    expect(question.maxWords).toBe(250);
    expect(question.marks).toBe(10);
  });

  it("treats a bare Writing task heading as the next line's prompt", () => {
    const parsed = parseQuestionDocument(
      `Writing task
Write a paragraph about your school. (80-100 words) (5 marks)
`,
    );
    const question = parsed.sections[0].questions[0];

    expect(question.type).toBe("paragraph");
    expect(question.gradingMethod).toBe("manual");
    expect(question.promptEn).toBe("Write a paragraph about your school.");
    expect(question.minWords).toBe(80);
    expect(question.maxWords).toBe(100);
    expect(question.marks).toBe(5);
  });

  it("keeps existing papers compatible", () => {
    const parsed = parseQuestionDocument(`Unit quiz
Section A: Multiple choice
1. Choose one. (1 mark)
A. cat *
B. dog
`);

    expect(parsed.sections[0].kind).toBe("standard");
    expect(parsed.sections[0].questions[0].type).toBe("multiple_choice");
  });
});

describe("importer writes group content", () => {
  const section: ImportSectionInput = {
    key: "s-1",
    titleEn: "Reading",
    instructionsEn: "",
    kind: "reading_passage",
    passageEn: "A passage.",
    vocabularyEn: "word = meaning",
    sourceEn: "Book",
    dialogueLines: [],
    questions: [],
  };

  it("writes passage columns only for reading groups", () => {
    const write = buildSectionWrite({
      section,
      assessmentId: ASSESSMENT_ID,
      position: 0,
    });

    expect(write).toMatchObject({
      kind: "reading_passage",
      passage_en: "A passage.",
      vocabulary_en: "word = meaning",
      source_en: "Book",
      dialogue_lines: [],
    });
  });

  it("writes paragraph limits and rubric", () => {
    const question: ImportQuestionInput = {
      type: "paragraph",
      promptEn: "Write a paragraph.",
      helpTextEn: "",
      topicEn: "My town",
      minWords: 80,
      maxWords: 120,
      rubricEn: "Topic sentence and supporting details.",
      marks: 5,
      gradingMethod: "manual",
      options: [],
      pairs: [],
      accepted: [],
      correctValue: null,
      explanationEn: "",
      warnings: [],
      confidence: "medium",
      confidenceScore: 0.5,
      evidence: [],
      reviewed: false,
    };

    const write = buildQuestionWrite({
      question,
      sectionId: SECTION_ID,
      position: 0,
    });

    expect(write).toMatchObject({
      type: "paragraph",
      topic_en: "My town",
      min_words: 80,
      max_words: 120,
      rubric_en: "Topic sentence and supporting details.",
      grading_method: "manual",
    });
  });

  it("keeps dialogue lines and clears passage-only columns", () => {
    const write = buildSectionWrite({
      section: {
        ...section,
        kind: "dialogue",
        passageEn: "stale passage",
        dialogueLines: [
          { speaker: "A", text: "Hello." },
          { speaker: "B", text: "Hi." },
        ],
      },
      assessmentId: ASSESSMENT_ID,
      position: 1,
    });

    expect(write).toMatchObject({
      kind: "dialogue",
      passage_en: null,
      vocabulary_en: null,
      dialogue_lines: [
        { speaker: "A", text: "Hello." },
        { speaker: "B", text: "Hi." },
      ],
    });
  });

  it("clears group content when a section is standard", () => {
    const write = buildSectionWrite({
      section: {
        ...section,
        kind: "standard",
        passageEn: "stale",
        vocabularyEn: "stale",
        sourceEn: "stale",
        dialogueLines: [{ speaker: "A", text: "stale" }],
      },
      assessmentId: ASSESSMENT_ID,
      position: 2,
    });

    expect(write).toMatchObject({
      kind: "standard",
      passage_en: null,
      vocabulary_en: null,
      source_en: null,
      dialogue_lines: [],
    });
  });
});

describe("results CSV writing support", () => {
  it("exports a manual grading pending column", () => {
    const row = {
      id: "attempt-1",
      assessment_id: ASSESSMENT_ID,
      student_id: "student-1",
      attempt_number: 1,
      status: "grading",
      started_at: "2026-11-27T09:00:00.000Z",
      expires_at: "2026-11-27T10:00:00.000Z",
      submitted_at: "2026-11-27T09:30:00.000Z",
      score: 4,
      max_score: 10,
      percentage: 40,
      manual_review_status: "pending",
      submission_reason: "student_submitted",
      tab_hidden_count: 0,
      focus_loss_count: 0,
      signal_count: 0,
      assessment: {
        id: ASSESSMENT_ID,
        title_en: "Writing test",
        title_ar: "اختبار الكتابة",
        type: "exam",
        grading_mode: "mixed",
        results_visibility: "after_review",
        grade_id: "grade-1",
      },
      student: {
        id: "student-1",
        full_name_en: "Student One",
        full_name_ar: null,
        student_number: "G10-001",
        grade_id: "grade-1",
        class_id: "class-1",
        grade: null,
        class: null,
      },
    } as unknown as ReportingAttemptRow;

    const rows = resultsCsvRows([row]);
    const pendingIndex = RESULTS_CSV_HEADERS.indexOf(
      "Manual grading pending",
    );

    expect(pendingIndex).toBeGreaterThan(-1);
    expect(rows[0][pendingIndex]).toBe("Yes");
  });
});

describe("student payload keeps content but never answer keys", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20261127120000_reading_writing_content.sql",
    ),
    "utf8",
  );
  const payloadStart = sql.indexOf(
    "create function public.get_student_assessment_payload",
  );
  const payloadEnd = sql.indexOf(
    "create or replace function public.student_attempt_result",
  );
  const payloadSql = sql.slice(payloadStart, payloadEnd);

  it("returns passage, dialogue and writing guidance", () => {
    expect(payloadSql).toContain("'kind', s.kind");
    expect(payloadSql).toContain("'passage_en', s.passage_en");
    expect(payloadSql).toContain("'dialogue_lines', s.dialogue_lines");
    expect(payloadSql).toContain("'min_words', q.min_words");
    expect(payloadSql).toContain("'rubric_en', q.rubric_en");
  });

  it("repeats content on the result page without answer keys", () => {
    const resultStart = sql.indexOf(
      "create or replace function public.student_attempt_result",
    );
    const resultSql = sql.slice(resultStart);

    expect(resultSql).toContain("'kind', s.kind");
    expect(resultSql).toContain("'passage_en', s.passage_en");
    expect(resultSql).toContain("'dialogue_lines', s.dialogue_lines");
    expect(resultSql).toContain("'topic_en', q.topic_en");
    expect(resultSql).toContain("'rubric_en', q.rubric_en");
    expect(resultSql).not.toContain("correct_answer");
    expect(resultSql).toContain("t.student_id = v_uid");
  });

  it("never exposes answer keys to students", () => {
    expect(payloadSql).not.toContain("correct_answer");
    expect(payloadSql).not.toContain("is_correct");
    expect(payloadSql).not.toContain("accepted_answers");
    // Matching right-hand items expose only an opaque id and display text.
    expect(payloadSql).toContain("'id', mp.right_key");
  });

  it("preserves grade isolation, ownership and strict-mode fields", () => {
    expect(payloadSql).toContain("a.grade_id = v_grade");
    expect(sql).toContain("t.student_id = v_uid");
    expect(payloadSql).toContain("'strict_exam_mode'");
    expect(payloadSql).toContain("'heartbeat_timeout_seconds'");
    expect(payloadSql).toContain("a.available_from");
    expect(payloadSql).toContain("a.available_until");
  });

  it("enforces word limits and records question moves in the database", () => {
    expect(sql).toContain("questions_word_limits_check");
    expect(sql).toContain("assessment_sections_kind_check");
    expect(sql).toContain("'question_moved'");
    expect(sql).toContain("'paragraph'");
  });
});

const passageSection: StudentAssessmentSection = {
  id: SECTION_ID,
  kind: "reading_passage",
  title_en: "Reading",
  title_ar: "",
  instructions_en: null,
  instructions_ar: null,
  passage_en: "The water cycle moves water around the planet.",
  vocabulary_en: "evaporate = turn into gas",
  source_en: "Science book",
  dialogue_lines: [],
  position: 0,
  questions: [],
};

const paragraphQuestion: StudentQuestion = {
  id: QUESTION_ID,
  type: "paragraph",
  prompt_en: "Describe the water cycle.",
  prompt_ar: null,
  help_text_en: null,
  help_text_ar: null,
  topic_en: "The water cycle",
  min_words: 50,
  max_words: 100,
  rubric_en: "Use a clear topic sentence.",
  marks: 5,
  is_required: true,
  position: 0,
  options: [],
  left_items: [],
  right_items: [],
};

describe("student runner content", () => {
  it("renders passage content, a readable paragraph area and a live word count", async () => {
    const { AttemptRunner } = await import(
      "@/components/assessments/attempt-runner"
    );

    const markup = renderToStaticMarkup(
      createElement(AttemptRunner, {
        attemptId: "attempt-1",
        assessmentId: ASSESSMENT_ID,
        expiresAt: "2026-11-27T11:00:00.000Z",
        serverTime: "2026-11-27T10:00:00.000Z",
        sections: [
          {
            ...passageSection,
            questions: [paragraphQuestion],
          },
        ],
        initialAnswers: [
          {
            question_id: QUESTION_ID,
            response: { text: "one two three" },
            file_path: null,
          },
        ],
        strictExamMode: true,
      }),
    );

    expect(markup).toContain("The water cycle moves water around the planet.");
    expect(markup).toContain("evaporate = turn into gas");
    expect(markup).toContain("The water cycle");
    expect(markup).toContain("Use a clear topic sentence.");
    expect(markup).toContain("Word count");
    expect(markup).toContain("3");
  });
});
