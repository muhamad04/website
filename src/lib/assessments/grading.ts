import type {
  AcceptedAnswer,
  GradingMethod,
  GradingMode,
  QuestionType,
  TrueFalseAnswer,
} from "@/lib/domain/types";

/**
 * Pure automatic-grading helpers. They run only on the server, but they are
 * kept free of I/O so every question type can be unit-tested.
 */

export type GradableOption = { id: string; is_correct: boolean };
export type GradablePair = { id: string; right_key: string };

export type GradableQuestion = {
  id: string;
  type: QuestionType;
  marks: number;
  grading_method: GradingMethod;
  correct_answer: unknown;
  options: GradableOption[];
  pairs: GradablePair[];
};

export type GradableAnswer = {
  question_id: string;
  response: unknown;
  file_path: string | null;
};

export type AutomaticResult = {
  question_id: string;
  marks_awarded: number;
  is_correct: boolean;
};

export function normalizeAnswerText(
  value: string,
  caseSensitive = false,
): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  return caseSensitive ? collapsed : collapsed.toLocaleLowerCase("en");
}

function readAcceptedKey(value: unknown): AcceptedAnswer | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { accepted?: unknown; caseSensitive?: unknown };
  const accepted = candidate.accepted;

  if (!Array.isArray(accepted)) {
    return null;
  }

  const strings = accepted.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );

  if (strings.length === 0) {
    return null;
  }

  return {
    accepted: strings,
    caseSensitive: candidate.caseSensitive === true,
  };
}

function readBooleanKey(value: unknown): TrueFalseAnswer | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { value?: unknown };

  return typeof candidate.value === "boolean"
    ? { value: candidate.value }
    : null;
}

function readPairs(response: unknown): Record<string, string> {
  if (!response || typeof response !== "object") {
    return {};
  }

  const candidate = (response as { pairs?: unknown }).pairs;

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {};
  }

  const pairs: Record<string, string> = {};

  for (const [leftId, rightKey] of Object.entries(candidate)) {
    if (typeof rightKey === "string" && rightKey !== "") {
      pairs[leftId] = rightKey;
    }
  }

  return pairs;
}

function readText(response: unknown): string {
  if (!response || typeof response !== "object") {
    return "";
  }

  const candidate = (response as { text?: unknown }).text;
  return typeof candidate === "string" ? candidate : "";
}

/** Whether the student actually supplied something for this question. */
export function isAnswerProvided(
  question: GradableQuestion,
  answer: GradableAnswer | undefined,
): boolean {
  if (!answer) {
    return false;
  }

  if (question.type === "file_upload") {
    return Boolean(answer.file_path);
  }

  const response = answer.response;

  if (!response || typeof response !== "object") {
    return false;
  }

  if (question.type === "multiple_choice") {
    const selected = (response as { selectedOptionId?: unknown })
      .selectedOptionId;
    return typeof selected === "string" && selected !== "";
  }

  if (question.type === "true_false") {
    return typeof (response as { value?: unknown }).value === "boolean";
  }

  if (question.type === "matching") {
    const pairs = readPairs(response);
    return (
      question.pairs.length > 0 &&
      question.pairs.every((pair) => Boolean(pairs[pair.id]))
    );
  }

  if (question.type === "essay") {
    return readText(response).trim() !== "";
  }

  return readText(response).trim() !== "";
}

/**
 * Grades one objective question. Returns null when the question cannot be
 * graded automatically (manual question, missing key, unsupported type).
 */
export function gradeObjectiveAnswer(
  question: GradableQuestion,
  response: unknown,
): boolean | null {
  if (question.grading_method !== "automatic") {
    return null;
  }

  switch (question.type) {
    case "multiple_choice": {
      const selected =
        response && typeof response === "object"
          ? (response as { selectedOptionId?: unknown }).selectedOptionId
          : undefined;

      if (typeof selected !== "string" || selected === "") {
        return null;
      }

      const correct = question.options.find((option) => option.is_correct);

      if (!correct) {
        return null;
      }

      return selected === correct.id;
    }

    case "true_false": {
      const key = readBooleanKey(question.correct_answer);
      const value =
        response && typeof response === "object"
          ? (response as { value?: unknown }).value
          : undefined;

      if (!key || typeof value !== "boolean") {
        return null;
      }

      return value === key.value;
    }

    case "matching": {
      if (question.pairs.length === 0) {
        return null;
      }

      const submitted = readPairs(response);

      return question.pairs.every(
        (pair) => submitted[pair.id] === pair.right_key,
      );
    }

    case "short_answer":
    case "rewrite":
    case "find_the_mistake": {
      const key = readAcceptedKey(question.correct_answer);
      const text = readText(response);

      if (!key || text.trim() === "") {
        return null;
      }

      const normalized = normalizeAnswerText(text, key.caseSensitive);

      return key.accepted.some(
        (accepted) =>
          normalizeAnswerText(accepted, key.caseSensitive) === normalized,
      );
    }

    default:
      return null;
  }
}

/**
 * Builds the array consumed by public.finalize_attempt(). Manual questions are
 * deliberately omitted so the database keeps them pending for a teacher.
 */
export function buildAutomaticResults(options: {
  gradingMode: GradingMode;
  questions: GradableQuestion[];
  answers: GradableAnswer[];
}): AutomaticResult[] {
  const byId = new Map(options.questions.map((question) => [question.id, question]));
  const results: AutomaticResult[] = [];

  for (const answer of options.answers) {
    const question = byId.get(answer.question_id);

    if (!question) {
      continue;
    }

    if (options.gradingMode === "manual") {
      continue;
    }

    if (question.grading_method === "manual") {
      continue;
    }

    if (!isAnswerProvided(question, answer)) {
      continue;
    }

    const correct = gradeObjectiveAnswer(question, answer.response);

    if (correct === null) {
      continue;
    }

    results.push({
      question_id: question.id,
      marks_awarded: correct ? question.marks : 0,
      is_correct: correct,
    });
  }

  return results;
}
