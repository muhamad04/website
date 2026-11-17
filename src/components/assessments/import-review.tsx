"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileText,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { FormField as Field } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  cancelImportAction,
  saveImportedAssessmentAction,
  updateImportDraftAction,
} from "@/app/(app)/teacher/assessments/import/actions";
import type {
  AssessmentType,
  GradingMethod,
  GradingMode,
  GradeSummary,
  QuestionType,
  ResultsVisibility,
} from "@/lib/domain/types";
import type {
  ImportConfidence,
  ImportDraft,
  ImportQuestionDraft,
  ImportWarningCode,
} from "@/lib/import/types";
import {
  isAutoGradableType,
  isManualOnlyType,
  QUESTION_TYPES,
} from "@/lib/validation/assessments";
import {
  assessmentTypeCopy,
  gradingModeCopy,
  questionTypeCopy,
  resultsVisibilityCopy,
} from "@/lib/i18n/assessments";
import {
  importConfidenceCopy,
  importErrorCopy,
  importWarningCopy,
  importsUi,
} from "@/lib/i18n/imports";
import type { ImportActionResult } from "@/lib/import/validation";
import { cn } from "@/lib/utils";

type ReviewOption = { text: string; correct: boolean };
type ReviewPair = { left: string; right: string };

type ReviewQuestion = {
  key: string;
  sourceNumber: string;
  type: QuestionType;
  promptEn: string;
  promptAr: string;
  helpTextEn: string;
  marks: string;
  confidence: ImportConfidence;
  gradingMethod: GradingMethod;
  options: ReviewOption[];
  pairs: ReviewPair[];
  accepted: string[];
  correctValue: "true" | "false" | null;
  explanationEn: string;
  explanationAr: string;
  warnings: ImportWarningCode[];
  raw: string;
};

type ReviewSection = {
  key: string;
  titleEn: string;
  titleAr: string;
  instructionsEn: string;
  questions: ReviewQuestion[];
};

type ReviewSettings = {
  type: AssessmentType;
  gradeId: string;
  titleEn: string;
  titleAr: string;
  instructionsEn: string;
  instructionsAr: string;
  timeLimitMinutes: string;
  resultsVisibility: ResultsVisibility;
  allowRetakes: boolean;
  maxAttempts: string;
  availableFrom: string;
  availableUntil: string;
};

function toDateTimeLocal(value: string): string {
  if (!value) {
    return "";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return "";
  }

  const date = new Date(parsed - new Date(parsed).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

function toIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function questionFromDraft(question: ImportQuestionDraft): ReviewQuestion {
  return {
    key: question.key,
    sourceNumber: question.sourceNumber,
    type: question.type,
    promptEn: question.promptEn,
    promptAr: question.promptAr,
    helpTextEn: question.helpTextEn,
    marks: String(question.marks),
    confidence: question.confidence,
    gradingMethod: question.gradingMethod,
    options: question.options.map((option) => ({ ...option })),
    pairs: question.pairs.map((pair) => ({ ...pair })),
    accepted: [...question.accepted],
    correctValue: question.correctValue,
    explanationEn: question.explanationEn,
    explanationAr: "",
    warnings: [...question.warnings],
    raw: question.raw,
  };
}

function newQuestion(): ReviewQuestion {
  return {
    key: `manual-${Math.random().toString(36).slice(2, 9)}`,
    sourceNumber: "",
    type: "short_answer",
    promptEn: "",
    promptAr: "",
    helpTextEn: "",
    marks: "1",
    confidence: "low",
    gradingMethod: "manual",
    options: [],
    pairs: [],
    accepted: [],
    correctValue: null,
    explanationEn: "",
    explanationAr: "",
    warnings: [],
    raw: "",
  };
}

function newSection(): ReviewSection {
  return {
    key: `section-${Math.random().toString(36).slice(2, 9)}`,
    titleEn: "Questions",
    titleAr: "",
    instructionsEn: "",
    questions: [],
  };
}

function settingsFromDraft(draft: ImportDraft): ReviewSettings {
  return {
    type: draft.settings.type,
    gradeId: draft.settings.gradeId,
    titleEn: draft.settings.titleEn,
    titleAr: draft.settings.titleAr,
    instructionsEn: draft.settings.instructionsEn,
    instructionsAr: draft.settings.instructionsAr,
    timeLimitMinutes: String(draft.settings.timeLimitMinutes),
    resultsVisibility: draft.settings.resultsVisibility,
    allowRetakes: draft.settings.allowRetakes,
    maxAttempts: String(draft.settings.maxAttempts),
    availableFrom: toDateTimeLocal(draft.settings.availableFrom),
    availableUntil: toDateTimeLocal(draft.settings.availableUntil),
  };
}

function adjustmentForType(
  type: QuestionType,
  current: GradingMethod,
): GradingMethod {
  if (isManualOnlyType(type)) {
    return "manual";
  }

  if (!isAutoGradableType(type)) {
    return "manual";
  }

  return current;
}

function ErrorAlert({ error }: { error: string }) {
  const copy =
    importErrorCopy[error as keyof typeof importErrorCopy] ??
    importErrorCopy.unknown;

  return (
    <Alert variant="error">
      <Bi en={copy.en} ar={copy.ar} />
    </Alert>
  );
}

export function ImportReview({
  importId,
  initialDraft,
  grades,
}: {
  importId: string;
  initialDraft: ImportDraft;
  grades: GradeSummary[];
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<ReviewSettings>(() =>
    settingsFromDraft(initialDraft),
  );
  const [sections, setSections] = useState<ReviewSection[]>(() =>
    initialDraft.sections.map((section) => ({
      key: section.key,
      titleEn: section.titleEn,
      titleAr: section.titleAr,
      instructionsEn: section.instructionsEn,
      questions: section.questions.map(questionFromDraft),
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<"none" | "progress" | "save" | "cancel">(
    "none",
  );

  const questions = sections.flatMap((section) => section.questions);
  const totalMarks = questions.reduce(
    (sum, question) => sum + (Number(question.marks) || 0),
    0,
  );
  const busy = pending !== "none";
  const automaticCount = questions.filter(
    (question) => question.gradingMethod === "automatic",
  ).length;
  const gradingPreview: GradingMode =
    questions.length === 0 || automaticCount === 0
      ? "manual"
      : automaticCount === questions.length
        ? "automatic"
        : "mixed";

  const updateSection = (sectionIndex: number, patch: Partial<ReviewSection>) => {
    setSections((previous) =>
      previous.map((section, index) =>
        index === sectionIndex ? { ...section, ...patch } : section,
      ),
    );
  };

  const updateQuestion = (
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<ReviewQuestion>,
  ) => {
    setSections((previous) =>
      previous.map((section, index) => {
        if (index !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          questions: section.questions.map((question, innerIndex) =>
            innerIndex === questionIndex ? { ...question, ...patch } : question,
          ),
        };
      }),
    );
  };

  const moveSection = (sectionIndex: number, direction: -1 | 1) => {
    setSections((previous) => {
      const next = [...previous];
      const target = sectionIndex + direction;

      if (target < 0 || target >= next.length) {
        return previous;
      }

      [next[sectionIndex], next[target]] = [next[target], next[sectionIndex]];
      return next;
    });
  };

  const moveQuestion = (
    sectionIndex: number,
    questionIndex: number,
    direction: -1 | 1,
  ) => {
    setSections((previous) =>
      previous.map((section, index) => {
        if (index !== sectionIndex) {
          return section;
        }

        const target = questionIndex + direction;

        if (target < 0 || target >= section.questions.length) {
          return section;
        }

        const nextQuestions = [...section.questions];
        [nextQuestions[questionIndex], nextQuestions[target]] = [
          nextQuestions[target],
          nextQuestions[questionIndex],
        ];

        return { ...section, questions: nextQuestions };
      }),
    );
  };

  const buildPayload = () => ({
    import_id: importId,
    settings: {
      type: settings.type,
      gradeId: settings.gradeId,
      titleEn: settings.titleEn,
      titleAr: settings.titleAr,
      instructionsEn: settings.instructionsEn,
      instructionsAr: settings.instructionsAr,
      timeLimitMinutes: Number(settings.timeLimitMinutes),
      resultsVisibility: settings.resultsVisibility,
      allowRetakes: settings.allowRetakes,
      maxAttempts: settings.allowRetakes
        ? Math.max(2, Number(settings.maxAttempts) || 2)
        : 1,
      availableFrom: toIso(settings.availableFrom),
      availableUntil: toIso(settings.availableUntil),
    },
    sections: sections.map((section) => ({
      key: section.key,
      titleEn: section.titleEn,
      titleAr: section.titleAr,
      instructionsEn: section.instructionsEn,
      questions: section.questions.map((question) => ({
        key: question.key,
        sourceNumber: question.sourceNumber,
        type: question.type,
        promptEn: question.promptEn,
        promptAr: question.promptAr,
        helpTextEn: question.helpTextEn,
        marks: Number(question.marks),
        confidence: question.confidence,
        gradingMethod: question.gradingMethod,
        options: question.options,
        pairs: question.pairs,
        accepted: question.accepted.filter((answer) => answer.trim() !== ""),
        correctValue: question.correctValue,
        explanationEn: question.explanationEn,
        explanationAr: question.explanationAr,
        warnings: question.warnings,
        raw: question.raw,
      })),
    })),
  });

  const handleResult = (result: ImportActionResult): boolean => {
    if (result.ok) {
      setFieldErrors({});
      return true;
    }

    setFieldErrors(result.fieldErrors ?? {});
    setError(result.error ?? "unknown");
    return false;
  };

  const saveProgress = async () => {
    setError(null);
    setNotice(null);
    setPending("progress");

    try {
      const result = await updateImportDraftAction(buildPayload());

      if (handleResult(result)) {
        setNotice(importsUi.review.savedProgress.en);
      }
    } catch {
      setError("unknown");
    } finally {
      setPending("none");
    }
  };

  const saveDraft = async () => {
    setError(null);
    setNotice(null);
    setPending("save");

    try {
      const result = await saveImportedAssessmentAction(buildPayload());

      if (!handleResult(result) || !result.assessmentId) {
        return;
      }

      router.push(`/teacher/assessments/${result.assessmentId}`);
      router.refresh();
    } catch {
      setError("unknown");
    } finally {
      setPending("none");
    }
  };

  const cancelImport = async () => {
    if (!window.confirm(`${importsUi.review.confirmCancel.en}\n${importsUi.review.confirmCancel.ar}`)) {
      return;
    }

    setError(null);
    setNotice(null);
    setPending("cancel");

    try {
      const result = await cancelImportAction({ import_id: importId });

      if (!handleResult(result)) {
        return;
      }

      router.push("/teacher/assessments/import");
      router.refresh();
    } catch {
      setError("unknown");
    } finally {
      setPending("none");
    }
  };

  return (
    <div className="space-y-5">
      {error ? <ErrorAlert error={error} /> : null}

      {Object.keys(fieldErrors).length > 0 ? (
        <Alert variant="error">
          <Bi
            en={importsUi.review.fieldErrors.en}
            ar={importsUi.review.fieldErrors.ar}
          />
        </Alert>
      ) : null}

      {notice ? (
        <Alert variant="success">
          <Bi
            en={importsUi.review.savedProgress.en}
            ar={importsUi.review.savedProgress.ar}
          />
        </Alert>
      ) : null}

      <section className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label={
            <Bi
              en={importsUi.review.sectionsCount.en}
              ar={importsUi.review.sectionsCount.ar}
            />
          }
          value={sections.length}
        />
        <Stat
          label={
            <Bi
              en={importsUi.review.questionsCount.en}
              ar={importsUi.review.questionsCount.ar}
            />
          }
          value={questions.length}
        />
        <Stat
          label={
            <Bi
              en={importsUi.review.marksCount.en}
              ar={importsUi.review.marksCount.ar}
            />
          }
          value={totalMarks}
        />
        <Stat
          label={
            <Bi
              en={importsUi.review.warningsCount.en}
              ar={importsUi.review.warningsCount.ar}
            />
          }
          value={initialDraft.warnings.length}
        />
        <Stat
          label={
            <Bi
              en={importsUi.review.matchedAnswers.en}
              ar={importsUi.review.matchedAnswers.ar}
            />
          }
          value={initialDraft.stats.matchedAnswers}
        />
      </section>

      {initialDraft.warnings.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
            <Bi
              en={importsUi.review.warnings.en}
              ar={importsUi.review.warnings.ar}
            />
          </h2>
          <ul className="grid gap-1.5 text-sm text-muted-foreground">
            {initialDraft.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`} className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-warning" />
                <span>
                  <Bi
                    en={importWarningCopy[warning.code].en}
                    ar={importWarningCopy[warning.code].ar}
                  />
                  {warning.questionNumber ? (
                    <span className="ms-1 font-semibold">
                      (#{warning.questionNumber})
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Alert variant="success">
          <Bi
            en={importsUi.review.noWarnings.en}
            ar={importsUi.review.noWarnings.ar}
          />
        </Alert>
      )}

      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">
            <Bi
              en={importsUi.review.settings.en}
              ar={importsUi.review.settings.ar}
            />
          </h2>
          <p className="text-sm text-muted-foreground">
            <Bi
              en={importsUi.review.settingsHint.en}
              ar={importsUi.review.settingsHint.ar}
            />
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="settings-title-en" label={importsUi.review.titleEn}>
            <Input
              id="settings-title-en"
              value={settings.titleEn}
              maxLength={200}
              disabled={busy}
              onChange={(event) =>
                setSettings({ ...settings, titleEn: event.target.value })
              }
            />
          </Field>
          <Field id="settings-title-ar" label={importsUi.review.titleAr}>
            <Input
              id="settings-title-ar"
              dir="rtl"
              lang="ar"
              value={settings.titleAr}
              maxLength={200}
              disabled={busy}
              onChange={(event) =>
                setSettings({ ...settings, titleAr: event.target.value })
              }
            />
          </Field>
          <Field id="settings-grade" label={importsUi.review.grade}>
            <Select
              id="settings-grade"
              value={settings.gradeId}
              disabled={busy}
              onChange={(event) =>
                setSettings({ ...settings, gradeId: event.target.value })
              }
            >
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name_en} · {grade.name_ar}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="settings-type" label={importsUi.review.type}>
            <Select
              id="settings-type"
              value={settings.type}
              disabled={busy}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  type: event.target.value as AssessmentType,
                })
              }
            >
              {(Object.keys(assessmentTypeCopy) as AssessmentType[]).map(
                (value) => (
                  <option key={value} value={value}>
                    {assessmentTypeCopy[value].en} · {assessmentTypeCopy[value].ar}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field id="settings-instructions-en" label={importsUi.review.instructionsEn}>
            <Textarea
              id="settings-instructions-en"
              value={settings.instructionsEn}
              maxLength={4000}
              disabled={busy}
              onChange={(event) =>
                setSettings({ ...settings, instructionsEn: event.target.value })
              }
            />
          </Field>
          <Field id="settings-instructions-ar" label={importsUi.review.instructionsAr}>
            <Textarea
              id="settings-instructions-ar"
              dir="rtl"
              lang="ar"
              value={settings.instructionsAr}
              maxLength={4000}
              disabled={busy}
              onChange={(event) =>
                setSettings({ ...settings, instructionsAr: event.target.value })
              }
            />
          </Field>
          <Field id="settings-time" label={importsUi.review.timeLimit}>
            <Input
              id="settings-time"
              type="number"
              min={1}
              max={600}
              value={settings.timeLimitMinutes}
              disabled={busy}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  timeLimitMinutes: event.target.value,
                })
              }
            />
          </Field>
          <Field id="settings-visibility" label={importsUi.review.visibility}>
            <Select
              id="settings-visibility"
              value={settings.resultsVisibility}
              disabled={busy}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  resultsVisibility: event.target.value as ResultsVisibility,
                })
              }
            >
              {(Object.keys(resultsVisibilityCopy) as ResultsVisibility[]).map(
                (value) => (
                  <option key={value} value={value}>
                    {resultsVisibilityCopy[value].en} ·{" "}
                    {resultsVisibilityCopy[value].ar}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field id="settings-retakes" label={importsUi.review.retakes}>
            <Select
              id="settings-retakes"
              value={settings.allowRetakes ? "true" : "false"}
              disabled={busy}
              onChange={(event) => {
                const allow = event.target.value === "true";
                setSettings({
                  ...settings,
                  allowRetakes: allow,
                  maxAttempts: allow
                    ? String(Math.max(2, Number(settings.maxAttempts) || 2))
                    : "1",
                });
              }}
            >
              <option value="false">
                {importsUi.review.no.en} · {importsUi.review.no.ar}
              </option>
              <option value="true">
                {importsUi.review.yes.en} · {importsUi.review.yes.ar}
              </option>
            </Select>
          </Field>
          <Field id="settings-max-attempts" label={importsUi.review.maxAttempts}>
            <Input
              id="settings-max-attempts"
              type="number"
              min={2}
              max={10}
              value={settings.maxAttempts}
              disabled={busy || !settings.allowRetakes}
              onChange={(event) =>
                setSettings({ ...settings, maxAttempts: event.target.value })
              }
            />
          </Field>
          <Field id="settings-from" label={importsUi.review.availableFrom}>
            <Input
              id="settings-from"
              type="datetime-local"
              value={settings.availableFrom}
              disabled={busy}
              onChange={(event) =>
                setSettings({ ...settings, availableFrom: event.target.value })
              }
            />
          </Field>
          <Field id="settings-until" label={importsUi.review.availableUntil}>
            <Input
              id="settings-until"
              type="datetime-local"
              value={settings.availableUntil}
              disabled={busy}
              onChange={(event) =>
                setSettings({ ...settings, availableUntil: event.target.value })
              }
            />
          </Field>
        </div>

        <p className="text-xs text-muted-foreground">
          <Bi
            en={importsUi.review.availabilityHint.en}
            ar={importsUi.review.availabilityHint.ar}
          />
        </p>

        <p className="text-sm">
          <span className="font-semibold">
            <Bi
              en={importsUi.review.gradingPreview.en}
              ar={importsUi.review.gradingPreview.ar}
            />
            {": "}
          </span>
          <Badge variant="outline">
            <Bi
              en={gradingModeCopy[gradingPreview].en}
              ar={gradingModeCopy[gradingPreview].ar}
            />
          </Badge>
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">
            <Bi
              en={importsUi.review.answerKey.en}
              ar={importsUi.review.answerKey.ar}
            />
          </h2>
          <p className="text-sm text-muted-foreground">
            <Bi
              en={importsUi.review.answerKeyHint.en}
              ar={importsUi.review.answerKeyHint.ar}
            />
          </p>
        </div>

        {initialDraft.answerKey.length === 0 ? (
          <Alert variant="info">
            <Bi
              en={importsUi.review.noAnswerKey.en}
              ar={importsUi.review.noAnswerKey.ar}
            />
          </Alert>
        ) : (
          <ul className="grid gap-2">
            {initialDraft.answerKey.map((entry) => (
              <li
                key={entry.key}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
              >
                <span className="font-semibold">
                  {entry.number ? `#${entry.number}` : "—"}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {entry.answers.join(", ") || entry.raw}
                </span>
                <Badge
                  variant={
                    entry.status === "matched"
                      ? "success"
                      : entry.status === "unmatched"
                        ? "muted"
                        : "outline"
                  }
                >
                  <Bi
                    en={importsUi.answerStatus[entry.status].en}
                    ar={importsUi.answerStatus[entry.status].ar}
                  />
                </Badge>
                {entry.questionNumber ? (
                  <span className="text-xs text-muted-foreground">
                    <Bi
                      en={`${importsUi.review.matchedTo.en} #${entry.questionNumber}`}
                      ar={`${importsUi.review.matchedTo.ar} ${entry.questionNumber}`}
                    />
                  </span>
                ) : null}
                {entry.warnings.length > 0 ? (
                  <span className="w-full text-xs text-muted-foreground">
                    {entry.warnings.map((code) => (
                      <span key={code} className="me-2">
                        <Bi
                          en={importWarningCopy[code].en}
                          ar={importWarningCopy[code].ar}
                        />
                      </span>
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {initialDraft.answerText ? (
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              <Bi
                en={importsUi.review.answerSource.en}
                ar={importsUi.review.answerSource.ar}
              />
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-secondary/40 p-3 text-xs">
              {initialDraft.answerText}
            </pre>
          </details>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            <Bi
              en={importsUi.review.sections.en}
              ar={importsUi.review.sections.ar}
            />
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setSections((previous) => [...previous, newSection()])}
          >
            <Plus aria-hidden="true" />
            <Bi
              en={importsUi.review.addSection.en}
              ar={importsUi.review.addSection.ar}
            />
          </Button>
        </div>

        {sections.length === 0 ? (
          <Alert variant="info">
            <Bi
              en={importsUi.review.noSections.en}
              ar={importsUi.review.noSections.ar}
            />
          </Alert>
        ) : null}

        <ul className="space-y-4">
          {sections.map((section, sectionIndex) => (
            <li
              key={section.key}
              className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <Field
                    id={`section-${sectionIndex}-title-en`}
                    label={importsUi.review.sectionTitle}
                  >
                    <Input
                      id={`section-${sectionIndex}-title-en`}
                      value={section.titleEn}
                      maxLength={200}
                      disabled={busy}
                      onChange={(event) =>
                        updateSection(sectionIndex, {
                          titleEn: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field
                    id={`section-${sectionIndex}-title-ar`}
                    label={importsUi.review.titleAr}
                  >
                    <Input
                      id={`section-${sectionIndex}-title-ar`}
                      dir="rtl"
                      lang="ar"
                      value={section.titleAr}
                      maxLength={200}
                      disabled={busy}
                      onChange={(event) =>
                        updateSection(sectionIndex, {
                          titleAr: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field
                    id={`section-${sectionIndex}-instructions`}
                    label={importsUi.review.sectionInstructions}
                    className="sm:col-span-2"
                  >
                    <Textarea
                      id={`section-${sectionIndex}-instructions`}
                      value={section.instructionsEn}
                      maxLength={2000}
                      disabled={busy}
                      onChange={(event) =>
                        updateSection(sectionIndex, {
                          instructionsEn: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <IconButton
                    label={importsUi.review.moveUp}
                    disabled={busy || sectionIndex === 0}
                    onClick={() => moveSection(sectionIndex, -1)}
                  >
                    <ArrowUp aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={importsUi.review.moveDown}
                    disabled={busy || sectionIndex === sections.length - 1}
                    onClick={() => moveSection(sectionIndex, 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={importsUi.review.delete}
                    disabled={busy}
                    variant="destructive"
                    onClick={() => {
                      if (
                        window.confirm(
                          `${importsUi.review.confirmDeleteSection.en}\n${importsUi.review.confirmDeleteSection.ar}`,
                        )
                      ) {
                        setSections((previous) =>
                          previous.filter((_, index) => index !== sectionIndex),
                        );
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  <Bi
                    en={`${importsUi.review.questions.en} (${section.questions.length})`}
                    ar={`${importsUi.review.questions.ar} (${section.questions.length})`}
                  />
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    setSections((previous) =>
                      previous.map((current, index) =>
                        index === sectionIndex
                          ? {
                              ...current,
                              questions: [...current.questions, newQuestion()],
                            }
                          : current,
                      ),
                    )
                  }
                >
                  <Plus aria-hidden="true" />
                  <Bi
                    en={importsUi.review.addQuestion.en}
                    ar={importsUi.review.addQuestion.ar}
                  />
                </Button>
              </div>

              {section.questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Bi
                    en={importsUi.review.noQuestions.en}
                    ar={importsUi.review.noQuestions.ar}
                  />
                </p>
              ) : null}

              <ul className="space-y-3">
                {section.questions.map((question, questionIndex) => (
                  <li key={question.key}>
                    <details
                      className="rounded-lg border border-border bg-card p-3"
                      open={question.confidence === "low"}
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold">
                          {question.sourceNumber
                            ? `#${question.sourceNumber}`
                            : "—"}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {question.promptEn || "—"}
                        </span>
                        <Badge variant="outline">
                          <Bi
                            en={questionTypeCopy[question.type].en}
                            ar={questionTypeCopy[question.type].ar}
                          />
                        </Badge>
                        {question.confidence !== "high" ? (
                          <Badge variant="muted">
                            <Bi
                              en={importConfidenceCopy[question.confidence].en}
                              ar={importConfidenceCopy[question.confidence].ar}
                            />
                          </Badge>
                        ) : null}
                        {question.warnings.length > 0 ? (
                          <Badge variant="muted">
                            <AlertTriangle
                              aria-hidden="true"
                              className="size-3"
                            />
                            {question.warnings.length}
                          </Badge>
                        ) : null}
                      </summary>

                      <div className="mt-3 space-y-3">
                        {question.warnings.length > 0 ? (
                          <ul className="space-y-1 rounded-lg bg-secondary/50 p-2 text-xs text-muted-foreground">
                            {question.warnings.map((code, index) => (
                              <li key={`${code}-${index}`}>
                                <Bi
                                  en={importWarningCopy[code].en}
                                  ar={importWarningCopy[code].ar}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field
                            id={`q-${sectionIndex}-${questionIndex}-source`}
                            label={importsUi.review.questionNumber}
                          >
                            <Input
                              id={`q-${sectionIndex}-${questionIndex}-source`}
                              value={question.sourceNumber}
                              maxLength={20}
                              disabled={busy}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, {
                                  sourceNumber: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field
                            id={`q-${sectionIndex}-${questionIndex}-type`}
                            label={importsUi.review.questionType}
                          >
                            <Select
                              id={`q-${sectionIndex}-${questionIndex}-type`}
                              value={question.type}
                              disabled={busy}
                              onChange={(event) => {
                                const type = event.target.value as QuestionType;
                                updateQuestion(sectionIndex, questionIndex, {
                                  type,
                                  gradingMethod: adjustmentForType(
                                    type,
                                    question.gradingMethod,
                                  ),
                                  options:
                                    type === "multiple_choice" &&
                                    question.options.length === 0
                                      ? [
                                          { text: "", correct: false },
                                          { text: "", correct: false },
                                        ]
                                      : question.options,
                                });
                              }}
                            >
                              {QUESTION_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {questionTypeCopy[type].en} ·{" "}
                                  {questionTypeCopy[type].ar}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field
                            id={`q-${sectionIndex}-${questionIndex}-prompt-en`}
                            label={importsUi.review.promptEn}
                            className="sm:col-span-2"
                          >
                            <Textarea
                              id={`q-${sectionIndex}-${questionIndex}-prompt-en`}
                              value={question.promptEn}
                              maxLength={4000}
                              disabled={busy}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, {
                                  promptEn: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field
                            id={`q-${sectionIndex}-${questionIndex}-prompt-ar`}
                            label={importsUi.review.promptAr}
                            className="sm:col-span-2"
                          >
                            <Textarea
                              id={`q-${sectionIndex}-${questionIndex}-prompt-ar`}
                              dir="rtl"
                              lang="ar"
                              value={question.promptAr}
                              maxLength={4000}
                              disabled={busy}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, {
                                  promptAr: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field
                            id={`q-${sectionIndex}-${questionIndex}-marks`}
                            label={importsUi.review.marks}
                          >
                            <Input
                              id={`q-${sectionIndex}-${questionIndex}-marks`}
                              type="number"
                              min={0.01}
                              max={100}
                              step={0.01}
                              value={question.marks}
                              disabled={busy}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, {
                                  marks: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field
                            id={`q-${sectionIndex}-${questionIndex}-grading`}
                            label={importsUi.review.gradingMethod}
                          >
                            <Select
                              id={`q-${sectionIndex}-${questionIndex}-grading`}
                              value={question.gradingMethod}
                              disabled={
                                busy || isManualOnlyType(question.type)
                              }
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, {
                                  gradingMethod: event.target
                                    .value as GradingMethod,
                                })
                              }
                            >
                              <option value="automatic">
                                {importsUi.review.automatic.en} ·{" "}
                                {importsUi.review.automatic.ar}
                              </option>
                              <option value="manual">
                                {importsUi.review.manual.en} ·{" "}
                                {importsUi.review.manual.ar}
                              </option>
                            </Select>
                          </Field>
                        </div>

                        {question.type === "multiple_choice" ? (
                          <div className="space-y-2 rounded-lg border border-border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold">
                                <Bi
                                  en={importsUi.review.options.en}
                                  ar={importsUi.review.options.ar}
                                />
                              </h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  updateQuestion(
                                    sectionIndex,
                                    questionIndex,
                                    {
                                      options: [
                                        ...question.options,
                                        { text: "", correct: false },
                                      ],
                                    },
                                  )
                                }
                              >
                                <Plus aria-hidden="true" />
                                <Bi
                                  en={importsUi.review.addOption.en}
                                  ar={importsUi.review.addOption.ar}
                                />
                              </Button>
                            </div>
                            {question.options.map((option, optionIndex) => (
                              <div
                                key={optionIndex}
                                className="flex items-center gap-2"
                              >
                                <span className="w-5 text-xs font-semibold text-muted-foreground">
                                  {String.fromCharCode(65 + optionIndex)}
                                </span>
                                <Input
                                  value={option.text}
                                  maxLength={500}
                                  disabled={busy}
                                  onChange={(event) =>
                                    updateQuestion(
                                      sectionIndex,
                                      questionIndex,
                                      {
                                        options: question.options.map(
                                          (current, index) =>
                                            index === optionIndex
                                              ? {
                                                  ...current,
                                                  text: event.target.value,
                                                }
                                              : current,
                                        ),
                                      },
                                    )
                                  }
                                />
                                <label className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                  <input
                                    type="radio"
                                    name={`correct-${sectionIndex}-${questionIndex}`}
                                    checked={option.correct}
                                    disabled={busy}
                                    onChange={() =>
                                      updateQuestion(
                                        sectionIndex,
                                        questionIndex,
                                        {
                                          options: question.options.map(
                                            (current, index) => ({
                                              ...current,
                                              correct: index === optionIndex,
                                            }),
                                          ),
                                        },
                                      )
                                    }
                                  />
                                  <Bi
                                    en={importsUi.review.correct.en}
                                    ar={importsUi.review.correct.ar}
                                  />
                                </label>
                                <IconButton
                                  label={importsUi.review.remove}
                                  disabled={busy}
                                  onClick={() =>
                                    updateQuestion(
                                      sectionIndex,
                                      questionIndex,
                                      {
                                        options: question.options.filter(
                                          (_, index) => index !== optionIndex,
                                        ),
                                      },
                                    )
                                  }
                                >
                                  <Trash2 aria-hidden="true" />
                                </IconButton>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {question.type === "true_false" ? (
                          <Field
                            id={`q-${sectionIndex}-${questionIndex}-correct`}
                            label={importsUi.review.correctValue}
                          >
                            <Select
                              id={`q-${sectionIndex}-${questionIndex}-correct`}
                              value={question.correctValue ?? ""}
                              disabled={busy}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, {
                                  correctValue:
                                    event.target.value === "true"
                                      ? "true"
                                      : event.target.value === "false"
                                        ? "false"
                                        : null,
                                })
                              }
                            >
                              <option value="">—</option>
                              <option value="true">
                                {importsUi.review.trueLabel.en} ·{" "}
                                {importsUi.review.trueLabel.ar}
                              </option>
                              <option value="false">
                                {importsUi.review.falseLabel.en} ·{" "}
                                {importsUi.review.falseLabel.ar}
                              </option>
                            </Select>
                          </Field>
                        ) : null}

                        {question.type === "matching" ? (
                          <div className="space-y-2 rounded-lg border border-border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold">
                                <Bi
                                  en={importsUi.review.pairs.en}
                                  ar={importsUi.review.pairs.ar}
                                />
                              </h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  updateQuestion(
                                    sectionIndex,
                                    questionIndex,
                                    {
                                      pairs: [
                                        ...question.pairs,
                                        { left: "", right: "" },
                                      ],
                                    },
                                  )
                                }
                              >
                                <Plus aria-hidden="true" />
                                <Bi
                                  en={importsUi.review.addPair.en}
                                  ar={importsUi.review.addPair.ar}
                                />
                              </Button>
                            </div>
                            {question.pairs.map((pair, pairIndex) => (
                              <div
                                key={pairIndex}
                                className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                              >
                                <Input
                                  aria-label={importsUi.review.left.en}
                                  placeholder={`${importsUi.review.left.en} · ${importsUi.review.left.ar}`}
                                  value={pair.left}
                                  maxLength={500}
                                  disabled={busy}
                                  onChange={(event) =>
                                    updateQuestion(
                                      sectionIndex,
                                      questionIndex,
                                      {
                                        pairs: question.pairs.map(
                                          (current, index) =>
                                            index === pairIndex
                                              ? {
                                                  ...current,
                                                  left: event.target.value,
                                                }
                                              : current,
                                        ),
                                      },
                                    )
                                  }
                                />
                                <Input
                                  aria-label={importsUi.review.right.en}
                                  placeholder={`${importsUi.review.right.en} · ${importsUi.review.right.ar}`}
                                  value={pair.right}
                                  maxLength={500}
                                  disabled={busy}
                                  onChange={(event) =>
                                    updateQuestion(
                                      sectionIndex,
                                      questionIndex,
                                      {
                                        pairs: question.pairs.map(
                                          (current, index) =>
                                            index === pairIndex
                                              ? {
                                                  ...current,
                                                  right: event.target.value,
                                                }
                                              : current,
                                        ),
                                      },
                                    )
                                  }
                                />
                                <IconButton
                                  label={importsUi.review.remove}
                                  disabled={busy}
                                  onClick={() =>
                                    updateQuestion(
                                      sectionIndex,
                                      questionIndex,
                                      {
                                        pairs: question.pairs.filter(
                                          (_, index) => index !== pairIndex,
                                        ),
                                      },
                                    )
                                  }
                                >
                                  <Trash2 aria-hidden="true" />
                                </IconButton>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {question.type === "short_answer" ||
                        question.type === "rewrite" ||
                        question.type === "find_the_mistake" ? (
                          <Field
                            id={`q-${sectionIndex}-${questionIndex}-accepted`}
                            label={importsUi.review.accepted}
                            hint={importsUi.review.acceptedHint}
                          >
                            <Textarea
                              id={`q-${sectionIndex}-${questionIndex}-accepted`}
                              value={question.accepted.join("\n")}
                              disabled={busy}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, {
                                  accepted: event.target.value.split(/\r?\n/),
                                })
                              }
                            />
                          </Field>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field
                            id={`q-${sectionIndex}-${questionIndex}-explanation-en`}
                            label={importsUi.review.explanationEn}
                          >
                            <Textarea
                              id={`q-${sectionIndex}-${questionIndex}-explanation-en`}
                              value={question.explanationEn}
                              maxLength={2000}
                              disabled={busy}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, {
                                  explanationEn: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field
                            id={`q-${sectionIndex}-${questionIndex}-explanation-ar`}
                            label={importsUi.review.explanationAr}
                          >
                            <Textarea
                              id={`q-${sectionIndex}-${questionIndex}-explanation-ar`}
                              dir="rtl"
                              lang="ar"
                              value={question.explanationAr}
                              maxLength={2000}
                              disabled={busy}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, {
                                  explanationAr: event.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>

                        {question.raw ? (
                          <details className="rounded-lg border border-border p-2">
                            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                              <Bi
                                en={importsUi.review.rawBlock.en}
                                ar={importsUi.review.rawBlock.ar}
                              />
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                              {question.raw}
                            </pre>
                          </details>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-1">
                          <IconButton
                            label={importsUi.review.moveUp}
                            disabled={busy || questionIndex === 0}
                            onClick={() =>
                              moveQuestion(sectionIndex, questionIndex, -1)
                            }
                          >
                            <ArrowUp aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label={importsUi.review.moveDown}
                            disabled={
                              busy ||
                              questionIndex === section.questions.length - 1
                            }
                            onClick={() =>
                              moveQuestion(sectionIndex, questionIndex, 1)
                            }
                          >
                            <ArrowDown aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label={importsUi.review.delete}
                            variant="destructive"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `${importsUi.review.confirmDeleteQuestion.en}\n${importsUi.review.confirmDeleteQuestion.ar}`,
                                )
                              ) {
                                setSections((previous) =>
                                  previous.map((current, index) =>
                                    index === sectionIndex
                                      ? {
                                          ...current,
                                          questions: current.questions.filter(
                                            (_, innerIndex) =>
                                              innerIndex !== questionIndex,
                                          ),
                                        }
                                      : current,
                                  ),
                                );
                              }
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                          </IconButton>
                        </div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-xs">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <FileText aria-hidden="true" className="size-4" />
            <Bi
              en={importsUi.review.showSource.en}
              ar={importsUi.review.showSource.ar}
            />
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            <Bi
              en={importsUi.review.sourcePrivate.en}
              ar={importsUi.review.sourcePrivate.ar}
            />
          </p>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-secondary/40 p-3 text-xs">
            {initialDraft.sourceText}
          </pre>
        </details>
      </section>

      <Alert variant="info">
        <div className="space-y-1">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            <Bi
              en={importsUi.review.publishNote.en}
              ar={importsUi.review.publishNote.ar}
            />
          </p>
        </div>
      </Alert>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={saveDraft} disabled={busy}>
          <Save aria-hidden="true" />
          <Bi
            en={
              pending === "save"
                ? importsUi.review.saving.en
                : importsUi.review.save.en
            }
            ar={
              pending === "save"
                ? importsUi.review.saving.ar
                : importsUi.review.save.ar
            }
          />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={saveProgress}
          disabled={busy}
        >
          <Bi
            en={
              pending === "progress"
                ? importsUi.review.savingProgress.en
                : importsUi.review.saveProgress.en
            }
            ar={
              pending === "progress"
                ? importsUi.review.savingProgress.ar
                : importsUi.review.saveProgress.ar
            }
          />
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={cancelImport}
          disabled={busy}
        >
          <Trash2 aria-hidden="true" />
          <Bi
            en={
              pending === "cancel"
                ? importsUi.review.cancelling.en
                : importsUi.review.cancel.en
            }
            ar={
              pending === "cancel"
                ? importsUi.review.cancelling.ar
                : importsUi.review.cancel.ar
            }
          />
        </Button>
        <Link
          href="/teacher/assessments/import"
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          <Bi
            en={importsUi.common.backToAssessments.en}
            ar={importsUi.common.backToAssessments.ar}
          />
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: ReactNode; value: number }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-3 py-2">
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  variant = "outline",
  children,
}: {
  label: { en: string; ar: string };
  disabled?: boolean;
  onClick: () => void;
  variant?: "outline" | "destructive";
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${label.en} · ${label.ar}`}
      title={`${label.en} · ${label.ar}`}
    >
      {children}
    </Button>
  );
}
