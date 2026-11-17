import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AlarmClock } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { AttemptRunner } from "@/components/assessments/attempt-runner";
import { Badge } from "@/components/ui/badge";
import { requireStudent } from "@/lib/auth/dal";
import { getStudentAttemptPayload } from "@/lib/data/assessments";
import { finalizeAttempt } from "@/lib/assessments/finalize";
import {
  assessmentTypeCopy,
  assessmentsUi,
} from "@/lib/i18n/assessments";
import { isUuid } from "@/lib/search";

export const metadata: Metadata = {
  title: "Attempt · المحاولة",
};

export const dynamic = "force-dynamic";

function fileNameFromPath(path: string | null): string | null {
  if (!path) {
    return null;
  }

  return path.split("/").pop() ?? path;
}

export default async function StudentAttemptPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const student = await requireStudent();
  const { id, attemptId } = await params;

  if (!isUuid(id) || !isUuid(attemptId)) {
    notFound();
  }

  const { payload, error } = await getStudentAttemptPayload(attemptId);

  if (error || !payload) {
    redirect(`/student/assessments/${id}`);
  }

  if (payload.assessment.id !== id) {
    notFound();
  }

  if (payload.attempt.submitted_at) {
    redirect(`/student/assessments/${id}/attempt/${attemptId}/result`);
  }

  // The timer can run out between pages. Close the attempt before rendering a
  // form the database would reject anyway.
  if (Date.parse(payload.attempt.expires_at) <= Date.parse(payload.server_time)) {
    const outcome = await finalizeAttempt({
      attemptId,
      studentId: student.id,
    });

    if (!outcome.ok) {
      redirect(`/student/assessments/${id}`);
    }

    redirect(`/student/assessments/${id}/attempt/${attemptId}/result`);
  }

  const fileQuestionIds = new Set(
    payload.sections.flatMap((section) =>
      section.questions
        .filter((question) => question.type === "file_upload")
        .map((question) => question.id),
    ),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi
            en={assessmentTypeCopy[payload.assessment.type].en}
            ar={assessmentTypeCopy[payload.assessment.type].ar}
          />
        }
        title={
          <Bi
            en={payload.assessment.title_en}
            ar={payload.assessment.title_ar}
          />
        }
        description={
          payload.assessment.instructions_en ||
          payload.assessment.instructions_ar ? (
            <Bi
              en={payload.assessment.instructions_en ?? ""}
              ar={payload.assessment.instructions_ar ?? ""}
            />
          ) : (
            <Bi
              en={assessmentsUi.student.autoSubmit.en}
              ar={assessmentsUi.student.autoSubmit.ar}
            />
          )
        }
        actions={
          <Badge variant="muted">
            <AlarmClock aria-hidden="true" className="size-3.5" />
            <Bi
              en={`${assessmentsUi.student.attemptNumber.en} #${payload.attempt.number}`}
              ar={`${assessmentsUi.student.attemptNumber.ar} #${payload.attempt.number}`}
            />
          </Badge>
        }
      />

      <AttemptRunner
        attemptId={payload.attempt.id}
        assessmentId={payload.assessment.id}
        expiresAt={payload.attempt.expires_at}
        serverTime={payload.server_time}
        sections={payload.sections}
        initialAnswers={payload.answers.map((answer) => ({
          question_id: answer.question_id,
          response: answer.response,
          file_path: answer.file_path,
          file_name: fileQuestionIds.has(answer.question_id)
            ? fileNameFromPath(answer.file_path)
            : null,
        }))}
      />
    </div>
  );
}
