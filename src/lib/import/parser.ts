import type { QuestionType } from "@/lib/domain/types";
import { titleFromFileName } from "@/lib/import/files";
import type {
  ImportAnswerEntry,
  ImportAnswerStatus,
  ImportConfidence,
  ImportDraft,
  ImportOptionDraft,
  ImportPairDraft,
  ImportQuestionDraft,
  ImportSectionDraft,
  ImportSettings,
  ImportWarning,
  ImportWarningCode,
} from "@/lib/import/types";

/**
 * Deterministic, offline question-paper parser.
 *
 * It never calls a model or a network service. Recognised input is deliberately
 * conservative: every uncertain decision becomes an editable draft plus a
 * warning, and every missing key defaults that question to manual grading.
 */

type RawOption = ImportOptionDraft;

type RawPair = ImportPairDraft;

type RawQuestion = {
  sourceNumber: string;
  lines: string[];
  options: RawOption[];
  pairs: RawPair[];
  warnings: ImportWarningCode[];
  inlineAnswer: string;
  explanation: string;
};

type RawSection = {
  titleEn: string;
  instructions: string[];
  explicit: boolean;
  questions: ImportQuestionDraft[];
};

export type ParsedQuestionDocument = {
  titleEn: string;
  instructionsEn: string;
  suggestedTimeLimit: number | null;
  sections: ImportSectionDraft[];
  warnings: ImportWarningCode[];
};

export type ParsedAnswerKey = {
  entries: ImportAnswerEntry[];
  warnings: ImportWarningCode[];
};

const QUESTION_MARKER =
  /^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.)\]:\-]\s*(.+)$/i;
const QUESTION_MARKER_SPACE = /^(?:Q(?:uestion)?\s*)?(\d{1,3})\s{1,3}(.+)$/i;
const LETTER_OPTION = /^\(?([A-Ha-h])\)?\s*[.)\]:\-]\s+(.+)$/;
const NUMBERED_OPTION = /^\(?(\d{1,2})\)\s+(.+)$/;
const SECTION_MARKER =
  /^(?:section|part)\s+([A-Za-z0-9\u0600-\u06ff]+)\s*(?:[:.\-–—]\s*)?(.*)$/i;
const SECTION_MARKER_AR = /^(?:القسم|الجزء)\s+([^\s:：.\-–—]+)\s*(?:[:.\-–—]\s*)?(.*)$/;
const METADATA_LINE =
  /^(?:name|student name|class|date|time|time allowed|duration|total marks|total|marks|grade|subject|teacher|school|اسم|الصف|الفصل|التاريخ|الوقت|الزمن|الدرجة الكلية|المادة|المعلم)\s*[:：]/i;
const INSTRUCTION_START =
  /^(?:instructions?|answer|choose|select|read|write|complete|match|fill|circle|underline|true|false|total|time|name|class|date|grade|subject|teacher|student|note|تعليمات|أجب|اختر|اقرأ|اكتب|أكمل|طابق|املأ|اسم|الصف|المادة|التاريخ|الوقت|ملاحظة)/i;
const MATCHING_CUE =
  /(?:match|column\s*a|column\s*b|مطابق|وصل|طابق)/i;
const MCQ_CUE = /(?:choose|select|pick|circle|اختر)/i;
const TRUE_FALSE_CUE =
  /(?:true\s*\/\s*false|true\s+or\s+false|true\s*-\s*false|صح\s*\/\s*خطأ|صح\s+أم\s+خطأ|صحيح\s*\/\s*خطأ)/i;
const FILE_UPLOAD_CUE =
  /(?:upload|attach(?:ment)?|submit (?:a|your) file|ارفع ملف|ملف مرفق|أرفق)/i;
const ESSAY_CUE =
  /(?:write an essay|write a paragraph|in your own words|discuss|composition|essay|article of|مقال|اكتب فقرة|اكتب مقال|عبّر)/i;
const REWRITE_CUE = /(?:rewrite|re-write|أعد كتابة|أعد صياغة|إعادة صياغة)/i;
const FIND_MISTAKE_CUE =
  /(?:find (?:the|and correct the) mistake|correct the mistake|اكتشف الخطأ|صحح الخطأ|حدد الخطأ)/i;
const ANSWER_LINE =
  /^(?:answer|correct answer|answer key|key|الإجابة|الجواب)\s*[:：\-–—]\s*(.+)$/i;
const EXPLANATION_LINE =
  /^(?:explanation|reason|التفسير|التوضيح)\s*[:：\-–—]\s*(.+)$/i;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normaliseLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, "").replace(/^\s+/g, ""))
    .filter((line, index, all) => line !== "" || all[index - 1] !== "");
}

function shortHash(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function isSectionHeading(line: string): boolean {
  if (SECTION_MARKER.test(line) || SECTION_MARKER_AR.test(line)) {
    return true;
  }

  if (line.length > 80 || line.length < 4) {
    return false;
  }

  if (QUESTION_MARKER.test(line) || LETTER_OPTION.test(line)) {
    return false;
  }

  if (INSTRUCTION_START.test(line)) {
    return false;
  }

  const letters = line.match(/[A-Za-z]/g)?.length ?? 0;
  const hasLower = /[a-z]/.test(line);
  const endsLikeSentence = /[?!,;]$/.test(line);
  const endsWithColon = /:$/.test(line);

  if (letters >= 4 && !hasLower && !endsLikeSentence) {
    return true;
  }

  return endsWithColon && line.length <= 60;
}

function sectionTitleFromLine(line: string): string {
  const arabic = line.match(SECTION_MARKER_AR);
  if (arabic) {
    const rest = arabic[2]?.trim() ?? "";
    return rest || `${arabic[1]}`;
  }

  const english = line.match(SECTION_MARKER);
  if (english) {
    const rest = english[2]?.trim() ?? "";
    return rest || `Section ${english[1]}`;
  }

  return line.replace(/:\s*$/, "").trim() || "Questions";
}

function isQuestionStart(line: string): { number: string; text: string } | null {
  const marked = line.match(QUESTION_MARKER) ?? line.match(QUESTION_MARKER_SPACE);

  if (!marked) {
    return null;
  }

  const text = marked[2]?.trim() ?? "";

  if (!text) {
    return null;
  }

  return { number: marked[1], text };
}

function parseOptionLine(
  line: string,
): { label: string; text: string; correct: boolean } | null {
  const match = line.match(LETTER_OPTION);

  if (!match) {
    return null;
  }

  let text = match[2].trim();

  if (!text) {
    return null;
  }

  let correct = false;
  const marked = text.match(/(?:\s*[\*✓✔]|\s*\((?:correct|answer)\)|\s*\[(?:correct|answer)\])\s*$/i);

  if (marked) {
    correct = true;
    text = text.slice(0, marked.index).trim();
  }

  return { label: match[1].toUpperCase(), text, correct: correct && text !== "" };
}

function hasChooseCue(question: RawQuestion): boolean {
  return MCQ_CUE.test(question.lines.join(" "));
}

function isNumberedChoice(line: string, question: RawQuestion): boolean {
  const match = line.match(NUMBERED_OPTION);

  if (!match || !hasChooseCue(question)) {
    return false;
  }

  const number = Number(match[1]);
  const base = Number(question.sourceNumber);

  return (
    question.options.length > 0 ||
    number === base ||
    number === base + 1
  );
}

function stripLabel(value: string): string {
  return value
    .replace(/^\(?([A-Za-z0-9\u0600-\u06ff]{1,3})\)?[.)]\s+/, "")
    .trim();
}

function parsePairLine(line: string): RawPair | null {
  const withoutLeftLabel = stripLabel(line);

  if (!withoutLeftLabel) {
    return null;
  }

  const separators: Array<RegExp | string> = [
    /\t+/,
    /\s{3,}/,
    /\s+[–—]\s+/,
    /\s+-\s+/,
    /\s*\|\s*/,
    /\s*=\s*/,
  ];

  for (const separator of separators) {
    const index =
      separator instanceof RegExp
        ? withoutLeftLabel.search(separator)
        : withoutLeftLabel.indexOf(separator);

    if (index <= 0) {
      continue;
    }

    const left = withoutLeftLabel.slice(0, index).trim();
    const right = stripLabel(withoutLeftLabel.slice(index).replace(separator, " "));

    if (left && right && left.length <= 200 && right.length <= 200) {
      return { left, right };
    }
  }

  const colon = withoutLeftLabel.match(/^(.{1,60}?)\s*[:：]\s+(.+)$/);

  if (colon) {
    const left = colon[1].trim();
    const right = stripLabel(colon[2]);

    if (left && right) {
      return { left, right };
    }
  }

  return null;
}

function isMatchingQuestion(question: RawQuestion): boolean {
  if (question.pairs.length > 0) {
    return true;
  }

  return MATCHING_CUE.test(question.lines.join(" "));
}

function extractMarks(text: string): { text: string; marks: number | null } {
  let result = text;
  let marks: number | null = null;

  const patterns = [
    /(?:\(|\[)\s*(\d+(?:\.\d+)?)\s*(?:marks?|points?|درجات?|درجة)\s*(?:\)|\])/i,
    /[-–—]\s*(\d+(?:\.\d+)?)\s*(?:marks?|points?)\s*$/im,
    /(?:^|\s)\[\s*(\d+(?:\.\d+)?)\s*\]\s*$/m,
  ];

  for (const pattern of patterns) {
    const match = result.match(pattern);

    if (!match) {
      continue;
    }

    const value = Number(match[1]);

    if (Number.isFinite(value) && value >= 0.01 && value <= 100) {
      marks = value;
      result = result.replace(match[0], " ");
      break;
    }
  }

  return { text: result.replace(/[ \t]{2,}/g, " ").trim(), marks };
}

function parseBoolean(value: string): "true" | "false" | null {
  const normalised = value.trim().toLowerCase();

  if (["true", "t", "yes", "y", "1", "صح", "صحيح"].includes(normalised)) {
    return "true";
  }

  if (["false", "f", "no", "n", "0", "خطأ", "غلط"].includes(normalised)) {
    return "false";
  }

  return null;
}

function normaliseAccepted(value: string): string[] {
  const cleaned = value.replace(/^["'“”]+|["'“”]+$/g, "").trim();

  if (!cleaned) {
    return [];
  }

  return unique(
    cleaned
      .split(/\s*[;|]\s*|\s+\/\s+|\s+or\s+/i)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function inferType(
  question: RawQuestion,
  prompt: string,
): { type: QuestionType; confidence: ImportConfidence; warnings: ImportWarningCode[] } {
  const warnings: ImportWarningCode[] = [];

  if (isMatchingQuestion(question)) {
    if (question.pairs.length < 2) {
      warnings.push("matching_incomplete");
      return { type: "matching", confidence: "low", warnings };
    }

    return { type: "matching", confidence: "medium", warnings };
  }

  if (question.options.length >= 2) {
    return { type: "multiple_choice", confidence: "high", warnings };
  }

  if (MCQ_CUE.test(prompt)) {
    warnings.push("multiple_choice_missing_options");
    return { type: "multiple_choice", confidence: "low", warnings };
  }

  if (TRUE_FALSE_CUE.test(prompt)) {
    return { type: "true_false", confidence: "high", warnings };
  }

  if (FILE_UPLOAD_CUE.test(prompt)) {
    return { type: "file_upload", confidence: "medium", warnings };
  }

  if (FIND_MISTAKE_CUE.test(prompt)) {
    return { type: "find_the_mistake", confidence: "medium", warnings };
  }

  if (REWRITE_CUE.test(prompt)) {
    return { type: "rewrite", confidence: "medium", warnings };
  }

  if (ESSAY_CUE.test(prompt)) {
    return { type: "essay", confidence: "medium", warnings };
  }

  if (/_{2,}/.test(prompt)) {
    return { type: "short_answer", confidence: "high", warnings };
  }

  warnings.push("low_confidence_type");
  return { type: "short_answer", confidence: "low", warnings };
}

function applyInlineAnswer(
  draft: ImportQuestionDraft,
  answer: string,
): ImportWarningCode[] {
  const warnings: ImportWarningCode[] = ["answer_key_in_question_file"];
  const token = answer.trim();

  if (!token) {
    return warnings;
  }

  if (draft.type === "multiple_choice") {
    const choice = token.match(/^\(?([A-Ha-h])\)?[.)]?$/);

    if (choice) {
      const label = choice[1].toUpperCase();
      const index = draft.options.findIndex(
        (_, optionIndex) => String.fromCharCode(65 + optionIndex) === label,
      );

      if (index >= 0) {
        draft.options = draft.options.map((option, optionIndex) => ({
          ...option,
          correct: optionIndex === index,
        }));
        draft.gradingMethod = "automatic";
      } else {
        warnings.push("answer_mismatch");
      }
    } else {
      const index = draft.options.findIndex(
        (option) => option.text.toLowerCase() === token.toLowerCase(),
      );

      if (index >= 0) {
        draft.options = draft.options.map((option, optionIndex) => ({
          ...option,
          correct: optionIndex === index,
        }));
        draft.gradingMethod = "automatic";
      } else {
        warnings.push("answer_mismatch");
      }
    }
  } else if (draft.type === "true_false") {
    const value = parseBoolean(token);

    if (value) {
      draft.correctValue = value;
      draft.gradingMethod = "automatic";
    } else {
      warnings.push("answer_mismatch");
    }
  } else if (
    draft.type === "short_answer" ||
    draft.type === "rewrite" ||
    draft.type === "find_the_mistake"
  ) {
    draft.accepted = unique([...draft.accepted, ...normaliseAccepted(token)]);
    draft.gradingMethod = draft.accepted.length > 0 ? "automatic" : "manual";
  } else if (draft.type === "matching") {
    warnings.push("matching_answer_not_applied");
  }

  return warnings;
}

function buildQuestion(raw: RawQuestion, index: number): ImportQuestionDraft {
  const key = `q-${index + 1}-${shortHash(`${raw.sourceNumber}:${raw.lines.join("|")}`)}`;
  let prompt = raw.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const marks = extractMarks(prompt);
  prompt = marks.text;

  const warnings = [...raw.warnings];
  if (marks.marks === null) {
    warnings.push("marks_defaulted");
  }

  const inferred = inferType(raw, prompt);
  warnings.push(...inferred.warnings);

  const options = raw.options.map((option) => ({ ...option }));
  const correctCount = options.filter((option) => option.correct).length;

  if (correctCount > 1) {
    warnings.push("ambiguous_answer");
  }

  if (
    inferred.type === "multiple_choice" &&
    options.length < 2
  ) {
    warnings.push("multiple_choice_missing_options");
  }

  if (inferred.type === "matching" && raw.pairs.length < 2) {
    warnings.push("matching_incomplete");
  }

  const draft: ImportQuestionDraft = {
    key,
    sourceNumber: raw.sourceNumber,
    type: inferred.type,
    promptEn: prompt,
    promptAr: "",
    helpTextEn: "",
    marks: marks.marks ?? 1,
    confidence: inferred.confidence,
    gradingMethod:
      inferred.type === "essay" ||
      inferred.type === "file_upload" ||
      inferred.type === "matching"
        ? "manual"
        : inferred.type === "multiple_choice" && correctCount === 1
          ? "automatic"
          : "manual",
    options,
    pairs: raw.pairs.map((pair) => ({ ...pair })),
    accepted: [],
    correctValue: null,
    explanationEn: raw.explanation,
    warnings: unique(warnings),
    raw: raw.lines.join("\n").trim(),
  };

  if (answerLinePresent(raw)) {
    draft.warnings = unique([
      ...draft.warnings,
      ...applyInlineAnswer(draft, raw.inlineAnswer),
    ]);
  }

  return draft;
}

function answerLinePresent(raw: RawQuestion): boolean {
  return raw.inlineAnswer.trim() !== "";
}

function finaliseRawQuestion(
  raw: RawQuestion,
  questions: ImportQuestionDraft[],
): void {
  // A block with no prompt text is only kept when it contains options or
  // pairs; otherwise it is noise from a page header.
  if (raw.lines.join("").trim() === "" && raw.options.length === 0 && raw.pairs.length === 0) {
    return;
  }

  questions.push(buildQuestion(raw, questions.length));
}

function isAnswerKeyHeading(line: string): boolean {
  return /^(?:answer\s*key|answers?|marking scheme|مفتاح الإجابة|الإجابات|نموذج الإجابة)\s*[:：]?\s*$/i.test(
    line,
  );
}

export function parseQuestionDocument(
  text: string,
  options: { fileName?: string } = {},
): ParsedQuestionDocument {
  const lines = normaliseLines(text);
  const warnings: ImportWarningCode[] = [];
  const rawSections: RawSection[] = [];
  const preamble: string[] = [];
  let currentSection: RawSection | null = null;
  let currentQuestion: RawQuestion | null = null;

  const ensureSection = (): RawSection => {
    if (!currentSection) {
      currentSection = {
        titleEn: "Questions",
        instructions: [],
        explicit: false,
        questions: [],
      };
      rawSections.push(currentSection);
    }

    return currentSection;
  };

  const finishQuestion = () => {
    if (!currentQuestion) {
      return;
    }

    const section = ensureSection();
    finaliseRawQuestion(currentQuestion, section.questions);
    currentQuestion = null;
  };

  const startSection = (title: string) => {
    finishQuestion();
    currentSection = {
      titleEn: title,
      instructions: [],
      explicit: true,
      questions: [],
    };
    rawSections.push(currentSection);
  };

  for (const line of lines) {
    if (line.trim() === "") {
      if (currentQuestion) {
        currentQuestion.lines.push("");
      }
      continue;
    }

    if (isAnswerKeyHeading(line)) {
      continue;
    }

    if (isSectionHeading(line)) {
      startSection(sectionTitleFromLine(line));
      continue;
    }

    if (currentQuestion) {
      const matchingPair =
        isMatchingQuestion(currentQuestion) && parsePairLine(line);
      if (matchingPair) {
        currentQuestion.pairs.push(matchingPair);
        continue;
      }

      if (isNumberedChoice(line, currentQuestion)) {
        const choice = line.match(NUMBERED_OPTION);
        if (choice) {
          let choiceText = choice[2].trim();
          let correct = false;
          const marked = choiceText.match(
            /(?:\s*[\*✓✔]|\s*\((?:correct|answer)\)|\s*\[(?:correct|answer)\])\s*$/i,
          );

          if (marked) {
            correct = true;
            choiceText = choiceText.slice(0, marked.index).trim();
          }

          if (choiceText) {
            currentQuestion.options.push({ text: choiceText, correct });
            continue;
          }
        }
      }
    }

    const start = isQuestionStart(line);

    if (start) {
      finishQuestion();
      ensureSection();
      currentQuestion = {
        sourceNumber: start.number,
        lines: [start.text],
        options: [],
        pairs: [],
        warnings: [],
        inlineAnswer: "",
        explanation: "",
      };
      continue;
    }

    if (currentQuestion) {
      const answer = line.match(ANSWER_LINE);
      if (answer) {
        currentQuestion.inlineAnswer = answer[1].trim();
        continue;
      }

      const explanation = line.match(EXPLANATION_LINE);
      if (explanation) {
        currentQuestion.explanation = explanation[1].trim();
        continue;
      }

      const option = parseOptionLine(line);
      if (option) {
        currentQuestion.options.push({
          text: option.text,
          correct: option.correct,
        });
        continue;
      }

      currentQuestion.lines.push(line);
      continue;
    }

    if (rawSections.length > 0) {
      ensureSection().instructions.push(line);
      continue;
    }

    preamble.push(line);
  }

  finishQuestion();

  const sections: ImportSectionDraft[] = rawSections
    .filter((section) => section.questions.length > 0 || section.explicit)
    .map((section, sectionIndex) => ({
      key: `s-${sectionIndex + 1}`,
      titleEn: section.titleEn,
      titleAr: "",
      instructionsEn: section.instructions.join("\n").trim(),
      questions: section.questions,
    }));

  const questionCount = sections.reduce(
    (sum, section) => sum + section.questions.length,
    0,
  );

  if (questionCount === 0) {
    warnings.push("no_questions_detected");
  }

  for (const section of sections) {
    if (section.questions.length === 0) {
      warnings.push("empty_section");
    }

    const numbers = section.questions.map((question) => question.sourceNumber);
    if (new Set(numbers).size !== numbers.length) {
      warnings.push("duplicate_question_number");
    }
  }

  const meta = extractPreamble(preamble, options.fileName);

  if (!meta.titleDetected) {
    warnings.push("no_title_detected");
  }

  return {
    titleEn: meta.title,
    instructionsEn: meta.instructions,
    suggestedTimeLimit: meta.timeLimit,
    sections,
    warnings: unique(warnings),
  };
}

function extractPreamble(
  preamble: string[],
  fileName?: string,
): {
  title: string;
  titleDetected: boolean;
  instructions: string;
  timeLimit: number | null;
} {
  let timeLimit: number | null = null;
  const content: string[] = [];

  for (const line of preamble) {
    const time = line.match(
      /(?:time|time allowed|duration|الوقت|الزمن)\s*[:：\-–—]?\s*(\d{1,3})\s*(?:minutes?|mins?|دقيقة|دقائق)/i,
    );

    if (time) {
      const value = Number(time[1]);
      if (value >= 1 && value <= 600) {
        timeLimit = value;
      }
      continue;
    }

    if (METADATA_LINE.test(line) && !/^total\b/i.test(line)) {
      continue;
    }

    content.push(line.replace(/^(?:instructions?|تعليمات)\s*[:：\-–—]\s*/i, ""));
  }

  let title = "";
  let titleIndex = -1;

  for (let index = 0; index < Math.min(content.length, 3); index += 1) {
    const candidate = content[index].trim();

    if (
      candidate.length >= 3 &&
      candidate.length <= 160 &&
      !INSTRUCTION_START.test(candidate) &&
      !candidate.endsWith("?") &&
      !/_{2,}/.test(candidate)
    ) {
      title = candidate;
      titleIndex = index;
      break;
    }
  }

  if (titleIndex >= 0) {
    content.splice(titleIndex, 1);
  }

  const fallback = titleFromFileName(fileName ?? "");
  const titleDetected = title !== "";
  const instructions = content
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    title: title || fallback || "Imported assessment",
    titleDetected,
    instructions,
    timeLimit,
  };
}

function splitAnswers(raw: string): string[] {
  const value = raw.replace(/^["'“”]+|["'“”]+$/g, "").trim();

  if (!value) {
    return [];
  }

  const mappingTokens = [
    ...value.matchAll(/(?:^|[,;]\s*)(\d{1,3})\s*[-–—]\s*([A-Za-z])(?=\s*(?:[,;]|$))/g),
  ];

  if (mappingTokens.length >= 2) {
    return mappingTokens.map(
      (match) => `${match[1]}-${match[2].toLowerCase()}`,
    );
  }

  const stripped = value
    .replace(/^\(?([A-Ha-h])\)?[.)]$/, "$1")
    .replace(/^(true|false|صح|خطأ)[.]$/i, "$1");

  const parts = stripped
    .split(/\s*[;|]\s*|\s+\/\s+|\s+or\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    return unique(parts);
  }

  if (stripped.includes(",")) {
    const commaParts = stripped
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (
      commaParts.length > 1 &&
      commaParts.every(
        (part) => part.length <= 30 && part.split(/\s+/).length <= 5,
      )
    ) {
      return unique(commaParts);
    }
  }

  return [stripped];
}

export function parseAnswerKey(text: string): ParsedAnswerKey {
  const lines = normaliseLines(text);
  const entries: ImportAnswerEntry[] = [];
  const warnings: ImportWarningCode[] = [];

  if (text.trim() === "") {
    return { entries, warnings };
  }

  for (const line of lines) {
    if (!line || isAnswerKeyHeading(line) || isSectionHeading(line)) {
      continue;
    }

    const pureMapping = line.match(
      /^\s*(\d{1,3})\s*[-–—]\s*([A-Za-z])\s*(?:[,;]\s*\d{1,3}\s*[-–—]\s*[A-Za-z]\s*)+$/,
    );

    if (pureMapping) {
      const answers = [
        ...line.matchAll(/(\d{1,3})\s*[-–—]\s*([A-Za-z])/g),
      ].map((match) => `${match[1]}-${match[2].toLowerCase()}`);

      entries.push({
        key: `a-${entries.length + 1}-${shortHash(line)}`,
        number: "",
        raw: line.trim(),
        answers,
        status: "unmatched",
        warnings: [],
      });
      continue;
    }

    const leading = line.match(
      /^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*(?:[.)\]:\-–—]|\s)\s*(.+)$/i,
    );

    if (leading) {
      const number = leading[1];
      const raw = leading[2].trim();
      const answers = splitAnswers(raw);

      entries.push({
        key: `a-${entries.length + 1}-${shortHash(`${number}:${raw}`)}`,
        number,
        raw,
        answers,
        status: "unmatched",
        warnings:
          answers.length > 1 &&
          !answers.every((answer) => /^\d{1,3}-[a-z]$/i.test(answer))
            ? ["ambiguous_answer"]
            : [],
      });
      continue;
    }

    const mappingTokens = [
      ...line.matchAll(/(?:^|[,;]\s*)(\d{1,3})\s*[-–—]\s*([A-Za-z])(?=\s*(?:[,;]|$))/g),
    ];

    if (mappingTokens.length >= 2) {
      const answers = mappingTokens.map(
        (match) => `${match[1]}-${match[2].toLowerCase()}`,
      );

      entries.push({
        key: `a-${entries.length + 1}-${shortHash(line)}`,
        number: "",
        raw: line.trim(),
        answers,
        status: "unmatched",
        warnings: ["matching_answer_not_applied"],
      });
      continue;
    }

    if (/[A-Za-z0-9\u0600-\u06ff]/.test(line)) {
      warnings.push("unmatched_answer");
    }
  }

  if (entries.length === 0) {
    warnings.push("unmatched_answer");
  }

  return { entries, warnings: unique(warnings) };
}

function parseMapping(
  answers: string[],
  pairCount: number,
): Record<number, string> | null {
  const map: Record<number, string> = {};
  const tokenPattern = /^(\d{1,3})-([a-z])$/i;
  const lettersOnly = answers.every((answer) => /^[A-Za-z]$/.test(answer));

  if (lettersOnly && answers.length === pairCount) {
    answers.forEach((answer, index) => {
      map[index + 1] = answer.toLowerCase();
    });
    return map;
  }

  for (const answer of answers) {
    const match = answer.match(tokenPattern);

    if (!match) {
      return null;
    }

    map[Number(match[1])] = match[2].toLowerCase();
  }

  return Object.keys(map).length > 0 ? map : null;
}

function applyMatchingKey(
  question: ImportQuestionDraft,
  answers: string[],
): ImportWarningCode[] {
  const pairs = [...question.pairs];

  if (pairs.length < 2) {
    return ["matching_incomplete"];
  }

  const mapping = parseMapping(answers, pairs.length);

  if (!mapping) {
    return ["matching_answer_not_applied"];
  }

  const rightByLetter = new Map<string, string>();
  pairs.forEach((pair, index) => {
    rightByLetter.set(String.fromCharCode(97 + index), pair.right);
  });

  const nextPairs = pairs.map((pair, index) => {
    const letter = mapping[index + 1];
    const right = letter ? rightByLetter.get(letter) : undefined;

    return right ? { ...pair, right } : pair;
  });

  const complete = Object.keys(mapping).length === pairs.length;
  const usedRights = new Set(nextPairs.map((pair) => pair.right));

  if (!complete || usedRights.size !== pairs.length) {
    return ["matching_answer_not_applied"];
  }

  question.pairs = nextPairs;
  question.gradingMethod = "automatic";
  return [];
}

function applyEntry(
  question: ImportQuestionDraft,
  entry: ImportAnswerEntry,
): { status: ImportAnswerStatus; warnings: ImportWarningCode[] } {
  const warnings: ImportWarningCode[] = [];

  if (question.type === "essay" || question.type === "file_upload") {
    return {
      status: "unmatched",
      warnings: ["manual_type_answer_ignored"],
    };
  }

  if (question.type === "multiple_choice") {
    if (entry.answers.length !== 1) {
      return { status: "ambiguous", warnings: ["ambiguous_answer"] };
    }

    const token = entry.answers[0].trim();
    const letter = token.match(/^\(?([A-Ha-h])\)?[.)]?$/);

    if (letter) {
      const label = letter[1].toUpperCase();
      const index = question.options.findIndex(
        (_, optionIndex) => String.fromCharCode(65 + optionIndex) === label,
      );

      if (index < 0) {
        return { status: "matched", warnings: ["answer_mismatch"] };
      }

      const existing = question.options
        .map((option, optionIndex) => (option.correct ? optionIndex : -1))
        .filter((optionIndex) => optionIndex >= 0);

      if (existing.length > 0 && (existing.length > 1 || existing[0] !== index)) {
        return { status: "ambiguous", warnings: ["ambiguous_answer"] };
      }

      question.options = question.options.map((option, optionIndex) => ({
        ...option,
        correct: optionIndex === index,
      }));
      question.gradingMethod = "automatic";
      return { status: "matched", warnings };
    }

    const index = question.options.findIndex(
      (option) => option.text.trim().toLowerCase() === token.toLowerCase(),
    );

    if (index < 0) {
      return { status: "matched", warnings: ["answer_mismatch"] };
    }

    const existing = question.options
      .map((option, optionIndex) => (option.correct ? optionIndex : -1))
      .filter((optionIndex) => optionIndex >= 0);

    if (existing.length > 0 && (existing.length > 1 || existing[0] !== index)) {
      return { status: "ambiguous", warnings: ["ambiguous_answer"] };
    }

    question.options = question.options.map((option, optionIndex) => ({
      ...option,
      correct: optionIndex === index,
    }));
    question.gradingMethod = "automatic";
    return { status: "matched", warnings };
  }

  if (question.type === "true_false") {
    if (entry.answers.length !== 1) {
      return { status: "ambiguous", warnings: ["ambiguous_answer"] };
    }

    const value = parseBoolean(entry.answers[0]);

    if (!value) {
      return { status: "matched", warnings: ["answer_mismatch"] };
    }

    if (question.correctValue && question.correctValue !== value) {
      return { status: "ambiguous", warnings: ["ambiguous_answer"] };
    }

    question.correctValue = value;
    question.gradingMethod = "automatic";
    return { status: "matched", warnings };
  }

  if (question.type === "matching") {
    const matchingWarnings = applyMatchingKey(question, entry.answers);

    if (matchingWarnings.length > 0) {
      return { status: "matched", warnings: matchingWarnings };
    }

    return { status: "matched", warnings };
  }

  const accepted = unique(entry.answers.map((answer) => answer.trim()).filter(Boolean));

  if (accepted.length === 0) {
    return { status: "unmatched", warnings: ["unmatched_answer"] };
  }

  question.accepted = unique([...question.accepted, ...accepted]);
  question.gradingMethod = "automatic";
  return { status: "matched", warnings };
}

function ensureQuestionKeyState(question: ImportQuestionDraft): void {
  const warnings = [...question.warnings];

  if (question.type === "multiple_choice") {
    const correct = question.options.filter((option) => option.correct);

    if (correct.length > 1) {
      warnings.push("ambiguous_answer");
      question.gradingMethod = "manual";
    } else if (correct.length === 0) {
      warnings.push("missing_answer");
      question.gradingMethod = "manual";
    }
  } else if (question.type === "true_false") {
    if (!question.correctValue) {
      warnings.push("missing_answer");
      question.gradingMethod = "manual";
    }
  } else if (question.type === "matching") {
    if (question.pairs.length < 2) {
      warnings.push("matching_incomplete");
      question.gradingMethod = "manual";
    } else if (question.gradingMethod !== "automatic") {
      warnings.push("missing_answer");
    }
  } else if (
    question.type === "short_answer" ||
    question.type === "rewrite" ||
    question.type === "find_the_mistake"
  ) {
    if (question.accepted.length === 0) {
      warnings.push("missing_answer");
      question.gradingMethod = "manual";
    }
  } else {
    question.gradingMethod = "manual";
  }

  question.warnings = unique(warnings);
}

function warningForQuestion(
  code: ImportWarningCode,
  question: ImportQuestionDraft,
): ImportWarning {
  return {
    code,
    questionNumber: question.sourceNumber,
    questionKey: question.key,
  };
}

export function applyAnswerKey(
  sections: ImportSectionDraft[],
  entries: ImportAnswerEntry[],
): {
  sections: ImportSectionDraft[];
  answerKey: ImportAnswerEntry[];
  warnings: ImportWarning[];
} {
  const questions = sections.flatMap((section) => section.questions);
  const byNumber = new Map<string, ImportQuestionDraft[]>();
  const duplicateQuestionNumbers = new Set<string>();

  for (const question of questions) {
    const list = byNumber.get(question.sourceNumber) ?? [];
    list.push(question);
    byNumber.set(question.sourceNumber, list);
  }

  for (const [number, list] of byNumber) {
    if (list.length > 1) {
      duplicateQuestionNumbers.add(number);
    }
  }

  const entryCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.number) {
      entryCounts.set(entry.number, (entryCounts.get(entry.number) ?? 0) + 1);
    }
  }

  const warnings: ImportWarning[] = [];

  for (const question of questions) {
    for (const code of question.warnings) {
      warnings.push(warningForQuestion(code, question));
    }
  }

  const answerKey = entries.map((entry) => {
    const next: ImportAnswerEntry = {
      ...entry,
      answers: [...entry.answers],
      warnings: [...entry.warnings],
      status: "unmatched",
    };

    if (entry.number && (entryCounts.get(entry.number) ?? 0) > 1) {
      next.status = "duplicate";
      next.warnings = unique([...next.warnings, "duplicate_answer_number"]);
      return next;
    }

    if (entry.number && duplicateQuestionNumbers.has(entry.number)) {
      next.status = "ambiguous";
      next.warnings = unique([...next.warnings, "ambiguous_answer"]);
      return next;
    }

    let candidates = entry.number ? byNumber.get(entry.number) ?? [] : [];

    if (!entry.number && entry.answers.some((answer) => /^\d+-[a-z]$/i.test(answer))) {
      candidates = questions.filter(
        (question) => question.type === "matching" && question.pairs.length >= 2,
      );

      if (candidates.length > 1) {
        next.status = "ambiguous";
        next.warnings = unique([...next.warnings, "ambiguous_answer"]);
        return next;
      }
    }

    if (candidates.length === 0) {
      next.status = "unmatched";
      next.warnings = unique([...next.warnings, "unmatched_answer"]);
      return next;
    }

    if (candidates.length > 1) {
      next.status = "ambiguous";
      next.warnings = unique([...next.warnings, "ambiguous_answer"]);
      return next;
    }

    const question = candidates[0];
    const applied = applyEntry(question, entry);
    next.status = applied.status;
    next.warnings = unique([...next.warnings, ...applied.warnings]);
    next.questionKey = question.key;
    next.questionNumber = question.sourceNumber;

    return next;
  });

  for (const question of questions) {
    ensureQuestionKeyState(question);
  }

  for (const question of questions) {
    for (const code of question.warnings) {
      warnings.push(warningForQuestion(code, question));
    }
  }

  for (const entry of answerKey) {
    for (const code of entry.warnings) {
      warnings.push({
        code,
        questionNumber:
          entry.questionNumber || entry.number || undefined,
        questionKey: entry.questionKey,
      });
    }
  }

  const seen = new Set<string>();
  const deduped = warnings.filter((warning) => {
    const key = `${warning.code}:${warning.questionKey ?? ""}:${warning.questionNumber ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  return { sections, answerKey, warnings: deduped };
}

function buildQuestionStats(sections: ImportSectionDraft[]): {
  sectionCount: number;
  questionCount: number;
  totalMarks: number;
} {
  const questions = sections.flatMap((section) => section.questions);

  return {
    sectionCount: sections.length,
    questionCount: questions.length,
    totalMarks: questions.reduce((sum, question) => sum + question.marks, 0),
  };
}

export function buildImportDraft(input: {
  questionText: string;
  answerText: string;
  fileName?: string;
  settings: ImportSettings;
  questionTextTruncated?: boolean;
  answerTextTruncated?: boolean;
}): ImportDraft {
  const parsed = parseQuestionDocument(input.questionText, {
    fileName: input.fileName,
  });
  const parsedAnswers = parseAnswerKey(input.answerText);
  const applied = applyAnswerKey(parsed.sections, parsedAnswers.entries);
  const stats = buildQuestionStats(applied.sections);
  const warnings: ImportWarning[] = [];

  for (const code of parsed.warnings) {
    warnings.push({ code });
  }

  for (const code of parsedAnswers.warnings) {
    warnings.push({ code });
  }

  warnings.push(...applied.warnings);

  if (input.questionTextTruncated || input.answerTextTruncated) {
    warnings.push({ code: "text_truncated" });
  }

  const seen = new Set<string>();
  const dedupedWarnings = warnings.filter((warning) => {
    const key = `${warning.code}:${warning.questionKey ?? ""}:${warning.questionNumber ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  const titleEn =
    input.settings.titleEn.trim() ||
    parsed.titleEn ||
    titleFromFileName(input.fileName ?? "") ||
    "Imported assessment";
  const instructionsEn =
    input.settings.instructionsEn.trim() || parsed.instructionsEn;

  return {
    settings: {
      ...input.settings,
      titleEn,
      instructionsEn,
      timeLimitMinutes:
        parsed.suggestedTimeLimit ?? input.settings.timeLimitMinutes,
    },
    sections: applied.sections,
    answerKey: applied.answerKey,
    warnings: dedupedWarnings,
    sourceText: input.questionText,
    answerText: input.answerText,
    stats: {
      ...stats,
      warningCount: dedupedWarnings.length,
      matchedAnswers: applied.answerKey.filter((entry) => entry.status === "matched")
        .length,
      unmatchedAnswers: applied.answerKey.filter(
        (entry) => entry.status !== "matched",
      ).length,
    },
  };
}

export {
  parseBoolean,
  extractMarks,
  parseOptionLine,
  splitAnswers,
};
