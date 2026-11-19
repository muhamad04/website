"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Play, Trash2 } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import {
  deleteAssessmentAction,
  setAssessmentPublishedAction,
} from "@/app/(app)/teacher/assessments/actions";
import { startAttemptAction } from "@/app/(app)/student/assessments/actions";
import {
  assessmentErrorCopy,
  assessmentsUi,
  resultsVisibilityCopy,
} from "@/lib/i18n/assessments";
import type { StartConfirmation } from "@/lib/assessments/strict";
import type { AssessmentErrorCode } from "@/lib/validation/assessments";

export function AssessmentPublishToggle({
  assessmentId,
  isPublished,
}: {
  assessmentId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<AssessmentErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    setError(null);

    startTransition(async () => {
      const outcome = await setAssessmentPublishedAction({
        assessment_id: assessmentId,
        is_published: isPublished ? "false" : "true",
      });

      if (!outcome.ok) {
        setError(outcome.error ?? "unknown");
        return;
      }

      router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={toggle}
      >
        {isPublished ? (
          <EyeOff aria-hidden="true" className="size-3.5" />
        ) : (
          <Eye aria-hidden="true" className="size-3.5" />
        )}
        <Bi
          en={
            pending
              ? assessmentsUi.actions.working.en
              : isPublished
                ? assessmentsUi.actions.unpublish.en
                : assessmentsUi.actions.publish.en
          }
          ar={
            pending
              ? assessmentsUi.actions.working.ar
              : isPublished
                ? assessmentsUi.actions.unpublish.ar
                : assessmentsUi.actions.publish.ar
          }
        />
      </Button>
      {error ? (
        <span role="alert" className="text-[11px] text-destructive">
          <Bi
            en={assessmentErrorCopy[error].en}
            ar={assessmentErrorCopy[error].ar}
          />
        </span>
      ) : null}
    </span>
  );
}

export function DeleteAssessmentButton({
  assessmentId,
  redirectToList = false,
}: {
  assessmentId: string;
  redirectToList?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<AssessmentErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    const confirmed = window.confirm(
      `${assessmentsUi.actions.confirmDelete.en}\n${assessmentsUi.actions.deleteWarning.en}\n\n${assessmentsUi.actions.confirmDelete.ar}\n${assessmentsUi.actions.deleteWarning.ar}`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const outcome = await deleteAssessmentAction({
        assessment_id: assessmentId,
      });

      if (!outcome.ok) {
        setError(outcome.error ?? "unknown");
        return;
      }

      if (redirectToList) {
        router.push("/teacher/assessments?deleted=1");
      } else {
        router.refresh();
      }
    });
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={remove}
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
        <Bi
          en={
            pending
              ? assessmentsUi.actions.deleting.en
              : assessmentsUi.actions.delete.en
          }
          ar={
            pending
              ? assessmentsUi.actions.deleting.ar
              : assessmentsUi.actions.delete.ar
          }
        />
      </Button>
      {error ? (
        <span role="alert" className="text-[11px] text-destructive">
          <Bi
            en={assessmentErrorCopy[error].en}
            ar={assessmentErrorCopy[error].ar}
          />
        </span>
      ) : null}
    </span>
  );
}

export function StartAttemptButton({
  assessmentId,
  label,
  variant = "default",
  confirmation,
}: {
  assessmentId: string;
  label:
    | typeof assessmentsUi.actions.start
    | typeof assessmentsUi.actions.resume;
  variant?: "default" | "outline";
  confirmation?: StartConfirmation;
}) {
  const router = useRouter();
  const [error, setError] = useState<AssessmentErrorCode | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const start = () => {
    setError(null);

    startTransition(async () => {
      const outcome = await startAttemptAction({
        assessment_id: assessmentId,
      });

      if (!outcome.ok || !outcome.redirectTo) {
        setError(outcome.error ?? "unknown");
        return;
      }

      setConfirming(false);
      router.push(outcome.redirectTo);
      router.refresh();
    });
  };

  return (
    <>
      <span className="inline-flex flex-col gap-1">
        <Button
          type="button"
          size="sm"
          variant={variant}
          disabled={pending}
          onClick={() => {
            if (confirmation) {
              setConfirming(true);
            } else {
              start();
            }
          }}
        >
          <Play aria-hidden="true" className="size-3.5" />
          <Bi
            en={pending ? assessmentsUi.actions.starting.en : label.en}
            ar={pending ? assessmentsUi.actions.starting.ar : label.ar}
          />
        </Button>
        {error ? (
          <span role="alert" className="text-[11px] text-destructive">
            <Bi
              en={assessmentErrorCopy[error].en}
              ar={assessmentErrorCopy[error].ar}
            />
          </span>
        ) : null}
      </span>

      {confirming && confirmation ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`start-title-${assessmentId}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl sm:p-6">
            <h2
              id={`start-title-${assessmentId}`}
              className="text-base font-bold text-foreground"
            >
              <Bi
                en={assessmentsUi.strict.confirmationTitle.en}
                ar={assessmentsUi.strict.confirmationTitle.ar}
              />
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <Bi
                en={assessmentsUi.strict.confirmationIntro.en}
                ar={assessmentsUi.strict.confirmationIntro.ar}
              />
            </p>

            {confirmation.strictWarning ? (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                <Bi
                  en={assessmentsUi.strict.warning.en}
                  ar={assessmentsUi.strict.warning.ar}
                />
              </div>
            ) : null}

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">
                  <Bi
                    en={assessmentsUi.strict.timed.en}
                    ar={assessmentsUi.strict.timed.ar}
                  />
                </dt>
                <dd className="text-end font-medium">
                  {confirmation.timeLimitMinutes}{" "}
                  <Bi
                    en={assessmentsUi.student.minutes.en}
                    ar={assessmentsUi.student.minutes.ar}
                  />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">
                  <Bi
                    en={assessmentsUi.strict.attempts.en}
                    ar={assessmentsUi.strict.attempts.ar}
                  />
                </dt>
                <dd className="text-end font-medium tabular-nums">
                  {confirmation.attemptsUsed}/{confirmation.maxAttempts}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">
                  <Bi
                    en={
                      confirmation.leavingSubmits
                        ? assessmentsUi.strict.leaving.en
                        : assessmentsUi.strict.leavingNo.en
                    }
                    ar={
                      confirmation.leavingSubmits
                        ? assessmentsUi.strict.leaving.ar
                        : assessmentsUi.strict.leavingNo.ar
                    }
                  />
                </dt>
                <dd className="text-end font-medium">
                  <Bi
                    en={confirmation.leavingSubmits ? "Yes" : "No"}
                    ar={confirmation.leavingSubmits ? "نعم" : "لا"}
                  />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">
                  <Bi
                    en={assessmentsUi.strict.resultsRule.en}
                    ar={assessmentsUi.strict.resultsRule.ar}
                  />
                </dt>
                <dd className="text-end font-medium">
                  <Bi
                    en={resultsVisibilityCopy[confirmation.resultsVisibility].en}
                    ar={resultsVisibilityCopy[confirmation.resultsVisibility].ar}
                  />
                </dd>
              </div>
            </dl>

            {confirmation.strictWarning ? (
              <p className="mt-4 text-xs text-muted-foreground">
                <Bi
                  en={assessmentsUi.strict.notFoolproof.en}
                  ar={assessmentsUi.strict.notFoolproof.ar}
                />
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                <Bi
                  en={assessmentsUi.strict.back.en}
                  ar={assessmentsUi.strict.back.ar}
                />
              </Button>
              <Button type="button" size="sm" disabled={pending} onClick={start}>
                <Play aria-hidden="true" className="size-3.5" />
                <Bi
                  en={
                    pending
                      ? assessmentsUi.actions.starting.en
                      : assessmentsUi.strict.startConfirm.en
                  }
                  ar={
                    pending
                      ? assessmentsUi.actions.starting.ar
                      : assessmentsUi.strict.startConfirm.ar
                  }
                />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
