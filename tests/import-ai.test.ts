import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runImportAi } from "@/lib/import/ai";
import type { ImportDraft, ImportQuestionDraft } from "@/lib/import/types";

const SECRET = "sk-test-secret-key-never-log";

function question(): ImportQuestionDraft {
  return {
    key: "q-1",
    sourceNumber: "1",
    type: "multiple_choice",
    promptEn: "Choose the correct answer.",
    promptAr: "",
    helpTextEn: "",
    marks: 1,
    confidence: "low",
    confidenceScore: 0.3,
    evidence: [],
    gradingMethod: "automatic",
    options: [
      { text: "cat", correct: true },
      { text: "dog", correct: false },
    ],
    pairs: [],
    accepted: [],
    correctValue: null,
    explanationEn: "",
    warnings: ["low_confidence_type"],
    raw: "",
    reviewed: false,
  };
}

function draft(): ImportDraft {
  return {
    settings: {
      type: "quiz",
      gradeId: "11000000-0000-4000-8000-000000000001",
      titleEn: "Conditionals quiz",
      titleAr: "",
      instructionsEn: "",
      instructionsAr: "",
      timeLimitMinutes: 30,
      resultsVisibility: "after_review",
      allowRetakes: false,
      maxAttempts: 1,
      availableFrom: "",
      availableUntil: "",
    },
    sections: [
      {
        key: "s-1",
        titleEn: "Section A",
        titleAr: "",
        instructionsEn: "",
        marks: null,
        questions: [question()],
      },
    ],
    answerKey: [],
    warnings: [],
    sourceText: "Student name: Secret Student\n1. Choose the correct answer.",
    answerText: "",
    stats: {
      sectionCount: 1,
      questionCount: 1,
      totalMarks: 1,
      warningCount: 0,
      matchedAnswers: 0,
      unmatchedAnswers: 0,
      reviewCount: 1,
      parserConfidence: 0.3,
    },
  };
}

function completion(content: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

beforeEach(() => {
  vi.stubEnv("ASSESSMENT_IMPORT_AI_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", SECRET);
  vi.stubEnv("OPENROUTER_MODEL", "openrouter/free");
  vi.stubEnv("OPENROUTER_MAX_REQUESTS_PER_IMPORT", "3");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OpenRouter import assistance", () => {
  it("returns validated suggestions and never sends the API key or source text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      completion({
        suggestions: [
          {
            question_number: "1",
            type: "multiple_choice",
            prompt: "Choose one correct answer.",
            marks: 2,
            options: [
              { text: "cat", correct: true },
              { text: "dog", correct: false },
            ],
            reason: "The prompt was incomplete.",
          },
        ],
        warnings: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runImportAi(draft(), 3);

    expect(result.ai.status).toBe("completed");
    expect(result.ai.requestCount).toBe(1);
    expect(result.ai.suggestions).toHaveLength(1);
    expect(result.ai.suggestions[0].safe).toBe(true);
    expect(result.ai.suggestions[0].after.marks).toBe(2);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("openrouter.ai");
    expect(String(init.body)).not.toContain(SECRET);
    expect(String(init.body)).not.toContain("Secret Student");
    expect(JSON.stringify(result.ai)).not.toContain(SECRET);
  });

  it("rejects an invalid model response without changing the draft", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "this is not json" } }],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await runImportAi(draft(), 3);

    expect(result.ai.status).toBe("failed");
    expect(result.ai.suggestions).toEqual([]);
    expect(result.ai.warnings).toContain("ai_invalid_response");
  });

  it("rejects a structurally invalid suggestion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        completion({
          suggestions: [{ question_number: "1", type: "not_a_type" }],
        }),
      ),
    );

    const result = await runImportAi(draft(), 3);

    expect(result.ai.status).toBe("failed");
    expect(result.ai.warnings).toContain("ai_invalid_response");
  });

  it("retries one transient failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream", { status: 503 }))
      .mockResolvedValueOnce(
        completion({
          suggestions: [
            {
              question_number: "1",
              type: "multiple_choice",
              marks: 2,
              options: [
                { text: "cat", correct: true },
                { text: "dog", correct: false },
              ],
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runImportAi(draft(), 3);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ai.status).toBe("completed");
    expect(result.ai.requestCount).toBe(2);
  });

  it("never logs the key when the provider rejects the request", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })),
    );

    const result = await runImportAi(draft(), 3);
    const logged = errorSpy.mock.calls.flat().map(String).join(" ");

    expect(logged).not.toContain(SECRET);
    expect(JSON.stringify(result.ai)).not.toContain(SECRET);
    expect(result.ai.status).toBe("failed");
  });

  it("does nothing when the per-import request budget is exhausted", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runImportAi(draft(), 0);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ai.warnings).toContain("ai_unavailable");
    expect(result.requestCount).toBe(0);
  });
});
