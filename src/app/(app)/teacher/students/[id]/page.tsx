import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireTeacher } from "@/lib/auth/dal";
import {
  getStudentById,
  listGradesWithClasses,
  listStudentEvents,
} from "@/lib/data/students";
import {
  studentEventCopy,
  studentsUi,
} from "@/lib/i18n/students";
import { formatAdminDate, formatAdminDateTime } from "@/lib/students/format";
import { cn } from "@/lib/utils";
import { StudentForm } from "@/app/(app)/teacher/students/student-form";
import { StudentAccessActions } from "@/app/(app)/teacher/students/student-access-actions";

export const metadata: Metadata = {
  title: "Student profile · ملف الطالب",
};

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();

  const { id } = await params;
  const student = await getStudentById(id);

  if (!student) {
    notFound();
  }

  const [gradesResult, events] = await Promise.all([
    listGradesWithClasses(),
    listStudentEvents(student.id),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={studentsUi.detail.profileTitle.en} ar={studentsUi.detail.profileTitle.ar} />}
        title={
          <Bi
            en={student.full_name_en}
            ar={student.full_name_ar ?? student.full_name_en}
            layout="stacked"
          />
        }
        description={
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {student.student_number ? (
              <>
                <span>
                  <Bi en={studentsUi.form.studentNumber.en} ar={studentsUi.form.studentNumber.ar} />
                  {": "}
                  <span dir="ltr" className="font-semibold text-foreground">
                    {student.student_number}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span dir="ltr">
              {student.email ?? (
                <Bi
                  en="No contact email"
                  ar="لا يوجد بريد للتواصل"
                  hideSeparator
                />
              )}
            </span>
            <span aria-hidden="true">·</span>
            <Bi
              en={student.grade?.name_en ?? "No grade"}
              ar={student.grade?.name_ar ?? "بدون صف"}
              hideSeparator
            />
          </span>
        }
        actions={
          <>
            <Badge variant={student.is_active ? "success" : "muted"}>
              <Bi
                en={
                  student.is_active
                    ? studentsUi.filters.activeOnly.en
                    : studentsUi.filters.inactiveOnly.en
                }
                ar={
                  student.is_active
                    ? studentsUi.filters.activeOnly.ar
                    : studentsUi.filters.inactiveOnly.ar
                }
                hideSeparator
              />
            </Badge>
            <Link
              href="/teacher/students"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              <Bi
                en={studentsUi.actions.backToList.en}
                ar={studentsUi.actions.backToList.ar}
              />
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <Bi en={studentsUi.form.editTitle.en} ar={studentsUi.form.editTitle.ar} />
            </CardTitle>
            <CardDescription>
              <Bi
                en={studentsUi.form.editSubtitle.en}
                ar={studentsUi.form.editSubtitle.ar}
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StudentForm
              mode="edit"
              student={student}
              grades={gradesResult.grades}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <Bi
                  en={studentsUi.detail.accessTitle.en}
                  ar={studentsUi.detail.accessTitle.ar}
                />
              </CardTitle>
              <CardDescription>
                <Bi
                  en="Issue a one-time password setup link or stop access immediately. Students sign in with their Student ID."
                  ar="أصدر رابط إعداد كلمة مرور لمرة واحدة أو أوقف الوصول فورًا. يسجّل الطلاب الدخول برقم الطالب."
                />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <Bi
                      en={studentsUi.detail.lastInvite.en}
                      ar={studentsUi.detail.lastInvite.ar}
                    />
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatAdminDate(student.invitation_sent_at)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <Bi
                      en={studentsUi.detail.lastReset.en}
                      ar={studentsUi.detail.lastReset.ar}
                    />
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatAdminDate(student.access_reset_at)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <Bi
                      en={studentsUi.detail.createdOn.en}
                      ar={studentsUi.detail.createdOn.ar}
                    />
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatAdminDate(student.created_at)}
                  </dd>
                </div>
              </dl>

              <StudentAccessActions
                studentId={student.id}
                isActive={student.is_active}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History aria-hidden="true" className="size-4 text-primary" />
                <Bi
                  en={studentsUi.detail.activityTitle.en}
                  ar={studentsUi.detail.activityTitle.ar}
                />
              </CardTitle>
              <CardDescription>
                <Bi
                  en={studentsUi.detail.activityHint.en}
                  ar={studentsUi.detail.activityHint.ar}
                />
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Bi
                    en={studentsUi.detail.noActivity.en}
                    ar={studentsUi.detail.noActivity.ar}
                  />
                </p>
              ) : (
                <ol className="space-y-3">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-start gap-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          <Bi
                            en={studentEventCopy[event.action].en}
                            ar={studentEventCopy[event.action].ar}
                          />
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatAdminDateTime(event.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
