import "server-only";

import { getOpenRouterConfig, type OpenRouterConfig } from "@/lib/env.server";
import { importAiResponseSchema } from "@/lib/import/validation";
import type {
  ImportAiQuestionSnapshot,
  ImportAiState,
  ImportAiSuggestion,
  ImportDraft,
  ImportQuestionDraft,
} from "@/lib/import/types";
import type { QuestionType } from "@/lib/domain/types";

/**
 * Optional OpenRouter assistance. Only question content from the parsed draft
 * is sent: never student names, class lists, file bytes, the answer-key file,
 * cookies, headers or the API key. The deterministic draft is always the base;
 * every suggestion must be reviewed and accepted by the teacher.
 */

const QUESTIONS_PER_REQUEST = 30;

type ChatMessage = { role: "system" | "user"; content: string };

export type ImportAiRunResult = {
  ai: ImportAiState;
  requestCount: number;
};

function snapshot(question: ImportQuestionDraft): ImportAiQuestionSnapshot {
  return {
    type: question.type,
    promptEn: question.promptEn,
    marks: question.marks,
    options: question.options.map((option) => ({ ...option })),
    correctValue: question.correctValue,
    accepted: [...question.accepted],
    explanationEn: question.explanationEn,
  };
}

function isSafeSnapshot(
  type: QuestionType,
  value: ImportAiQuestionSnapshot,
): boolean {
  if (!value.promptEn.trim()) {
    return false;
  }

  if (type === "multiple_choice") {
    const correct = value.options.filter((option) => option.correct);
    return value.options.length >= 2 && correct.length === 1;
  }

  if (type === "true_false") {
    return value.correctValue === "true" || value.correctValue === "false";
  }

  if (type === "matching") {
    return true;
  }

  return true;
}

function buildMessages(
  questions: ImportQuestionDraft[],
  settingsTitle: string,
): ChatMessage[] {
  const payload = questions.map((question) => ({
    question_number: question.sourceNumber,
    type: question.type,
    prompt: question.promptEn.slice(0, 4000),
    marks: question.marks,
    options: question.options.map((option) => ({
      text: option.text.slice(0, 500),
      correct: option.correct,
    })),
    correct_value: question.correctValue,
    accepted: question.accepted.slice(0, 20),
    explanation: question.explanationEn.slice(0, 2000),
  }));

  return [
    {
      role: "system",
      content: [
        "You check an already-parsed school assessment for parsing mistakes.",
        "Return JSON only, matching this shape:",
        '{"suggestions":[{"question_number":"1","type":"multiple_choice","prompt":"...","marks":1,"options":[{"text":"...","correct":true}],"correct_value":null,"accepted":[],"explanation":"...","reason":"why the parse is wrong"}],"warnings":[]}',
        "Only suggest a change when the deterministic parse is clearly wrong.",
        "Never invent new questions, never translate, never add Arabic text.",
        "For multiple_choice, include every option and exactly one correct option.",
        "For true_false, set correct_value to \"true\" or \"false\".",
        "For matching, leave options and correct_value empty.",
        "For short_answer, rewrite, and find_the_mistake, put accepted answers in accepted.",
        "If a question is already correct, omit it. If nothing is wrong, return empty suggestions.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        assessment_title: settingsTitle.slice(0, 200),
        questions: payload,
      }),
    },
  ];
}

async function callOpenRouter(
  config: OpenRouterConfig,
  messages: ChatMessage[],
): Promise<
  | { ok: true; body: unknown }
  | { ok: false; retryable: boolean; invalid?: boolean }
> {
  if (!config.apiKey) {
    return { ok: false, retryable: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
        "X-Title": "EnglishHub assessment importer",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxOutputTokens,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      // Only the status is logged; never the key, headers or body.
      console.error("import AI request failed", response.status);
      return { ok: false, retryable: response.status >= 500 || response.status === 429 };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = json.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      return { ok: false, retryable: false, invalid: true };
    }

    try {
      return { ok: true, body: JSON.parse(content) };
    } catch {
      return { ok: false, retryable: false, invalid: true };
    }
  } catch (error) {
    console.error(
      "import AI request failed",
      error instanceof Error ? error.name : "unknown error",
    );
    return { ok: false, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

export function isImportAiConfigured(): boolean {
  const config = getOpenRouterConfig();
  return config.enabled && Boolean(config.apiKey);
}

/**
 * Runs up to `remainingRequests` OpenRouter calls and merges the validated
 * suggestions. Any failure leaves the deterministic draft untouched.
 */
export async function runImportAi(
  draft: ImportDraft,
  remainingRequests: number,
): Promise<ImportAiRunResult> {
  const config = getOpenRouterConfig();
  const questions = draft.sections.flatMap((section) => section.questions);
  const existing = draft.ai;
  const base: ImportAiState = {
    status: "idle",
    model: config.model,
    requestCount: existing?.requestCount ?? 0,
    suggestions: existing?.suggestions ?? [],
    warnings: [],
    completedAt: null,
  };

  if (!config.enabled || !config.apiKey || remainingRequests <= 0) {
    return {
      ai: {
        ...base,
        status: "failed",
        warnings: ["ai_unavailable"],
      },
      requestCount: 0,
    };
  }

  const groups = chunk(questions, QUESTIONS_PER_REQUEST);
  const suggestions: ImportAiSuggestion[] = [];
  const warnings: ImportAiState["warnings"] = [];
  let requests = 0;
  let successful = 0;
  let invalid = false;

  for (const group of groups) {
    if (requests >= remainingRequests) {
      warnings.push("ai_partial");
      break;
    }

    const messages = buildMessages(group, draft.settings.titleEn);
    let response = await callOpenRouter(config, messages);
    requests += 1;

    if (!response.ok && response.retryable && requests < remainingRequests) {
      response = await callOpenRouter(config, messages);
      requests += 1;
    }

    if (!response.ok) {
      if (response.invalid) {
        invalid = true;
      }

      continue;
    }

    const parsed = importAiResponseSchema.safeParse(response.body);

    if (!parsed.success) {
      invalid = true;
      continue;
    }

    successful += 1;

    for (const item of parsed.data.suggestions) {
      const question = group.find(
        (candidate) => candidate.sourceNumber === item.question_number,
      );

      if (!question) {
        continue;
      }

      const before = snapshot(question);
      const after: ImportAiQuestionSnapshot = {
        type: item.type,
        promptEn: item.prompt ?? before.promptEn,
        marks: item.marks ?? before.marks,
        options:
          item.type === "multiple_choice"
            ? (item.options ?? before.options).map((option) => ({ ...option }))
            : [],
        correctValue:
          item.type === "true_false"
            ? (item.correct_value ?? before.correctValue)
            : null,
        accepted:
          item.type === "short_answer" ||
          item.type === "rewrite" ||
          item.type === "find_the_mistake"
            ? (item.accepted ?? before.accepted)
            : [],
        explanationEn: item.explanation ?? before.explanationEn,
      };

      const safe = isSafeSnapshot(item.type, after);
      const unchanged =
        before.type === after.type &&
        before.promptEn === after.promptEn &&
        before.marks === after.marks &&
        JSON.stringify(before.options) === JSON.stringify(after.options) &&
        before.correctValue === after.correctValue &&
        JSON.stringify(before.accepted) === JSON.stringify(after.accepted);

      if (unchanged) {
        continue;
      }

      suggestions.push({
        id: `${question.key}-${suggestions.length + 1}`,
        questionKey: question.key,
        sourceNumber: question.sourceNumber,
        before,
        after,
        safe,
        status: "pending",
        reason: item.reason ?? "",
      });
    }
  }

  if (invalid) {
    warnings.push("ai_invalid_response");
  }

  if (groups.length > 0 && successful === 0 && !invalid) {
    warnings.push("ai_unavailable");
  } else if (
    successful > 0 &&
    successful < groups.length &&
    !warnings.includes("ai_partial")
  ) {
    warnings.push("ai_partial");
  }

  return {
    ai: {
      ...base,
      status:
        successful === 0
          ? "failed"
          : successful < groups.length
            ? "partial"
            : "completed",
      requestCount: base.requestCount + requests,
      suggestions,
      warnings,
      completedAt: new Date().toISOString(),
    },
    requestCount: requests,
  };
}
