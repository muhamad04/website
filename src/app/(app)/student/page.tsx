import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  GraduationCap,
  Hourglass,
  Mail,
  MessageSquareText,
  Percent,
  UserRound,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStudent } from "@/lib/auth/dal";
import { getStudentDashboardData } from "@/lib/data/reporting";
import {
  assessmentTypeCopy,
  attemptStatusCopy,
} from "@/lib/i18n/assessments";
import { reportingUi } from "@/lib/i18n/reporting";
import { formatAdminDateTime } from "@/lib/students/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Student dashboard · لوحة تحكم الطالب",
};

export const dynamic = "force-dynamic";

function percentLabel(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `${Math.round(value * 10) / 10}%`;
}

function resultLink(
  assessmentId: string,
  attemptId: string,
): string {
  return `/student/assessments/${assessmentId}/attempt/${attemptId}/result`;
}

export default async function StudentDashboardPage() {
  const profile = await requireStudent();
  const grade = profile.grade!;
  const data = await getStudentDashboardData(grade.id);
  const summary = data.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Bi
            en={reportingUi.student.eyebrow.en}
            ar={reportingUi.student.eyebrow.ar}
          />
        }
        title={
          <Bi
            en={`${reportingUi.student.hello.en}, ${profile.full_name_en}`}
            ar={`${reportingUi.student.hello.ar}، ${profile.full_name_ar ?? profile.full_name_en}`}
            layout="stacked"
          />
        }
        description={
          <Bi
            en={reportingUi.student.subtitle.en}
            ar={reportingUi.student.subtitle.ar}
          />
        }
        actions={
          <>
            <Badge variant="success">
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              <Bi en="Active account" ar="حساب نشط" />
            </Badge>
            <Link
              href="/student/resources"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <FolderOpen aria-hidden="true" className="size-4" />
              <Bi
                en={reportingUi.student.browseResources.en}
                ar={reportingUi.student.browseResources.ar}
              />
            </Link>
            <Link
              href="/student/assessments"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <ClipboardList aria-hidden="true" className="size-4" />
              <Bi
                en={reportingUi.student.availableAssessments.en}
                ar={reportingUi.student.availableAssessments.ar}
              />
            </Link>
          </>
        }
      />

      {data.hasError ? (
        <Alert variant="error">
          <Bi
            en="Some totals could not be loaded. Refresh the page to try again."
            ar="تعذّر تحميل بعض الأرقام. حدّث الصفحة للمحاولة مرة أخرى."
          />
        </Alert>
      ) : null}

      <section
        aria-label="My overview / نظرة عامة"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          icon={BookOpenCheck}
          label={reportingUi.student.availableResources}
          value={summary.availableResources}
          hint={
            <Bi en="For your grade" ar="لصفك" hideSeparator />
          }
        />
        <StatCard
          icon={ClipboardList}
          label={reportingUi.student.availableAssessments}
          value={summary.availableAssessments}
          hint={
            <Bi en="Published for your grade" ar="منشورة لصفك" hideSeparator />
          }
        />
        <StatCard
          icon={CheckCircle2}
          label={reportingUi.student.completedAssessments}
          value={summary.completedAssessments}
          hint={
            <Bi
              en={`${summary.pendingAssessments} still to start`}
              ar={`${summary.pendingAssessments} لم تبدأ بعد`}
              hideSeparator
            />
          }
        />
        <StatCard
          icon={Hourglass}
          label={reportingUi.student.pendingReview}
          value={summary.pendingReview}
          hint={
            <Bi
              en="Manual grading in progress"
              ar="التصحيح اليدوي قيد التنفيذ"
              hideSeparator
            />
          }
        />
        <StatCard
          icon={Percent}
          label={reportingUi.student.averageVisible}
          value={percentLabel(summary.averageVisiblePercentage)}
          hint={
            <Bi
              en={`${summary.visibleScores} visible score${summary.visibleScores === 1 ? "" : "s"}`}
              ar={`${summary.visibleScores} درجة ظاهرة`}
              hideSeparator
            />
          }
        />
        <StatCard
          icon={BarChart3}
          label={{ en: "In progress", ar: "قيد التنفيذ" }}
          value={summary.inProgressAssessments}
          hint={
            <Bi en="Open attempts" ar="محاولات مفتوحة" hideSeparator />
          }
        />
        <StatCard
          icon={ClipboardList}
          label={reportingUi.student.pendingAssessments}
          value={summary.pendingAssessments}
          hint={
            <Bi en="Not started yet" ar="لم تبدأ بعد" hideSeparator />
          }
        />
        <StatCard
          icon={MessageSquareText}
          label={reportingUi.student.teacherFeedback}
          value={data.feedback.length}
          hint={
            <Bi
              en="Shared with you"
              ar="تمت مشاركتها معك"
              hideSeparator
            />
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              <Bi
                en={reportingUi.student.placement.en}
                ar={reportingUi.student.placement.ar}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en="Grade assignments are managed by your teacher."
                ar="يدير معلمك تحديد الصف الدراسي."
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <div className="flex items-start gap-2.5">
                <GraduationCap
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Bi en="Grade" ar="الصف" />
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold">
                    <Bi en={grade.name_en} ar={grade.name_ar} layout="stacked" />
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <UserRound
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Bi en="Class" ar="الفصل" />
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold">
                    {profile.class ? (
                      <Bi
                        en={profile.class.name_en}
                        ar={profile.class.name_ar}
                        layout="stacked"
                      />
                    ) : (
                      <Bi en="Not assigned" ar="غير محدد" />
                    )}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <ClipboardList
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Bi en="Student ID" ar="رقم الطالب" />
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold" dir="ltr">
                    {profile.student_number ?? (
                      <Bi en="Not assigned" ar="غير محدد" />
                    )}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Bi en="Email (optional)" ar="البريد الإلكتروني (اختياري)" />
                  </dt>
                  <dd className="mt-0.5 break-all text-sm font-semibold">
                    {profile.email ?? (
                      <Bi en="Not provided" ar="غير متوفر" />
                    )}
                  </dd>
                </div>
              </div>
            </dl>
            <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <Bi
                en={reportingUi.student.gradeLockedHint.en}
                ar={reportingUi.student.gradeLockedHint.ar}
              />
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>
                <Bi
                  en={reportingUi.student.recentActivity.en}
                  ar={reportingUi.student.recentActivity.ar}
                />
              </CardTitle>
              <CardDescription>
                <Bi
                  en="Your latest submissions, scores that are visible to you and open attempts."
                  ar="أحدث إرسالاتك والدرجات الظاهرة لك والمحاولات المفتوحة."
                />
              </CardDescription>
            </div>
            <Link
              href="/student/assessments"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi en="All assessments" ar="جميع التقييمات" />
              <ArrowRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.activity.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={
                  <Bi
                    en={reportingUi.student.noActivity.en}
                    ar={reportingUi.student.noActivity.ar}
                  />
                }
                description={
                  <Bi
                    en={reportingUi.student.noActivityHint.en}
                    ar={reportingUi.student.noActivityHint.ar}
                  />
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.activity.map((item) => {
                  const pending = item.manualReviewStatus === "pending";
                  const visibleScore =
                    item.resultVisible && !pending && item.percentage !== null;
                  const href = item.inProgressAttemptId
                    ? `/student/assessments/${item.assessmentId}`
                    : item.resultVisible && item.lastAttemptId
                      ? resultLink(item.assessmentId, item.lastAttemptId)
                      : `/student/assessments/${item.assessmentId}`;

                  return (
                    <li
                      key={item.assessmentId}
                      className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.title_en}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <Bi
                            en={assessmentTypeCopy[item.type].en}
                            ar={assessmentTypeCopy[item.type].ar}
                            hideSeparator
                          />
                          {" · "}
                          {item.status ? (
                            <Bi
                              en={attemptStatusCopy[item.status].en}
                              ar={attemptStatusCopy[item.status].ar}
                              hideSeparator
                            />
                          ) : (
                            <Bi
                              en={reportingUi.student.notStarted.en}
                              ar={reportingUi.student.notStarted.ar}
                              hideSeparator
                            />
                          )}
                          {item.submittedAt
                            ? ` · ${formatAdminDateTime(item.submittedAt)}`
                            : ""}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          <Bi
                            en={`${reportingUi.student.attemptsUsed.en} ${item.attemptsUsed}/${item.maxAttempts}`}
                            ar={`${reportingUi.student.attemptsUsed.ar} ${item.attemptsUsed}/${item.maxAttempts}`}
                            hideSeparator
                          />
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {visibleScore ? (
                          <span className="text-sm font-bold tabular-nums text-foreground">
                            {percentLabel(item.percentage)}
                          </span>
                        ) : pending ? (
                          <Badge variant="outline">
                            <Bi
                              en={reportingUi.student.awaitingReview.en}
                              ar={reportingUi.student.awaitingReview.ar}
                              hideSeparator
                            />
                          </Badge>
                        ) : item.attemptsUsed > 0 && !item.resultVisible ? (
                          <Badge variant="muted">
                            <Bi
                              en={reportingUi.student.resultHidden.en}
                              ar={reportingUi.student.resultHidden.ar}
                              hideSeparator
                            />
                          </Badge>
                        ) : null}
                        <Link
                          href={href}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                          )}
                        >
                          <Bi
                            en={
                              item.inProgressAttemptId
                                ? reportingUi.student.openAssessment.en
                                : item.resultVisible && item.lastAttemptId
                                  ? reportingUi.student.viewResult.en
                                  : reportingUi.student.openAssessment.en
                            }
                            ar={
                              item.inProgressAttemptId
                                ? reportingUi.student.openAssessment.ar
                                : item.resultVisible && item.lastAttemptId
                                  ? reportingUi.student.viewResult.ar
                                  : reportingUi.student.openAssessment.ar
                            }
                          />
                          <ArrowRight
                            aria-hidden="true"
                            className="size-3.5 rtl:rotate-180"
                          />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <Bi
                en={reportingUi.student.teacherFeedback.en}
                ar={reportingUi.student.teacherFeedback.ar}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en="Only feedback attached to results you are allowed to see appears here."
                ar="تظهر هنا فقط الملاحظات المرتبطة بنتائج يُسمح لك برؤيتها."
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.feedback.length === 0 ? (
              <EmptyState
                icon={MessageSquareText}
                title={
                  <Bi
                    en={reportingUi.student.noFeedback.en}
                    ar={reportingUi.student.noFeedback.ar}
                  />
                }
                description={
                  <Bi
                    en={reportingUi.student.noFeedbackHint.en}
                    ar={reportingUi.student.noFeedbackHint.ar}
                  />
                }
              />
            ) : (
              <ul className="space-y-3">
                {data.feedback.map((item) => (
                  <li
                    key={item.attemptId}
                    className="rounded-lg border border-border bg-secondary/30 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {item.title_en}
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        {formatAdminDateTime(item.submittedAt)}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm leading-relaxed text-muted-foreground">
                      {item.feedback.map((message, index) => (
                        <li key={`${item.attemptId}-${index}`}>{message}</li>
                      ))}
                    </ul>
                    <Link
                      href={resultLink(item.assessmentId, item.attemptId)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-2"
                    >
                      <Bi
                        en={reportingUi.student.viewResult.en}
                        ar={reportingUi.student.viewResult.ar}
                      />
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3 rtl:rotate-180"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>
                <Bi
                  en={reportingUi.student.recentResources.en}
                  ar={reportingUi.student.recentResources.ar}
                />
              </CardTitle>
              <CardDescription>
                <Bi
                  en="Published resources for your grade, newest first."
                  ar="المصادر المنشورة لصفك، الأحدث أولًا."
                />
              </CardDescription>
            </div>
            <Link
              href="/student/resources"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi en="All resources" ar="جميع المصادر" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.resources.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title={
                  <Bi
                    en={reportingUi.student.noResources.en}
                    ar={reportingUi.student.noResources.ar}
                  />
                }
                description={
                  <Bi
                    en="Your teacher has not published any resources for your grade yet."
                    ar="لم ينشر معلمك أي مصادر لصفك بعد."
                  />
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.resources.map((resource) => (
                  <li
                    key={resource.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {resource.title_en}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {resource.title_ar}
                      </p>
                    </div>
                    <Link
                      href={`/student/resources/${resource.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      <Bi en="Open" ar="فتح" />
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3.5 rtl:rotate-180"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
