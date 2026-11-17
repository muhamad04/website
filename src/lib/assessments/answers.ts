import type { QuestionType } from "@/lib/domain/types";
import type { AssessmentErrorCode } from "@/lib/validation/assessments";

/**
 * Response-shape validation for student answers. Every value is re-checked
 * against the question's own options and matching keys so a forged option id or
 * right-hand key never reaches the database.
 */

export type AnswerQuestionShape = {
  type: QuestionType;
  optionIds: string[];
  leftIds: string[];
  rightKeys: string[];
};

export type SanitizedResponse =
  | { ok: true; response: Record<string, unknown> }
  | { ok: false; error: AssessmentErrorCode };

const MAX_TEXT = 20000;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function sanitizeAnswerResponse(
  question: AnswerQuestionShape,
  input: unknown,
): SanitizedResponse {
  const response = asObject(input) ?? {};

  switch (question.type) {
    case "multiple_choice": {
      const selected = response.selectedOptionId;

      if (selected === null || selected === undefined || selected === "") {
        return { ok: true, response: {} };
      }

      if (typeof selected !== "string" || !question.optionIds.includes(selected)) {
        return { ok: false, error: "answer_invalid" };
      }

      return { ok: true, response: { selectedOptionId: selected } };
    }

    case "true_false": {
      const value = response.value;

      if (value === null || value === undefined) {
        return { ok: true, response: {} };
      }

      if (typeof value !== "boolean") {
        return { ok: false, error: "answer_invalid" };
      }

      return { ok: true, response: { value } };
    }

    case "matching": {
      const pairs = asObject(response.pairs);

      if (!pairs) {
        return { ok: true, response: {} };
      }

      const clean: Record<string, string> = {};

      for (const [leftId, rightKey] of Object.entries(pairs)) {
        if (!question.leftIds.includes(leftId)) {
          return { ok: false, error: "answer_invalid" };
        }

        if (typeof rightKey !== "string" || !question.rightKeys.includes(rightKey)) {
          return { ok: false, error: "answer_invalid" };
        }

        clean[leftId] = rightKey;
      }

      return { ok: true, response: Object.keys(clean).length ? { pairs: clean } : {} };
    }

    case "file_upload":
      return { ok: true, response: {} };

    case "short_answer":
    case "rewrite":
    case "find_the_mistake":
    case "essay": {
      const text = response.text;

      if (text === null || text === undefined || text === "") {
        return { ok: true, response: {} };
      }

      if (typeof text !== "string") {
        return { ok: false, error: "answer_invalid" };
      }

      if (text.length > MAX_TEXT) {
        return { ok: false, error: "answer_too_long" };
      }

      return { ok: true, response: { text } };
    }

    default:
      return { ok: false, error: "answer_invalid" };
  }
}
