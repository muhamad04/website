"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { FormField as Field } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createQuestionAction,
  updateQuestionAction,
} from "@/app/(app)/teacher/assessments/actions";
import type {
  GradingMode,
  QuestionRecord,
  QuestionType,
} from "@/lib/domain/types";
import {
  assessmentErrorCopy,
  assessmentsUi,
  questionTypeCopy,
} from "@/lib/i18n/assessments";
import { cn } from "@/lib/utils";
import type {
  AssessmentErrorCode,
  FieldErrors,
} from "@/lib/validation/assessments";
import {
  isAutoGradableType,
  isManualOnlyType,
} from "@/lib/validation/assessments";

type OptionDraft = { text_en: string };
type PairDraft = {
  left_text_en: string;
  right_text_en: string;
};

type Values = {
  type: QuestionType;
  prompt_en: string;
  help_text_en: string;
  marks: string;
  is_required: boolean;
  grading_method: "automatic" | "manual";
  explanation_en: string;
  options: OptionDraft[];
  correct_index: number;
  correct_value: "true" | "false";
  pairs: PairDraft[];
  accepted: string;
  case_sensitive: boolean;
};

function readKey(question: QuestionRecord | undefined): {
  accepted: string;
  caseSensitive: boolean;
} {
  const key = question?.correct_answer;

  if (!key || typeof key !== "object") {
    return { accepted: "", caseSensitive: false };
  }

  const candidate = key as { accepted?: unknown; caseSensitive?: unknown };

  return {
    accepted: Array.isArray(candidate.accepted)
      ? candidate.accepted.filter((item) => typeof item === "string").join("\n")
      : "",
    caseSensitive: candidate.caseSensitive === true,
  };
}

function initialValues(
  question: QuestionRecord | undefined,
  gradingMode: GradingMode,
): Values {
  const key = readKey(question);
  const options = [...(question?.options ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((option) => ({
      text_en: option.text_en,
    }));
  const pairs = [...(question?.pairs ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((pair) => ({
      left_text_en: pair.left_text_en,
      right_text_en: pair.right_text_en,
    }));
  const correctIndex = Math.max(
    0,
    [...(question?.options ?? [])].findIndex((option) => option.is_correct),
  );
  const trueFalseKey =
    question?.correct_answer &&
    typeof question.correct_answer === "object" &&
    (question.correct_answer as { value?: unknown }).value === true;

  const defaultMethod: "automatic" | "manual" =
    gradingMode === "manual" ? "manual" : "automatic";

  return {
    type: question?.type ?? "multiple_choice",
    prompt_en: question?.prompt_en ?? "",
    help_text_en: question?.help_text_en ?? "",
    marks: String(question?.marks ?? 1),
    is_required: question?.is_required ?? true,
    grading_method:
      question?.grading_method ??
      (isManualOnlyType(question?.type ?? "multiple_choice")
        ? "manual"
        : defaultMethod),
    explanation_en: question?.explanation_en ?? "",
    options: options.length >= 2 ? options : [
      { text_en: "" },
      { text_en: "" },
    ],
    correct_index: correctIndex,
    correct_value: trueFalseKey ? "true" : "false",
    pairs: pairs.length >= 2 ? pairs : [
      { left_text_en: "", right_text_en: "" },
      { left_text_en: "", right_text_en: "" },
    ],
    accepted: key.accepted,
    case_sensitive: key.caseSensitive,
  };
}

export function QuestionForm({
  mode,
  assessmentId,
  sectionId,
  gradingMode,
  question,
  typeLocked = false,
}: {
  mode: "create" | "edit";
  assessmentId: string;
  sectionId: string;
  gradingMode: GradingMode;
  question?: QuestionRecord;
  typeLocked?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() =>
    initialValues(question, gradingMode),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AssessmentErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const changeType = (type: QuestionType) => {
    setValues((previous) => ({
      ...previous,
      type,
      grading_method: isManualOnlyType(type)
        ? "manual"
        : gradingMode === "manual"
          ? "manual"
          : previous.grading_method,
    }));
  };

  const updateOption = (index: number, key: keyof OptionDraft, value: string) => {
    setValues((previous) => ({
      ...previous,
      options: previous.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, [key]: value } : option,
      ),
    }));
  };

  const updatePair = (index: number, key: keyof PairDraft, value: string) => {
    setValues((previous) => ({
      ...previous,
      pairs: previous.pairs.map((pair, pairIndex) =>
        pairIndex === index ? { ...pair, [key]: value } : pair,
      ),
    }));
  };

  const textBased =
    values.type === "short_answer" ||
    values.type === "rewrite" ||
    values.type === "find_the_mistake";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const payload = {
      type: values.type,
      prompt_en: values.prompt_en,
      help_text_en: values.help_text_en,
      marks: values.marks,
      is_required: values.is_required,
      grading_method: values.grading_method,
      explanation_en: values.explanation_en,
      options: values.type === "multiple_choice" ? values.options : undefined,
      correct_index:
        values.type === "multiple_choice" ? values.correct_index : undefined,
      correct_value:
        values.type === "true_false" ? values.correct_value : undefined,
      pairs: values.type === "matching" ? values.pairs : undefined,
      accepted: textBased ? values.accepted : undefined,
      case_sensitive: textBased ? values.case_sensitive : undefined,
    };

    startTransition(async () => {
      const outcome =
        mode === "create"
          ? await createQuestionAction({ ...payload, section_id: sectionId })
          : await updateQuestionAction({
              ...payload,
              question_id: question?.id,
            });

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setFormError(outcome.error ?? "unknown");
        return;
      }

      router.push(`/teacher/assessments/${assessmentId}?question=1`);
      router.refresh();
    });
  };

  const allowAutomatic =
    gradingMode !== "manual" &&
    isAutoGradableType(values.type) &&
    !isManualOnlyType(values.type);

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {formError ? (
        <Alert variant="error">
          <Bi
            en={assessmentErrorCopy[formError].en}
            ar={assessmentErrorCopy[formError].ar}
          />
        </Alert>
      ) : null}

      <div className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-xs">
        <Field
          id="type"
          label={assessmentsUi.questionForm.type}
          hint={
            typeLocked
              ? assessmentsUi.questionForm.typeLocked
              : assessmentsUi.questionForm.selectTypeHint
          }
          error={errors.type}
          errorCopy={assessmentErrorCopy}
        >
          <Select
            id="type"
            value={values.type}
            disabled={typeLocked || pending}
            aria-invalid={Boolean(errors.type)}
            onChange={(event) => changeType(event.target.value as QuestionType)}
          >
            {(
              Object.keys(questionTypeCopy) as Array<keyof typeof questionTypeCopy>
            ).map((type) => (
              <option key={type} value={type}>
                {questionTypeCopy[type].en} · {questionTypeCopy[type].ar}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="prompt_en"
            label={assessmentsUi.questionForm.promptEn}
            error={errors.prompt_en}
            errorCopy={assessmentErrorCopy}
          >
            <Textarea
              id="prompt_en"
              value={values.prompt_en}
              aria-invalid={Boolean(errors.prompt_en)}
              onChange={(event) => update("prompt_en", event.target.value)}
              maxLength={4000}
            />
          </Field>

          <Field
            id="help_text_en"
            label={assessmentsUi.questionForm.helpEn}
            error={errors.help_text_en}
            errorCopy={assessmentErrorCopy}
          >
            <Input
              id="help_text_en"
              value={values.help_text_en}
              onChange={(event) => update("help_text_en", event.target.value)}
              maxLength={1000}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            id="marks"
            label={assessmentsUi.questionForm.marks}
            error={errors.marks}
            errorCopy={assessmentErrorCopy}
          >
            <Input
              id="marks"
              type="number"
              min={0.01}
              max={100}
              step={0.25}
              value={values.marks}
              aria-invalid={Boolean(errors.marks)}
              onChange={(event) => update("marks", event.target.value)}
            />
          </Field>

          <Field
            id="grading_method"
            label={assessmentsUi.questionForm.gradingMethod}
            hint={
              isManualOnlyType(values.type)
                ? assessmentsUi.questionForm.gradingForcedManual
                : undefined
            }
            error={errors.grading_method}
            errorCopy={assessmentErrorCopy}
          >
            <Select
              id="grading_method"
              value={values.grading_method}
              disabled={isManualOnlyType(values.type) || gradingMode !== "mixed"}
              aria-invalid={Boolean(errors.grading_method)}
              onChange={(event) =>
                update(
                  "grading_method",
                  event.target.value as Values["grading_method"],
                )
              }
            >
              {allowAutomatic || values.grading_method === "automatic" ? (
                <option value="automatic">
                  {assessmentsUi.questionForm.automatic.en} ·{" "}
                  {assessmentsUi.questionForm.automatic.ar}
                </option>
              ) : null}
              <option value="manual">
                {assessmentsUi.questionForm.manual.en} ·{" "}
                {assessmentsUi.questionForm.manual.ar}
              </option>
            </Select>
          </Field>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={values.is_required}
                onChange={(event) => update("is_required", event.target.checked)}
                className="size-4 rounded border-input"
              />
              <Bi
                en={assessmentsUi.questionForm.required.en}
                ar={assessmentsUi.questionForm.required.ar}
              />
            </label>
          </div>
        </div>
      </div>

      {values.type === "multiple_choice" ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              <Bi
                en={assessmentsUi.questionForm.options.en}
                ar={assessmentsUi.questionForm.options.ar}
              />
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <Bi
                en={assessmentsUi.questionForm.optionsHint.en}
                ar={assessmentsUi.questionForm.optionsHint.ar}
              />
            </p>
          </div>
          {values.options.map((option, index) => (
            <div
              key={index}
              className="flex flex-wrap items-start gap-2 rounded-lg border border-border/70 bg-background/60 p-3"
            >
              <label className="mt-2 flex items-center gap-1 text-xs font-semibold">
                <input
                  type="radio"
                  name="correct_option"
                  checked={values.correct_index === index}
                  onChange={() => update("correct_index", index)}
                  className="size-4"
                />
                <span aria-hidden="true">
                  {String.fromCharCode(65 + index)}
                </span>
              </label>
              <Input
                className="min-w-40 flex-1"
                placeholder={assessmentsUi.questionForm.option.en}
                value={option.text_en}
                onChange={(event) =>
                  updateOption(index, "text_en", event.target.value)
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={assessmentsUi.questionForm.remove.en}
                disabled={values.options.length <= 2}
                onClick={() =>
                  setValues((previous) => ({
                    ...previous,
                    options: previous.options.filter(
                      (_, optionIndex) => optionIndex !== index,
                    ),
                    correct_index:
                      previous.correct_index >= index &&
                      previous.correct_index > 0
                        ? previous.correct_index - 1
                        : previous.correct_index,
                  }))
                }
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          ))}
          {errors.options ? (
            <p role="alert" className="text-xs text-destructive">
              <Bi
                en={assessmentErrorCopy.question_options_invalid.en}
                ar={assessmentErrorCopy.question_options_invalid.ar}
              />
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={values.options.length >= 10}
            onClick={() =>
              setValues((previous) => ({
                ...previous,
                options: [...previous.options, { text_en: "" }],
              }))
            }
          >
            <Plus aria-hidden="true" className="size-3.5" />
            <Bi
              en={assessmentsUi.questionForm.addOption.en}
              ar={assessmentsUi.questionForm.addOption.ar}
            />
          </Button>
        </div>
      ) : null}

      {values.type === "true_false" ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
          <p className="text-sm font-bold text-foreground">
            <Bi
              en={assessmentsUi.questionForm.correct.en}
              ar={assessmentsUi.questionForm.correct.ar}
            />
          </p>
          <div className="flex flex-wrap gap-4">
            {(["true", "false"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="correct_value"
                  checked={values.correct_value === value}
                  onChange={() => update("correct_value", value)}
                  className="size-4"
                />
                <Bi
                  en={
                    value === "true"
                      ? assessmentsUi.questionForm.trueLabel.en
                      : assessmentsUi.questionForm.falseLabel.en
                  }
                  ar={
                    value === "true"
                      ? assessmentsUi.questionForm.trueLabel.ar
                      : assessmentsUi.questionForm.falseLabel.ar
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {values.type === "matching" ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              <Bi
                en={assessmentsUi.questionForm.pairs.en}
                ar={assessmentsUi.questionForm.pairs.ar}
              />
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <Bi
                en={assessmentsUi.questionForm.pairsHint.en}
                ar={assessmentsUi.questionForm.pairsHint.ar}
              />
            </p>
          </div>
          {values.pairs.map((pair, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-border/70 bg-background/60 p-3 sm:grid-cols-2"
            >
              <Input
                placeholder={assessmentsUi.questionForm.left.en}
                value={pair.left_text_en}
                onChange={(event) =>
                  updatePair(index, "left_text_en", event.target.value)
                }
              />
              <Input
                placeholder={assessmentsUi.questionForm.right.en}
                value={pair.right_text_en}
                onChange={(event) =>
                  updatePair(index, "right_text_en", event.target.value)
                }
              />
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={values.pairs.length <= 2}
                  onClick={() =>
                    setValues((previous) => ({
                      ...previous,
                      pairs: previous.pairs.filter(
                        (_, pairIndex) => pairIndex !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  <Bi
                    en={assessmentsUi.questionForm.remove.en}
                    ar={assessmentsUi.questionForm.remove.ar}
                  />
                </Button>
              </div>
            </div>
          ))}
          {errors.pairs ? (
            <p role="alert" className="text-xs text-destructive">
              <Bi
                en={assessmentErrorCopy.question_pairs_invalid.en}
                ar={assessmentErrorCopy.question_pairs_invalid.ar}
              />
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={values.pairs.length >= 10}
            onClick={() =>
              setValues((previous) => ({
                ...previous,
                pairs: [
                  ...previous.pairs,
                  {
                    left_text_en: "",
                    right_text_en: "",
                  },
                ],
              }))
            }
          >
            <Plus aria-hidden="true" className="size-3.5" />
            <Bi
              en={assessmentsUi.questionForm.addPair.en}
              ar={assessmentsUi.questionForm.addPair.ar}
            />
          </Button>
        </div>
      ) : null}

      {textBased ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
          <Field
            id="accepted"
            label={assessmentsUi.questionForm.accepted}
            hint={assessmentsUi.questionForm.acceptedHint}
            error={errors.accepted}
            errorCopy={assessmentErrorCopy}
          >
            <Textarea
              id="accepted"
              value={values.accepted}
              aria-invalid={Boolean(errors.accepted)}
              onChange={(event) => update("accepted", event.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              checked={values.case_sensitive}
              onChange={(event) => update("case_sensitive", event.target.checked)}
              className="size-4 rounded border-input"
            />
            <Bi
              en={assessmentsUi.questionForm.caseSensitive.en}
              ar={assessmentsUi.questionForm.caseSensitive.ar}
            />
          </label>
        </div>
      ) : null}

      {values.type === "essay" || values.type === "file_upload" ? (
        <Alert variant="info">
          <Bi
            en={
              values.type === "essay"
                ? assessmentsUi.questionForm.essayHint.en
                : assessmentsUi.questionForm.fileHint.en
            }
            ar={
              values.type === "essay"
                ? assessmentsUi.questionForm.essayHint.ar
                : assessmentsUi.questionForm.fileHint.ar
            }
          />
        </Alert>
      ) : null}

      {(values.type === "essay" ||
        values.type === "file_upload" ||
        textBased) && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <Field
            id="explanation_en"
            label={assessmentsUi.questionForm.explanationEn}
            hint={assessmentsUi.questionForm.explanationHint}
            error={errors.explanation_en}
            errorCopy={assessmentErrorCopy}
          >
            <Textarea
              id="explanation_en"
              value={values.explanation_en}
              onChange={(event) =>
                update("explanation_en", event.target.value)
              }
            />
          </Field>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Bi
            en={
              pending
                ? assessmentsUi.actions.saving.en
                : assessmentsUi.actions.saveQuestion.en
            }
            ar={
              pending
                ? assessmentsUi.actions.saving.ar
                : assessmentsUi.actions.saveQuestion.ar
            }
          />
        </Button>
        <Link
          href={`/teacher/assessments/${assessmentId}`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Bi
            en={assessmentsUi.actions.cancel.en}
            ar={assessmentsUi.actions.cancel.ar}
          />
        </Link>
      </div>
    </form>
  );
}
