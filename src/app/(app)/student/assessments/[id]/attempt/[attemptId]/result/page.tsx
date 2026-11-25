import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  EyeOff,
  Hourglass,
  Paperclip,
  XCircle,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/lib/auth/dal";
import { getStudentAttemptResult } from "@/lib/data/assessments";
import { createSignedSubmissionUrl } from "@/lib/assessments/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assessmentTypeCopy,
  assessmentsUi,
  attemptStatusCopy,
  questionTypeCopy,
} from "@/lib/i18n/assessments";
import { formatAdminDateTime } from "@/lib/students/format";
import { isUuid } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Attempt result · نتيجة المحاولة",
};

export const dynamic = "force-dynamic";

type OptionLookup = Map<string, { text_en: string; text_ar: string | null }>;
type PairLookup = Map<
  string,
  {
    left_en: string;
    left_ar: string | null;
    right_en: string;
    right_ar: string | null;
    right_key: string;
  }
>;

function fileNameFromPath(path: string | null): string | null {
  if (!path) {
    return null;
  }

  return path.split("/").pop() ?? path;
}

export default async function StudentResultPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  await requireStudent();

  const { id, attemptId } = await params;

  if (!isUuid(id) || !isUuid(attemptId)) {
    notFound();
  }

  const { result, error } = await getStudentAttemptResult(attemptId);

  if (error || !result) {
    notFound();
  }

  if (result.assessment_id !== id) {
    notFound();
  }

  const questions = (result.sections ?? []).flatMap(
    (section) => section.questions,
  );
  const questionIds = questions.map((question) => question.id);
  const options: OptionLookup = new Map();
  const pairs: PairLookup = new Map();

  if (questionIds.length > 0) {
    try {
      const admin = createAdminClient();
      const [optionRows, pairRows] = await Promise.all([
        admin
          .from("question_options")
          .select("id, question_id, text_en, text_ar")
          .in("question_id", questionIds),
        admin
          .from("matching_pairs")
          .select(
            "id, question_id, right_key, left_text_en, left_text_ar, right_text_en, right_text_ar",
          )
          .in("question_id", questionIds),
      ]);

      for (const option of (optionRows.data ?? []) as Array<{
        id: string;
        text_en: string;
        text_ar: string | null;
      }>) {
        options.set(option.id, {
          text_en: option.text_en,
          text_ar: option.text_ar,
        });
      }

      for (const pair of (pairRows.data ?? []) as Array<{
        id: string;
        right_key: string;
        left_text_en: string;
        left_text_ar: string | null;
        right_text_en: string;
        right_text_ar: string | null;
      }>) {
        const entry = {
          left_en: pair.left_text_en,
          left_ar: pair.left_text_ar,
          right_en: pair.right_text_en,
          right_ar: pair.right_text_ar,
          right_key: pair.right_key,
        };
        pairs.set(pair.id, entry);
        pairs.set(pair.right_key, entry);
      }
    } catch {
      // Display-only lookups. A failure leaves raw ids in the answer text,
      // never an error page.
    }
  }

  const reviewerPending =
    result.status === "grading" ||
    result.manual_review_status === "pending";

  const fileUrls = new Map<string, string>();

  await Promise.all(
    questions.map(async (question) => {
      const path = question.answer?.file_path;

      if (!path) {
        return;
      }

      const url = await createSignedSubmissionUrl(path);

      if (url) {
        fileUrls.set(question.id, url);
      }
    }),
  );

  return (
    <div translate="no" className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi
            en={assessmentTypeCopy[result.type].en}
            ar={assessmentTypeCopy[result.type].ar}
          />
        }
        title={<Bi en={result.title_en} ar="" hideSeparator />}
        description={
          <Bi
            en={`${assessmentsUi.student.attemptNumber.en} #${result.attempt_number} · ${assessmentsUi.student.submittedAt.en} ${formatAdminDateTime(result.submitted_at)}`}
            ar={`${assessmentsUi.student.attemptNumber.ar} #${result.attempt_number} · ${assessmentsUi.student.submittedAt.ar} ${formatAdminDateTime(result.submitted_at)}`}
          />
        }
        actions={
          <Link
            href="/student/assessments"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <Bi
              en={assessmentsUi.student.backToAssessments.en}
              ar={assessmentsUi.student.backToAssessments.ar}
            />
          </Link>
        }
      />

      {!result.visible ? (
        <section className="rounded-xl border border-border bg-card p-6 text-center shadow-xs">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
            <EyeOff aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-3 text-base font-bold text-foreground">
            <Bi
              en={assessmentsUi.student.hiddenResult.en}
              ar={assessmentsUi.student.hiddenResult.ar}
            />
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            <Bi
              en={assessmentsUi.student.hiddenResultHint.en}
              ar={assessmentsUi.student.hiddenResultHint.ar}
            />
          </p>
          <Badge variant="muted" className="mt-3">
            <Bi
              en={attemptStatusCopy[result.status].en}
              ar={attemptStatusCopy[result.status].ar}
            />
          </Badge>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">
                <Bi
                  en={attemptStatusCopy[result.status].en}
                  ar={attemptStatusCopy[result.status].ar}
                />
              </Badge>
              {reviewerPending ? (
                <Badge variant="outline">
                  <Hourglass aria-hidden="true" className="size-3.5" />
                  <Bi
                    en={assessmentsUi.list.awaitingReview.en}
                    ar={assessmentsUi.list.awaitingReview.ar}
                  />
                </Badge>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Bi
                    en={assessmentsUi.student.score.en}
                    ar={assessmentsUi.student.score.ar}
                  />
                </div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
                  {result.score ?? 0}
                  <span className="text-base font-medium text-muted-foreground">
                    {" "}
                    / {result.max_score ?? 0}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Bi
                    en={assessmentsUi.student.percentage.en}
                    ar={assessmentsUi.student.percentage.ar}
                  />
                </div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
                  {result.percentage ?? 0}%
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Bi
                    en={assessmentsUi.student.submittedAt.en}
                    ar={assessmentsUi.student.submittedAt.ar}
                  />
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {formatAdminDateTime(result.submitted_at)}
                </div>
              </div>
            </div>
          </section>

          {reviewerPending ? (
            <Alert variant="info">
              <Bi
                en={assessmentsUi.student.pendingReview.en}
                ar={assessmentsUi.student.pendingReview.ar}
              />
            </Alert>
          ) : null}

          <div className="space-y-4">
            {(result.sections ?? []).map((section) => (
              <section key={section.id} className="space-y-3">
                <h2 className="rounded-xl border border-border bg-secondary/40 p-4 text-base font-bold text-foreground">
                  <Bi
                    en={section.title_en}
                    ar=""
                    hideSeparator
                  />
                </h2>

                <ol className="space-y-3">
                  {section.questions.map((question, index) => {
                    const answer = question.answer;
                    const awarded = answer?.marks_awarded ?? null;
                    const response = answer?.response ?? {};
                    const selectedOptionId =
                      typeof (response as { selectedOptionId?: unknown })
                        .selectedOptionId === "string"
                        ? ((response as { selectedOptionId: string })
                            .selectedOptionId as string)
                        : null;
                    const trueFalse =
                      typeof (response as { value?: unknown }).value ===
                      "boolean"
                        ? ((response as { value: boolean }).value as boolean)
                        : null;
                    const text =
                      typeof (response as { text?: unknown }).text === "string"
                        ? ((response as { text: string }).text as string)
                        : null;
                    const rawPairs = (response as { pairs?: unknown }).pairs;
                    const pairEntries =
                      rawPairs &&
                      typeof rawPairs === "object" &&
                      !Array.isArray(rawPairs)
                        ? Object.entries(
                            rawPairs as Record<string, string>,
                          )
                        : [];
                    const fileUrl = fileUrls.get(question.id) ?? null;

                    return (
                      <li
                        key={question.id}
                        className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs">
                              {index + 1}
                            </span>
                            <Bi
                              en={question.prompt_en}
                              ar=""
                              hideSeparator
                            />
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline">
                              <Bi
                                en={questionTypeCopy[question.type].en}
                                ar={questionTypeCopy[question.type].ar}
                              />
                            </Badge>
                            {awarded === null ? (
                              <Badge variant="muted">
                                <Bi
                                  en={assessmentsUi.list.awaitingReview.en}
                                  ar={assessmentsUi.list.awaitingReview.ar}
                                />
                              </Badge>
                            ) : (
                              <Badge
                                variant={
                                  answer?.is_correct === false
                                    ? "muted"
                                    : "success"
                                }
                              >
                                {answer?.is_correct === false ? (
                                  <XCircle
                                    aria-hidden="true"
                                    className="size-3.5"
                                  />
                                ) : (
                                  <CheckCircle2
                                    aria-hidden="true"
                                    className="size-3.5"
                                  />
                                )}
                                {awarded} / {question.marks}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Bi
                              en={assessmentsUi.student.yourAnswer.en}
                              ar={assessmentsUi.student.yourAnswer.ar}
                            />
                          </p>

                          {selectedOptionId ? (
                            <p className="mt-1 text-foreground">
                              <Bi
                                en={
                                  options.get(selectedOptionId)?.text_en ??
                                  selectedOptionId
                                }
                                ar=""
                                hideSeparator
                              />
                            </p>
                          ) : null}

                          {trueFalse !== null ? (
                            <p className="mt-1 text-foreground">
                              <Bi
                                en={trueFalse ? "True" : "False"}
                                ar={trueFalse ? "صحيح" : "خطأ"}
                              />
                            </p>
                          ) : null}

                          {text ? (
                            <p className="mt-1 whitespace-pre-wrap text-foreground">
                              {text}
                            </p>
                          ) : null}

                          {pairEntries.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {pairEntries.map(([leftId, rightKey]) => {
                                const pair = pairs.get(leftId);
                                const right = pairs.get(rightKey);
                                return (
                                  <li key={leftId} className="text-foreground">
                                    <Bi
                                      en={`${pair?.left_en ?? leftId} → ${right?.right_en ?? rightKey}`}
                                      ar=""
                                      hideSeparator
                                    />
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}

                          {fileUrl ? (
                            <p className="mt-1 inline-flex items-center gap-2">
                              <Paperclip
                                aria-hidden="true"
                                className="size-4"
                              />
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-primary underline underline-offset-2"
                              >
                                {fileNameFromPath(answer?.file_path ?? null) ??
                                  assessmentsUi.results.fileAnswer.en}
                              </a>
                            </p>
                          ) : null}

                          {!selectedOptionId &&
                          trueFalse === null &&
                          !text &&
                          pairEntries.length === 0 &&
                          !fileUrl ? (
                            <p className="mt-1 text-muted-foreground">
                              <Bi
                                en={assessmentsUi.student.noAnswer.en}
                                ar={assessmentsUi.student.noAnswer.ar}
                              />
                            </p>
                          ) : null}
                        </div>

                        {answer?.feedback_en || answer?.feedback_ar ? (
                          <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                              <Bi
                                en={assessmentsUi.student.feedback.en}
                                ar={assessmentsUi.student.feedback.ar}
                              />
                            </p>
                            <p className="mt-1 text-foreground">
                              <Bi
                                en={answer.feedback_en ?? ""}
                                ar={answer.feedback_ar ?? ""}
                              />
                            </p>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}

      <div className="flex justify-start">
        <Link
          href="/student/assessments"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          <Bi
            en={assessmentsUi.student.backToAssessments.en}
            ar={assessmentsUi.student.backToAssessments.ar}
          />
        </Link>
      </div>
    </div>
  );
}
