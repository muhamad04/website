import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { ManualGradingForm } from "@/components/assessments/manual-grading-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/lib/auth/dal";
import { getAttemptForGrading } from "@/lib/data/assessments";
import { createSignedSubmissionUrl } from "@/lib/assessments/storage";
import {
  assessmentsUi,
  attemptStatusCopy,
} from "@/lib/i18n/assessments";
import { formatAdminDateTime } from "@/lib/students/format";
import { isUuid } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Grade attempt · تصحيح المحاولة",
};

export const dynamic = "force-dynamic";

function fileNameFromPath(path: string | null): string | null {
  if (!path) {
    return null;
  }

  return path.split("/").pop() ?? path;
}

export default async function GradeAttemptPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  await requireTeacher();

  const { id, attemptId } = await params;

  if (!isUuid(id) || !isUuid(attemptId)) {
    notFound();
  }

  const data = await getAttemptForGrading(attemptId);

  if (!data || data.attempt.assessment_id !== id) {
    notFound();
  }

  const answersByQuestion = new Map(
    data.answers.map((answer) => [answer.question_id, answer]),
  );
  const manualQuestions = data.detail.sections.flatMap((section) =>
    section.questions.filter(
      (question) =>
        question.grading_method === "manual" ||
        data.detail.grading_mode === "manual",
    ),
  );

  const rows = await Promise.all(
    manualQuestions.map(async (question) => {
      const answer = answersByQuestion.get(question.id);
      const response = answer?.response ?? {};
      const text =
        typeof (response as { text?: unknown }).text === "string"
          ? ((response as { text: string }).text as string)
          : null;
      const rawPairs = (response as { pairs?: unknown }).pairs;
      const pairs =
        rawPairs && typeof rawPairs === "object" && !Array.isArray(rawPairs)
          ? Object.entries(rawPairs as Record<string, string>).map(
              ([left, right]) => `${left} → ${right}`,
            )
          : [];
      const fileUrl = answer?.file_path
        ? await createSignedSubmissionUrl(answer.file_path)
        : null;

      return {
        answer_id: answer?.id ?? `unanswered-${question.id}`,
        prompt_en: question.prompt_en,
        prompt_ar: question.prompt_ar,
        topic_en: question.topic_en,
        min_words: question.min_words,
        max_words: question.max_words,
        rubric_en: question.rubric_en,
        marks: question.marks,
        marks_awarded:
          answer?.marks_awarded === null || answer?.marks_awarded === undefined
            ? null
            : Number(answer.marks_awarded),
        feedback_en: answer?.feedback_en ?? null,
        feedback_ar: answer?.feedback_ar ?? null,
        response_text: text,
        response_pairs: pairs,
        file_url: fileUrl,
        file_name: fileNameFromPath(answer?.file_path ?? null),
      };
    }),
  );

  const gradableRows = rows.filter((row) =>
    data.answers.some((answer) => answer.id === row.answer_id),
  );
  const canGrade =
    data.attempt.status === "grading" || data.attempt.status === "graded";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={data.detail.title_en} ar={data.detail.title_ar} />}
        title={
          <Bi
            en={assessmentsUi.results.gradingTitle.en}
            ar={assessmentsUi.results.gradingTitle.ar}
          />
        }
        description={
          <Bi
            en={assessmentsUi.results.gradingSubtitle.en}
            ar={assessmentsUi.results.gradingSubtitle.ar}
          />
        }
        actions={
          <Link
            href={`/teacher/assessments/${data.detail.id}/results`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <Bi
              en={assessmentsUi.results.backToResults.en}
              ar={assessmentsUi.results.backToResults.ar}
            />
          </Link>
        }
      />

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">
            <Bi
              en={data.attempt.student?.full_name_en ?? "—"}
              ar={
                data.attempt.student?.full_name_ar ??
                data.attempt.student?.full_name_en ??
                "—"
              }
            />
          </span>
          <Badge variant="muted">
            <Bi
              en={`${assessmentsUi.results.attempt.en} #${data.attempt.attempt_number}`}
              ar={`${assessmentsUi.results.attempt.ar} #${data.attempt.attempt_number}`}
            />
          </Badge>
          <Badge variant="muted">
            <Bi
              en={attemptStatusCopy[
                data.attempt.status as keyof typeof attemptStatusCopy
              ]?.en ?? data.attempt.status}
              ar={attemptStatusCopy[
                data.attempt.status as keyof typeof attemptStatusCopy
              ]?.ar ?? data.attempt.status}
            />
          </Badge>
          {data.attempt.manual_review_status === "pending" ? (
            <Badge variant="outline">
              <Bi
                en={assessmentsUi.results.pending.en}
                ar={assessmentsUi.results.pending.ar}
              />
            </Badge>
          ) : null}
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          <Bi
            en={`Score ${data.attempt.score ?? 0} / ${data.attempt.max_score ?? 0}${
              data.attempt.percentage === null
                ? ""
                : ` (${data.attempt.percentage}%)`
            } · Submitted ${formatAdminDateTime(data.attempt.submitted_at)}`}
            ar={`الدرجة ${data.attempt.score ?? 0} من ${data.attempt.max_score ?? 0} · سُلّمت ${formatAdminDateTime(data.attempt.submitted_at)}`}
          />
        </p>
      </div>

      {!canGrade ? (
        <Alert variant="info">
          <Bi
            en={assessmentsUi.results.awaitingManual.en}
            ar={assessmentsUi.results.awaitingManual.ar}
          />
        </Alert>
      ) : gradableRows.length === 0 ? (
        <Alert variant="success">
          <Bi
            en="This attempt has no manual answers to grade."
            ar="لا تحتوي هذه المحاولة على إجابات يدوية لتصحيحها."
          />
        </Alert>
      ) : (
        <ManualGradingForm attemptId={attemptId} rows={gradableRows} />
      )}
    </div>
  );
}
