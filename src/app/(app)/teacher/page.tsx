import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  GraduationCap,
  Hourglass,
  Percent,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ReportFiltersBar } from "@/components/reporting/report-filters";
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
import { requireTeacher } from "@/lib/auth/dal";
import {
  getTeacherDashboardData,
  listReportingOptions,
  type ReportingAttemptRow,
} from "@/lib/data/reporting";
import {
  assessmentTypeCopy,
  attemptStatusCopy,
} from "@/lib/i18n/assessments";
import { reportingUi } from "@/lib/i18n/reporting";
import {
  buildReportQuery,
  hasReportFilters,
  parseReportFilters,
} from "@/lib/reporting/filters";
import { formatAdminDateTime } from "@/lib/students/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Teacher dashboard · لوحة تحكم المعلم",
};

export const dynamic = "force-dynamic";

function percentLabel(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `${Math.round(value * 10) / 10}%`;
}

function attemptStudent(attempt: ReportingAttemptRow): string {
  return attempt.student?.full_name_en ?? attempt.student_id.slice(0, 8);
}

function ActivityRow({ attempt }: { attempt: ReportingAttemptRow }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {attemptStudent(attempt)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {attempt.assessment?.title_en ?? "—"}
          {attempt.assessment ? (
            <>
              {" · "}
              <Bi
                en={assessmentTypeCopy[attempt.assessment.type].en}
                ar={assessmentTypeCopy[attempt.assessment.type].ar}
                hideSeparator
              />
            </>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant={attempt.status === "graded" ? "success" : "outline"}>
          <Bi
            en={attemptStatusCopy[attempt.status].en}
            ar={attemptStatusCopy[attempt.status].ar}
            hideSeparator
          />
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {formatAdminDateTime(attempt.submitted_at ?? attempt.started_at)}
        </span>
      </div>
    </li>
  );
}

function ResultRow({ attempt }: { attempt: ReportingAttemptRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {attemptStudent(attempt)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {attempt.assessment?.title_en ?? "—"} ·{" "}
          {formatAdminDateTime(attempt.submitted_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-bold tabular-nums text-foreground">
          {percentLabel(attempt.percentage)}
        </span>
        <Link
          href={`/teacher/assessments/${attempt.assessment_id}/results/${attempt.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Bi
            en={reportingUi.sections.openAttempt.en}
            ar={reportingUi.sections.openAttempt.ar}
          />
          <ArrowRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
        </Link>
      </div>
    </li>
  );
}

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireTeacher();
  const filters = parseReportFilters(await searchParams);
  const [data, options] = await Promise.all([
    getTeacherDashboardData(filters),
    listReportingOptions(),
  ]);
  const totals = data.aggregates;
  const filtered = hasReportFilters(filters);
  const query = buildReportQuery(filters);
  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Bi
            en={reportingUi.teacher.eyebrow.en}
            ar={reportingUi.teacher.eyebrow.ar}
          />
        }
        title={
          <Bi
            en={`${reportingUi.teacher.welcome.en}, ${profile.full_name_en}`}
            ar={`${reportingUi.teacher.welcome.ar}، ${profile.full_name_ar ?? profile.full_name_en}`}
            layout="stacked"
          />
        }
        description={
          <Bi
            en={reportingUi.teacher.subtitle.en}
            ar={reportingUi.teacher.subtitle.ar}
          />
        }
        actions={
          <>
            <Link
              href="/teacher/results"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <BarChart3 aria-hidden="true" className="size-4" />
              <Bi
                en={reportingUi.sections.viewAllResults.en}
                ar={reportingUi.sections.viewAllResults.ar}
              />
            </Link>
            <Link
              href="/teacher/students"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <UserPlus aria-hidden="true" className="size-4" />
              <Bi
                en={reportingUi.stats.students.en}
                ar={reportingUi.stats.students.ar}
              />
            </Link>
            {isAdmin ? (
              <Link
                href="/teacher/reporting"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                <Settings2 aria-hidden="true" className="size-4" />
                <Bi
                  en={reportingUi.admin.title.en}
                  ar={reportingUi.admin.title.ar}
                />
              </Link>
            ) : null}
            <Badge variant="success">
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              <Bi en="Signed in" ar="تم تسجيل الدخول" />
            </Badge>
          </>
        }
      />

      {data.hasError ? (
        <Alert variant="error">
          <Bi
            en="Some dashboard totals could not be loaded. Refresh the page or check the database connection."
            ar="تعذّر تحميل بعض أرقام لوحة التحكم. حدّث الصفحة أو تحقق من اتصال قاعدة البيانات."
          />
        </Alert>
      ) : null}

      <ReportFiltersBar
        action="/teacher"
        filters={filters}
        options={options}
        idPrefix="dashboard"
      />

      <section
        aria-label="Overview / نظرة عامة"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          icon={Users}
          label={reportingUi.stats.students}
          value={totals.studentCount}
          hint={
            <Bi
              en={reportingUi.stats.studentsHint.en}
              ar={reportingUi.stats.studentsHint.ar}
            />
          }
        />
        <StatCard
          icon={FolderOpen}
          label={reportingUi.stats.resources}
          value={totals.resourceCount}
          hint={
            <Bi
              en={`${totals.publishedResourceCount} published · ${totals.unpublishedResourceCount} unpublished`}
              ar={`${totals.publishedResourceCount} منشور · ${totals.unpublishedResourceCount} غير منشور`}
              hideSeparator
            />
          }
        />
        <StatCard
          icon={ClipboardList}
          label={reportingUi.stats.quizzes}
          value={totals.quizCount}
          hint={
            <Bi
              en={reportingUi.stats.assessmentsHint.en}
              ar={reportingUi.stats.assessmentsHint.ar}
            />
          }
        />
        <StatCard
          icon={ClipboardList}
          label={reportingUi.stats.exams}
          value={totals.examCount}
          hint={
            <Bi
              en={`${totals.publishedAssessmentCount} published overall`}
              ar={`${totals.publishedAssessmentCount} منشور إجمالًا`}
              hideSeparator
            />
          }
        />
        <StatCard
          icon={BarChart3}
          label={reportingUi.stats.attempts}
          value={totals.attemptCount}
          hint={
            <Bi
              en={reportingUi.stats.attemptsHint.en}
              ar={reportingUi.stats.attemptsHint.ar}
            />
          }
        />
        <StatCard
          icon={Percent}
          label={reportingUi.stats.averageScore}
          value={percentLabel(totals.averagePercentage)}
          hint={
            <Bi
              en={reportingUi.stats.averageHint.en}
              ar={reportingUi.stats.averageHint.ar}
            />
          }
        />
        <StatCard
          icon={Hourglass}
          label={reportingUi.stats.pendingReview}
          value={totals.pendingReviewCount}
          hint={
            <Bi
              en={reportingUi.stats.pendingHint.en}
              ar={reportingUi.stats.pendingHint.ar}
            />
          }
        />
        <StatCard
          icon={CheckCircle2}
          label={{ en: "Graded attempts", ar: "محاولات مصححة" }}
          value={totals.gradedAttemptCount}
          hint={
            <Bi
              en="Included in the average"
              ar="مشمولة في المتوسط"
              hideSeparator
            />
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>
                <Bi
                  en={reportingUi.stats.studentsByGrade.en}
                  ar={reportingUi.stats.studentsByGrade.ar}
                />
              </CardTitle>
              <CardDescription>
                <Bi
                  en="Active students grouped by grade, with class counts inside each grade."
                  ar="الطلاب النشطون مجمّعون حسب الصف، مع عدد كل فصل داخل الصف."
                />
              </CardDescription>
            </div>
            <GraduationCap aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {totals.studentsByGrade.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title={<Bi en="No grades yet" ar="لا توجد صفوف بعد" />}
                description={
                  <Bi
                    en="Create a grade and classes to start adding students."
                    ar="أنشئ صفًا وفصولًا لبدء إضافة الطلاب."
                  />
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {totals.studentsByGrade.map((grade) => {
                  const gradeClasses = totals.studentsByClass.filter(
                    (classRow) => classRow.grade_id === grade.id,
                  );

                  return (
                    <li key={grade.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {grade.name_en}
                          </p>
                          <p
                            lang="ar"
                            dir="rtl"
                            className="font-arabic truncate text-xs text-muted-foreground"
                          >
                            {grade.name_ar}
                          </p>
                        </div>
                        <Badge variant="outline">
                          <Bi
                            en={`${grade.studentCount} students`}
                            ar={`${grade.studentCount} طالبًا`}
                            hideSeparator
                          />
                        </Badge>
                      </div>
                      {gradeClasses.length > 0 ? (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {gradeClasses.map((classRow) => (
                            <li
                              key={classRow.id}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              <span className="font-medium text-foreground">
                                {classRow.name_en}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {classRow.studentCount}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Bi
                en={reportingUi.sections.recentActivity.en}
                ar={reportingUi.sections.recentActivity.ar}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en={reportingUi.sections.recentActivityHint.en}
                ar={reportingUi.sections.recentActivityHint.ar}
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={
                  <Bi
                    en={reportingUi.sections.noActivity.en}
                    ar={reportingUi.sections.noActivity.ar}
                  />
                }
                description={
                  <Bi
                    en={reportingUi.sections.emptyHint.en}
                    ar={reportingUi.sections.emptyHint.ar}
                  />
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.recentActivity.map((attempt) => (
                  <ActivityRow key={attempt.id} attempt={attempt} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>
              <Bi
                en={reportingUi.sections.recentResults.en}
                ar={reportingUi.sections.recentResults.ar}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en={reportingUi.sections.recentResultsHint.en}
                ar={reportingUi.sections.recentResultsHint.ar}
              />
            </CardDescription>
          </div>
          <Link
            href={`/teacher/results${query}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Bi
              en={reportingUi.sections.viewAllResults.en}
              ar={reportingUi.sections.viewAllResults.ar}
            />
            <ArrowRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentResults.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title={
                <Bi
                  en={reportingUi.sections.noResults.en}
                  ar={reportingUi.sections.noResults.ar}
                />
              }
              description={
                <Bi
                  en={
                    filtered
                      ? reportingUi.sections.emptyHint.en
                      : "Graded attempts will appear here as soon as submissions are reviewed."
                  }
                  ar={
                    filtered
                      ? reportingUi.sections.emptyHint.ar
                      : "ستظهر المحاولات المصححة هنا بمجرد مراجعة الإرسالات."
                  }
                />
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.recentResults.map((attempt) => (
                <ResultRow key={attempt.id} attempt={attempt} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
