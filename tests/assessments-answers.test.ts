import { describe, expect, it } from "vitest";
import { sanitizeAnswerResponse } from "@/lib/assessments/answers";
import type { QuestionType } from "@/lib/domain/types";

function shape(type: QuestionType, overrides: Partial<{
  optionIds: string[];
  leftIds: string[];
  rightKeys: string[];
}> = {}) {
  return {
    type,
    optionIds: overrides.optionIds ?? ["o1", "o2"],
    leftIds: overrides.leftIds ?? ["p1", "p2"],
    rightKeys: overrides.rightKeys ?? ["r1", "r2"],
  };
}

describe("answer response sanitizer", () => {
  it("keeps a known multiple-choice option and rejects forged ids", () => {
    expect(
      sanitizeAnswerResponse(shape("multiple_choice"), {
        selectedOptionId: "o2",
      }),
    ).toEqual({ ok: true, response: { selectedOptionId: "o2" } });

    expect(
      sanitizeAnswerResponse(shape("multiple_choice"), {
        selectedOptionId: "forged",
      }),
    ).toEqual({ ok: false, error: "answer_invalid" });

    expect(
      sanitizeAnswerResponse(shape("multiple_choice"), { selectedOptionId: "" }),
    ).toEqual({ ok: true, response: {} });
  });

  it("validates true/false values", () => {
    expect(
      sanitizeAnswerResponse(shape("true_false"), { value: false }),
    ).toEqual({ ok: true, response: { value: false } });

    expect(
      sanitizeAnswerResponse(shape("true_false"), { value: "false" }),
    ).toEqual({ ok: false, error: "answer_invalid" });
  });

  it("keeps only matching entries with known left ids and right keys", () => {
    expect(
      sanitizeAnswerResponse(shape("matching"), {
        pairs: { p1: "r2", p2: "r1" },
      }),
    ).toEqual({ ok: true, response: { pairs: { p1: "r2", p2: "r1" } } });

    expect(
      sanitizeAnswerResponse(shape("matching"), { pairs: { p9: "r1" } }),
    ).toEqual({ ok: false, error: "answer_invalid" });

    expect(
      sanitizeAnswerResponse(shape("matching"), { pairs: { p1: "r9" } }),
    ).toEqual({ ok: false, error: "answer_invalid" });

    expect(
      sanitizeAnswerResponse(shape("matching"), { pairs: {} }),
    ).toEqual({ ok: true, response: {} });
  });

  it("stores text answers and enforces the length limit", () => {
    expect(
      sanitizeAnswerResponse(shape("short_answer"), { text: " 42 " }),
    ).toEqual({ ok: true, response: { text: " 42 " } });

    expect(
      sanitizeAnswerResponse(shape("essay"), { text: "x".repeat(20001) }),
    ).toEqual({ ok: false, error: "answer_too_long" });

    expect(
      sanitizeAnswerResponse(shape("rewrite"), { text: 7 }),
    ).toEqual({ ok: false, error: "answer_invalid" });
  });

  it("accepts file uploads without a response payload", () => {
    expect(
      sanitizeAnswerResponse(shape("file_upload"), { anything: true }),
    ).toEqual({ ok: true, response: {} });
  });

  it("rejects an unknown question type", () => {
    expect(
      sanitizeAnswerResponse(
        shape("unknown" as QuestionType),
        { text: "x" },
      ),
    ).toEqual({ ok: false, error: "answer_invalid" });
  });
});
