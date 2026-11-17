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
} from "@/lib/i18n/assessments";
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
}: {
  assessmentId: string;
  label:
    | typeof assessmentsUi.actions.start
    | typeof assessmentsUi.actions.resume;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [error, setError] = useState<AssessmentErrorCode | null>(null);
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

      router.push(outcome.redirectTo);
      router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={start}
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
  );
}
