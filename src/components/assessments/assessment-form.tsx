"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bi } from "@/components/bilingual";
import { FormField as Field } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createAssessmentAction,
  updateAssessmentAction,
} from "@/app/(app)/teacher/assessments/actions";
import type { AssessmentRecord, GradeSummary } from "@/lib/domain/types";
import {
  assessmentErrorCopy,
  assessmentTypeCopy,
  assessmentsUi,
} from "@/lib/i18n/assessments";
import { cn } from "@/lib/utils";
import type {
  AssessmentErrorCode,
  FieldErrors,
} from "@/lib/validation/assessments";

type Values = {
  type: "quiz" | "exam";
  title_en: string;
  title_ar: string;
  instructions_en: string;
  instructions_ar: string;
  grade_id: string;
  time_limit_minutes: string;
  results_visibility: "immediately" | "after_review" | "hidden";
  grading_mode: "automatic" | "manual" | "mixed";
  allow_retakes: boolean;
  max_attempts: string;
  available_from: string;
  available_until: string;
  is_published: boolean;
};

function toLocalInput(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function initialValues(
  assessment: AssessmentRecord | undefined,
  grades: GradeSummary[],
  defaultGradeId: string | undefined,
): Values {
  return {
    type: assessment?.type ?? "quiz",
    title_en: assessment?.title_en ?? "",
    title_ar: assessment?.title_ar ?? "",
    instructions_en: assessment?.instructions_en ?? "",
    instructions_ar: assessment?.instructions_ar ?? "",
    grade_id: assessment?.grade_id ?? defaultGradeId ?? grades[0]?.id ?? "",
    time_limit_minutes: String(assessment?.time_limit_minutes ?? 30),
    results_visibility: assessment?.results_visibility ?? "after_review",
    grading_mode: assessment?.grading_mode ?? "automatic",
    allow_retakes: assessment?.allow_retakes ?? false,
    max_attempts: String(assessment?.max_attempts ?? 1),
    available_from: toLocalInput(assessment?.available_from ?? null),
    available_until: toLocalInput(assessment?.available_until ?? null),
    is_published: assessment?.is_published ?? false,
  };
}

export function AssessmentForm({
  mode,
  assessment,
  grades,
  defaultGradeId,
}: {
  mode: "create" | "edit";
  assessment?: AssessmentRecord;
  grades: GradeSummary[];
  defaultGradeId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() =>
    initialValues(assessment, grades, defaultGradeId),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AssessmentErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const changeType = (type: "quiz" | "exam") => {
    setValues((previous) => {
      if (type === "exam") {
        return { ...previous, type, allow_retakes: false, max_attempts: "1" };
      }

      return { ...previous, type };
    });
  };

  const changeRetakes = (allow: boolean) => {
    setValues((previous) => ({
      ...previous,
      allow_retakes: allow,
      max_attempts: allow ? (previous.max_attempts === "1" ? "2" : previous.max_attempts) : "1",
    }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const iso = (value: string) => {
      if (!value) {
        return "";
      }

      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    };

    const payload = {
      type: values.type,
      title_en: values.title_en,
      title_ar: values.title_ar,
      instructions_en: values.instructions_en,
      instructions_ar: values.instructions_ar,
      grade_id: values.grade_id,
      time_limit_minutes: values.time_limit_minutes,
      results_visibility: values.results_visibility,
      grading_mode: values.grading_mode,
      allow_retakes: values.allow_retakes,
      max_attempts: values.allow_retakes ? values.max_attempts : "1",
      available_from: iso(values.available_from),
      available_until: iso(values.available_until),
      is_published: values.is_published,
    };

    startTransition(async () => {
      const outcome =
        mode === "create"
          ? await createAssessmentAction(payload)
          : await updateAssessmentAction({
              ...payload,
              assessment_id: assessment?.id,
            });

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setFormError(outcome.error ?? "unknown");
        return;
      }

      const id = outcome.assessmentId ?? assessment?.id ?? "";
      router.push(
        mode === "create"
          ? `/teacher/assessments/${id}?created=1`
          : `/teacher/assessments/${id}?updated=1`,
      );
      router.refresh();
    });
  };

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
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="type"
            label={assessmentsUi.form.type}
            hint={assessmentsUi.form.typeHint}
            error={errors.type}
            errorCopy={assessmentErrorCopy}
          >
            <Select
              id="type"
              value={values.type}
              aria-invalid={Boolean(errors.type)}
              onChange={(event) =>
                changeType(event.target.value as "quiz" | "exam")
              }
            >
              <option value="quiz">
                {assessmentTypeCopy.quiz.en} · {assessmentTypeCopy.quiz.ar}
              </option>
              <option value="exam">
                {assessmentTypeCopy.exam.en} · {assessmentTypeCopy.exam.ar}
              </option>
            </Select>
          </Field>

          <Field
            id="grade_id"
            label={assessmentsUi.form.grade}
            hint={assessmentsUi.form.gradeHint}
            error={errors.grade_id}
            errorCopy={assessmentErrorCopy}
          >
            <Select
              id="grade_id"
              value={values.grade_id}
              aria-invalid={Boolean(errors.grade_id)}
              onChange={(event) => update("grade_id", event.target.value)}
            >
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name_en} · {grade.name_ar}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="title_en"
            label={assessmentsUi.form.titleEn}
            error={errors.title_en}
            errorCopy={assessmentErrorCopy}
          >
            <Input
              id="title_en"
              value={values.title_en}
              aria-invalid={Boolean(errors.title_en)}
              onChange={(event) => update("title_en", event.target.value)}
              maxLength={200}
            />
          </Field>

          <Field
            id="title_ar"
            label={assessmentsUi.form.titleAr}
            error={errors.title_ar}
            errorCopy={assessmentErrorCopy}
          >
            <Input
              id="title_ar"
              dir="rtl"
              className="font-arabic"
              value={values.title_ar}
              aria-invalid={Boolean(errors.title_ar)}
              onChange={(event) => update("title_ar", event.target.value)}
              maxLength={200}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="instructions_en"
            label={assessmentsUi.form.instructionsEn}
            error={errors.instructions_en}
            errorCopy={assessmentErrorCopy}
          >
            <Textarea
              id="instructions_en"
              value={values.instructions_en}
              onChange={(event) => update("instructions_en", event.target.value)}
              maxLength={4000}
            />
          </Field>

          <Field
            id="instructions_ar"
            label={assessmentsUi.form.instructionsAr}
            error={errors.instructions_ar}
            errorCopy={assessmentErrorCopy}
          >
            <Textarea
              id="instructions_ar"
              dir="rtl"
              className="font-arabic"
              value={values.instructions_ar}
              onChange={(event) => update("instructions_ar", event.target.value)}
              maxLength={4000}
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="time_limit_minutes"
            label={assessmentsUi.form.timeLimit}
            hint={assessmentsUi.form.timeLimitHint}
            error={errors.time_limit_minutes}
            errorCopy={assessmentErrorCopy}
          >
            <Input
              id="time_limit_minutes"
              type="number"
              min={1}
              max={600}
              value={values.time_limit_minutes}
              aria-invalid={Boolean(errors.time_limit_minutes)}
              onChange={(event) =>
                update("time_limit_minutes", event.target.value)
              }
            />
          </Field>

          <Field
            id="results_visibility"
            label={assessmentsUi.form.visibility}
            hint={assessmentsUi.form.visibilityHint}
            error={errors.results_visibility}
            errorCopy={assessmentErrorCopy}
          >
            <Select
              id="results_visibility"
              value={values.results_visibility}
              onChange={(event) =>
                update(
                  "results_visibility",
                  event.target.value as Values["results_visibility"],
                )
              }
            >
              <option value="immediately">
                {assessmentsUi.form.visibilityImmediately.en} ·{" "}
                {assessmentsUi.form.visibilityImmediately.ar}
              </option>
              <option value="after_review">
                {assessmentsUi.form.visibilityAfterReview.en} ·{" "}
                {assessmentsUi.form.visibilityAfterReview.ar}
              </option>
              <option value="hidden">
                {assessmentsUi.form.visibilityHidden.en} ·{" "}
                {assessmentsUi.form.visibilityHidden.ar}
              </option>
            </Select>
          </Field>

          <Field
            id="grading_mode"
            label={assessmentsUi.form.gradingMode}
            hint={assessmentsUi.form.gradingHint}
            error={errors.grading_mode}
            errorCopy={assessmentErrorCopy}
          >
            <Select
              id="grading_mode"
              value={values.grading_mode}
              onChange={(event) =>
                update(
                  "grading_mode",
                  event.target.value as Values["grading_mode"],
                )
              }
            >
              <option value="automatic">
                {assessmentsUi.form.gradingAutomatic.en} ·{" "}
                {assessmentsUi.form.gradingAutomatic.ar}
              </option>
              <option value="mixed">
                {assessmentsUi.form.gradingMixed.en} ·{" "}
                {assessmentsUi.form.gradingMixed.ar}
              </option>
              <option value="manual">
                {assessmentsUi.form.gradingManual.en} ·{" "}
                {assessmentsUi.form.gradingManual.ar}
              </option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={values.allow_retakes}
                onChange={(event) => changeRetakes(event.target.checked)}
                className="size-4 rounded border-input"
              />
              <Bi
                en={assessmentsUi.form.allowRetakes.en}
                ar={assessmentsUi.form.allowRetakes.ar}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              <Bi
                en={assessmentsUi.form.allowRetakesHint.en}
                ar={assessmentsUi.form.allowRetakesHint.ar}
              />
            </p>
          </div>

          <Field
            id="max_attempts"
            label={assessmentsUi.form.maxAttempts}
            hint={assessmentsUi.form.maxAttemptsHint}
            error={errors.max_attempts}
            errorCopy={assessmentErrorCopy}
          >
            <Input
              id="max_attempts"
              type="number"
              min={values.allow_retakes ? 2 : 1}
              max={10}
              disabled={!values.allow_retakes}
              value={values.allow_retakes ? values.max_attempts : "1"}
              aria-invalid={Boolean(errors.max_attempts)}
              onChange={(event) => update("max_attempts", event.target.value)}
            />
          </Field>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={values.is_published}
                onChange={(event) => update("is_published", event.target.checked)}
                className="size-4 rounded border-input"
              />
              <Bi
                en={assessmentsUi.form.publish.en}
                ar={assessmentsUi.form.publish.ar}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              <Bi
                en={assessmentsUi.form.publishHint.en}
                ar={assessmentsUi.form.publishHint.ar}
              />
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="available_from"
            label={assessmentsUi.form.availableFrom}
            hint={assessmentsUi.form.availabilityHint}
            error={errors.available_from}
            errorCopy={assessmentErrorCopy}
          >
            <Input
              id="available_from"
              type="datetime-local"
              value={values.available_from}
              onChange={(event) => update("available_from", event.target.value)}
            />
          </Field>

          <Field
            id="available_until"
            label={assessmentsUi.form.availableUntil}
            error={errors.available_until}
            errorCopy={assessmentErrorCopy}
          >
            <Input
              id="available_until"
              type="datetime-local"
              value={values.available_until}
              onChange={(event) => update("available_until", event.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Bi
            en={
              pending
                ? assessmentsUi.actions.saving.en
                : mode === "create"
                  ? assessmentsUi.actions.create.en
                  : assessmentsUi.actions.save.en
            }
            ar={
              pending
                ? assessmentsUi.actions.saving.ar
                : mode === "create"
                  ? assessmentsUi.actions.create.ar
                  : assessmentsUi.actions.save.ar
            }
          />
        </Button>
        <Link
          href={
            assessment
              ? `/teacher/assessments/${assessment.id}`
              : "/teacher/assessments"
          }
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
