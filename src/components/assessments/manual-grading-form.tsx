"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bi } from "@/components/bilingual";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { gradeAttemptAction } from "@/app/(app)/teacher/assessments/actions";
import {
  assessmentErrorCopy,
  assessmentsUi,
} from "@/lib/i18n/assessments";
import type { AssessmentErrorCode } from "@/lib/validation/assessments";

export type GradingRow = {
  answer_id: string;
  prompt_en: string;
  prompt_ar: string | null;
  marks: number;
  marks_awarded: number | null;
  feedback_en: string | null;
  feedback_ar: string | null;
  response_text: string | null;
  response_pairs: string[];
  file_url: string | null;
  file_name: string | null;
};

export function ManualGradingForm({
  attemptId,
  rows,
}: {
  attemptId: string;
  rows: GradingRow[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(() =>
    rows.map((row) => ({
      answer_id: row.answer_id,
      marks_awarded:
        row.marks_awarded === null ? "" : String(row.marks_awarded),
      feedback_en: row.feedback_en ?? "",
      feedback_ar: row.feedback_ar ?? "",
      max: row.marks,
    })),
  );
  const [error, setError] = useState<AssessmentErrorCode | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = (
    index: number,
    key: "marks_awarded" | "feedback_en" | "feedback_ar",
    value: string,
  ) => {
    setSaved(false);
    setValues((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const grades = values
      .filter((row) => row.marks_awarded.trim() !== "")
      .map((row) => ({
        answer_id: row.answer_id,
        marks_awarded: row.marks_awarded,
        feedback_en: row.feedback_en,
        feedback_ar: row.feedback_ar,
      }));

    if (grades.length === 0) {
      setError("question_marks_invalid");
      return;
    }

    startTransition(async () => {
      const outcome = await gradeAttemptAction({
        attempt_id: attemptId,
        grades,
      });

      if (!outcome.ok) {
        setError(outcome.error ?? "unknown");
        return;
      }

      setSaved(true);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="error">
          <Bi en={assessmentErrorCopy[error].en} ar={assessmentErrorCopy[error].ar} />
        </Alert>
      ) : null}

      {saved ? (
        <Alert variant="success">
          <Bi
            en={assessmentsUi.results.saved.en}
            ar={assessmentsUi.results.saved.ar}
          />
        </Alert>
      ) : null}

      <ol className="space-y-4">
        {rows.map((row, index) => {
          const value = values[index];

          return (
            <li
              key={row.answer_id}
              className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  <Bi
                    en={row.prompt_en}
                    ar={row.prompt_ar ?? row.prompt_en}
                  />
                </p>
                <span className="text-xs text-muted-foreground">
                  {row.marks}{" "}
                  {assessmentsUi.builder.questionMarks.en}
                </span>
              </div>

              <div className="mt-3 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Bi
                    en={assessmentsUi.results.responseTitle.en}
                    ar={assessmentsUi.results.responseTitle.ar}
                  />
                </p>

                {row.file_url ? (
                  <p className="mt-1">
                    <a
                      href={row.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-primary underline underline-offset-2"
                    >
                      {row.file_name ??
                        assessmentsUi.results.fileAnswer.en}{" "}
                      · {assessmentsUi.results.fileAnswer.ar}
                    </a>
                  </p>
                ) : null}

                {row.response_text ? (
                  <p className="mt-1 whitespace-pre-wrap text-foreground">
                    {row.response_text}
                  </p>
                ) : null}

                {row.response_pairs.length > 0 ? (
                  <ul className="mt-1 list-disc space-y-0.5 ps-5">
                    {row.response_pairs.map((pair, pairIndex) => (
                      <li key={pairIndex} className="text-foreground">
                        {pair}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!row.response_text &&
                !row.file_url &&
                row.response_pairs.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    <Bi
                      en={assessmentsUi.results.noAnswer.en}
                      ar={assessmentsUi.results.noAnswer.ar}
                    />
                  </p>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-foreground">
                    <Bi
                      en={assessmentsUi.results.manualMarks.en}
                      ar={assessmentsUi.results.manualMarks.ar}
                    />
                    <span className="text-muted-foreground"> / {row.marks}</span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={row.marks}
                    step={0.25}
                    value={value.marks_awarded}
                    onChange={(event) =>
                      update(index, "marks_awarded", event.target.value)
                    }
                    aria-label={`${assessmentsUi.results.manualMarks.en} ${index + 1}`}
                  />
                </label>

                <div className="grid gap-3">
                  <Textarea
                    value={value.feedback_en}
                    placeholder={assessmentsUi.results.feedbackEn.en}
                    onChange={(event) =>
                      update(index, "feedback_en", event.target.value)
                    }
                    className="min-h-20"
                    aria-label={assessmentsUi.results.feedbackEn.en}
                  />
                  <Textarea
                    dir="rtl"
                    className="min-h-20 font-arabic"
                    value={value.feedback_ar}
                    placeholder={assessmentsUi.results.feedbackAr.ar}
                    onChange={(event) =>
                      update(index, "feedback_ar", event.target.value)
                    }
                    aria-label={assessmentsUi.results.feedbackAr.ar}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <Button type="submit" disabled={pending}>
        <Bi
          en={
            pending
              ? assessmentsUi.actions.grading.en
              : assessmentsUi.actions.grade.en
          }
          ar={
            pending
              ? assessmentsUi.actions.grading.ar
              : assessmentsUi.actions.grade.ar
          }
        />
      </Button>
    </form>
  );
}
