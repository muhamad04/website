import { describe, expect, it } from "vitest";
import {
  collectImportObjectPaths,
  IMPORT_DRAFT_TTL_MS,
  IMPORT_SAVED_TTL_MS,
  isImportDueForCleanup,
} from "@/lib/import/retention";
import {
  importAuditStats,
  sanitiseImportAuditDetail,
} from "@/lib/import/audit";
import type { ImportDraft } from "@/lib/import/types";

describe("import retention", () => {
  const now = new Date("2026-11-17T12:00:00.000Z");

  it("keeps temporary drafts for 24 hours", () => {
    expect(IMPORT_DRAFT_TTL_MS).toBe(24 * 60 * 60 * 1000);

    expect(
      isImportDueForCleanup(
        {
          status: "draft",
          expires_at: new Date(now.getTime() + 60_000).toISOString(),
          updated_at: now.toISOString(),
        },
        now,
      ),
    ).toBe(false);

    expect(
      isImportDueForCleanup(
        {
          status: "draft",
          expires_at: new Date(now.getTime() - 60_000).toISOString(),
          updated_at: now.toISOString(),
        },
        now,
      ),
    ).toBe(true);
  });

  it("keeps saved rows for 7 days after their last update", () => {
    expect(IMPORT_SAVED_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);

    expect(
      isImportDueForCleanup(
        {
          status: "saved",
          expires_at: now.toISOString(),
          updated_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        },
        now,
      ),
    ).toBe(false);

    expect(
      isImportDueForCleanup(
        {
          status: "saved",
          expires_at: now.toISOString(),
          updated_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        },
        now,
      ),
    ).toBe(true);
  });

  it("removes invalid timestamps rather than keeping them forever", () => {
    expect(
      isImportDueForCleanup(
        { status: "draft", expires_at: "not-a-date", updated_at: "nope" },
        now,
      ),
    ).toBe(true);
  });

  it("removes the answer-key object before the question file", () => {
    expect(
      collectImportObjectPaths({
        status: "draft",
        expires_at: now.toISOString(),
        updated_at: now.toISOString(),
        source_path: "u/i/questions-paper.docx",
        answer_path: "u/i/answers-key.docx",
      }),
    ).toEqual(["u/i/answers-key.docx", "u/i/questions-paper.docx"]);

    expect(
      collectImportObjectPaths({
        status: "draft",
        expires_at: now.toISOString(),
        updated_at: now.toISOString(),
        source_path: null,
        answer_path: null,
      }),
    ).toEqual([]);
  });
});

describe("import audit privacy", () => {
  it("keeps only safe metadata, never content, paths or secrets", () => {
    expect(
      sanitiseImportAuditDetail({
        import_id: "import-1",
        question_count: 6,
        section_count: 2,
        has_answer_key: true,
        source_kind: "docx",
        status: "saved",
        title: "Secret exam title",
        prompt: "What is the answer?",
        answer_text: "B",
        file_name: "unit-3-answer-key.docx",
        file_size: 1024,
        model: "openrouter/free",
        ai_request_count: 2,
        source_path: "uid/import/questions.docx",
        url: "https://private.example/object",
        service_role_key: "secret",
        authorization: "Bearer secret",
      }),
    ).toEqual({
      import_id: "import-1",
      question_count: 6,
      section_count: 2,
      has_answer_key: true,
      source_kind: "docx",
      status: "saved",
      file_name: "unit-3-answer-key.docx",
      file_size: 1024,
      model: "openrouter/free",
      ai_request_count: 2,
    });
  });

  it("derives audit stats without any question content", () => {
    const draft = {
      stats: {
        sectionCount: 2,
        questionCount: 6,
        totalMarks: 10,
        warningCount: 1,
        matchedAnswers: 5,
        unmatchedAnswers: 1,
      },
      answerText: "1. B\n2. True",
    } as unknown as ImportDraft;

    expect(importAuditStats(draft)).toEqual({
      question_count: 6,
      section_count: 2,
      total_marks: 10,
      warning_count: 1,
      matched_answers: 5,
      unmatched_answers: 1,
      has_answer_key: true,
    });
  });
});
