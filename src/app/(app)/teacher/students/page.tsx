import type { Metadata } from "next";
import Link from "next/link";
import {
  GraduationCap,
  SearchX,
  UserPlus,
  Users,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StudentFiltersBar } from "@/app/(app)/teacher/students/student-filters";
import { StudentAccessActions } from "@/app/(app)/teacher/students/student-access-actions";
import { requireTeacher } from "@/lib/auth/dal";
import { listGradesWithClasses, listStudents } from "@/lib/data/students";
import { formatAdminDate } from "@/lib/students/format";
import {
  STUDENTS_PAGE_SIZE,
  buildStudentQuery,
  parseStudentFilters,
} from "@/lib/students/filters";
import { studentsUi } from "@/lib/i18n/students";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Students",
};

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeacher();

  const filters = parseStudentFilters(await searchParams);
  const [list, gradesResult] = await Promise.all([
    listStudents(filters),
    listGradesWithClasses(),
  ]);

  const grades = gradesResult.grades;
  const hasFilters =
    Boolean(filters.search) ||
    Boolean(filters.gradeId) ||
    Boolean(filters.classId) ||
    filters.status !== "all";

  const start =
    list.total === 0 ? 0 : (list.page - 1) * STUDENTS_PAGE_SIZE + 1;
  const end = Math.min(list.page * STUDENTS_PAGE_SIZE, list.total);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={studentsUi.eyebrow.en} ar={studentsUi.eyebrow.en} />}
        title={<Bi en={studentsUi.title.en} ar={studentsUi.title.en} />}
        description={
          <Bi en={studentsUi.subtitle.en} ar={studentsUi.subtitle.en} />
        }
        actions={
          <>
            <Link
              href="/teacher/classes"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <GraduationCap aria-hidden="true" className="size-4" />
              <Bi
                en={studentsUi.actions.manageClasses.en}
                ar={studentsUi.actions.manageClasses.en}
              />
            </Link>
            <Link
              href="/teacher/students/new"
              className={cn(buttonVariants())}
            >
              <UserPlus aria-hidden="true" className="size-4" />
              <Bi
                en={studentsUi.actions.addStudent.en}
                ar={studentsUi.actions.addStudent.en}
              />
            </Link>
          </>
        }
      />

      {list.hasError ? (
        <Alert variant="error">
          <Bi
            en="The student list could not be loaded. Refresh the page or check the database connection."
            ar="تعذّر تحميل قائمة الطلاب. حدّث الصفحة أو تحقق من اتصال قاعدة البيانات."
          />
        </Alert>
      ) : null}

      <StudentFiltersBar filters={filters} grades={grades} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {list.total === 0 ? (
            <Bi
              en="No students found"
              ar="لم يُعثر على طلاب"
            />
          ) : (
            <Bi
              en={`Showing ${start}–${end} of ${list.total} students`}
              ar={`عرض ${start}–${end} من ${list.total} طالبًا`}
            />
          )}
        </p>
        {list.pageCount > 1 ? (
          <p>
            <Bi
              en={`Page ${list.page} of ${list.pageCount}`}
              ar={`صفحة ${list.page} من ${list.pageCount}`}
            />
          </p>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        {list.students.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={hasFilters ? SearchX : Users}
              title={
                hasFilters ? (
                  <Bi
                    en={studentsUi.list.emptyFiltered.en}
                    ar={studentsUi.list.emptyFiltered.en}
                  />
                ) : (
                  <Bi
                    en={studentsUi.list.empty.en}
                    ar={studentsUi.list.empty.en}
                  />
                )
              }
              description={
                hasFilters ? (
                  <Bi
                    en={studentsUi.list.emptyFilteredHint.en}
                    ar={studentsUi.list.emptyFilteredHint.en}
                  />
                ) : (
                  <Bi
                    en={studentsUi.list.emptyHint.en}
                    ar={studentsUi.list.emptyHint.en}
                  />
                )
              }
              action={
                hasFilters ? (
                  <Link
                    href="/teacher/students"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    <Bi
                      en={studentsUi.filters.clear.en}
                      ar={studentsUi.filters.clear.en}
                    />
                  </Link>
                ) : (
                  <Link
                    href="/teacher/students/new"
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    <UserPlus aria-hidden="true" className="size-4" />
                    <Bi
                      en={studentsUi.actions.addStudent.en}
                      ar={studentsUi.actions.addStudent.en}
                    />
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[52rem] text-sm">
                <thead className="bg-secondary/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={studentsUi.list.student.en}
                        ar={studentsUi.list.student.en}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={studentsUi.list.contact.en}
                        ar={studentsUi.list.contact.en}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={studentsUi.list.placement.en}
                        ar={studentsUi.list.placement.en}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi
                        en={studentsUi.list.access.en}
                        ar={studentsUi.list.access.en}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      <Bi en="Actions" ar="إجراءات" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.students.map((student) => (
                    <tr key={student.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link
                          href={`/teacher/students/${student.id}`}
                          className="font-semibold text-foreground hover:text-primary"
                        >
                          {student.full_name_en}
                        </Link>
                        {student.student_number ? (
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            <Bi
                              en={studentsUi.form.studentNumber.en}
                              ar={studentsUi.form.studentNumber.en}
                              hideSeparator
                            />
                            {": "}
                            <span dir="ltr">{student.student_number}</span>
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {student.email ? (
                          <p
                            dir="ltr"
                            className="break-all text-xs text-foreground"
                          >
                            {student.email}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            <Bi
                              en="No contact email"
                              ar="No contact email"
                              hideSeparator
                            />
                          </p>
                        )}
                        {student.username ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            @{student.username}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {student.grade ? (
                          <span className="block text-foreground">
                            {student.grade.name_en}
                          </span>
                        ) : (
                          <Bi
                            en={studentsUi.form.noGrade.en}
                            ar={studentsUi.form.noGrade.en}
                          />
                        )}
                        {student.class ? (
                          <span className="mt-0.5 block">
                            {student.class.name_en}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={student.is_active ? "success" : "muted"}>
                          <Bi
                            en={
                              student.is_active
                                ? studentsUi.filters.activeOnly.en
                                : studentsUi.filters.inactiveOnly.en
                            }
                            ar={
                              student.is_active
                                ? studentsUi.filters.activeOnly.en
                                : studentsUi.filters.inactiveOnly.en
                            }
                            hideSeparator
                          />
                        </Badge>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {student.invitation_sent_at ? (
                            formatAdminDate(student.invitation_sent_at)
                          ) : (
                            <Bi
                              en={studentsUi.list.neverInvited.en}
                              ar={studentsUi.list.neverInvited.en}
                            />
                          )}
                        </p>
                      </td>
                      <td className="min-w-56 px-4 py-3">
                        <StudentAccessActions
                          studentId={student.id}
                          isActive={student.is_active}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {list.students.map((student) => (
                <li key={student.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/teacher/students/${student.id}`}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {student.full_name_en}
                      </Link>
                    </div>
                    <Badge variant={student.is_active ? "success" : "muted"}>
                      <Bi
                        en={
                          student.is_active
                            ? studentsUi.filters.activeOnly.en
                            : studentsUi.filters.inactiveOnly.en
                        }
                        ar={
                          student.is_active
                            ? studentsUi.filters.activeOnly.en
                            : studentsUi.filters.inactiveOnly.en
                        }
                        hideSeparator
                      />
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    {student.student_number ? (
                      <p className="font-medium text-foreground">
                        <Bi
                          en={studentsUi.form.studentNumber.en}
                          ar={studentsUi.form.studentNumber.en}
                          hideSeparator
                        />
                        {": "}
                        <span dir="ltr">{student.student_number}</span>
                      </p>
                    ) : null}
                    <p dir="ltr" className="break-all">
                      {student.email ?? (
                        <Bi
                          en="No contact email"
                          ar="No contact email"
                          hideSeparator
                        />
                      )}
                    </p>
                    <p>
                      {student.grade?.name_en ?? studentsUi.form.noGrade.en}
                      {student.class ? ` · ${student.class.name_en}` : ""}
                    </p>
                  </div>

                  <StudentAccessActions
                    studentId={student.id}
                    isActive={student.is_active}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {list.pageCount > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-3"
        >
          {list.page > 1 ? (
            <Link
              href={`/teacher/students${buildStudentQuery(filters, {
                page: list.page - 1,
              })}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi
                en={studentsUi.list.previous.en}
                ar={studentsUi.list.previous.en}
              />
            </Link>
          ) : (
            <span />
          )}

          <span className="text-xs text-muted-foreground">
            <Bi
              en={`${list.page} / ${list.pageCount}`}
              ar={`${list.page} / ${list.pageCount}`}
              hideSeparator
            />
          </span>

          {list.page < list.pageCount ? (
            <Link
              href={`/teacher/students${buildStudentQuery(filters, {
                page: list.page + 1,
              })}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi en={studentsUi.list.next.en} ar={studentsUi.list.next.en} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
