import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, GraduationCap, School } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
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
import { listGradesWithClasses } from "@/lib/data/students";
import { studentsUi } from "@/lib/i18n/students";
import { cn } from "@/lib/utils";
import {
  ClassForm,
  GradeForm,
} from "@/app/(app)/teacher/classes/class-forms";

export const metadata: Metadata = {
  title: "Grades & classes · الصفوف والفصول",
};

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  await requireTeacher();

  const { grades, hasError } = await listGradesWithClasses();
  const gradeOptions = grades.map((grade) => ({
    id: grade.id,
    name_en: grade.name_en,
    name_ar: grade.name_ar,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={studentsUi.classes.eyebrow.en} ar={studentsUi.classes.eyebrow.ar} />}
        title={<Bi en={studentsUi.classes.title.en} ar={studentsUi.classes.title.ar} />}
        description={
          <Bi
            en={studentsUi.classes.subtitle.en}
            ar={studentsUi.classes.subtitle.ar}
          />
        }
        actions={
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
        }
      />

      {hasError ? (
        <Alert variant="error">
          <Bi
            en="Grades could not be loaded. Refresh the page or check the database connection."
            ar="تعذّر تحميل الصفوف. حدّث الصفحة أو تحقق من اتصال قاعدة البيانات."
          />
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap aria-hidden="true" className="size-4 text-primary" />
              <Bi
                en={studentsUi.classes.addGrade.en}
                ar={studentsUi.classes.addGrade.ar}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en="A grade groups students across one academic level. Every class belongs to exactly one grade."
                ar="يجمع الصف الطلاب ضمن مستوى دراسي واحد. كل فصل يتبع صفًا واحدًا فقط."
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GradeForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School aria-hidden="true" className="size-4 text-primary" />
              <Bi
                en={studentsUi.classes.addClass.en}
                ar={studentsUi.classes.addClass.ar}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en="Classes keep students grouped inside a grade and can be changed per student."
                ar="تُبقي الفصول الطلاب مجمّعين داخل الصف، ويمكن تغييرها لكل طالب."
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClassForm grades={gradeOptions} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <Bi en="Current structure" ar="الهيكل الحالي" />
          </CardTitle>
          <CardDescription>
            <Bi
              en="Grade isolation for resources and assessments relies on this structure."
              ar="يعتمد عزل الصفوف للمصادر والتقييمات على هذا الهيكل."
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {grades.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={
                <Bi
                  en={studentsUi.classes.noGrades.en}
                  ar={studentsUi.classes.noGrades.ar}
                />
              }
              description={
                <Bi
                  en={studentsUi.classes.noGradesHint.en}
                  ar={studentsUi.classes.noGradesHint.ar}
                />
              }
            />
          ) : (
            <ul className="space-y-3">
              {grades.map((grade) => (
                <li
                  key={grade.id}
                  className="rounded-xl border border-border bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {grade.name_en}
                      </p>
                      <p
                        lang="ar"
                        dir="rtl"
                        className="font-arabic text-xs text-muted-foreground"
                      >
                        {grade.name_ar}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{grade.slug}</Badge>
                      <Badge variant={grade.is_active ? "success" : "muted"}>
                        <Bi
                          en={
                            grade.is_active
                              ? studentsUi.filters.activeOnly.en
                              : studentsUi.classes.inactive.en
                          }
                          ar={
                            grade.is_active
                              ? studentsUi.filters.activeOnly.ar
                              : studentsUi.classes.inactive.ar
                          }
                          hideSeparator
                        />
                      </Badge>
                    </div>
                  </div>

                  {grade.classes.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      <Bi
                        en={studentsUi.classes.noClasses.en}
                        ar={studentsUi.classes.noClasses.ar}
                      />
                      {" — "}
                      <Bi
                        en={studentsUi.classes.noClassesHint.en}
                        ar={studentsUi.classes.noClassesHint.ar}
                      />
                    </p>
                  ) : (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {grade.classes.map((classRow) => (
                        <li
                          key={classRow.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {classRow.name_en}
                            </p>
                            <p
                              lang="ar"
                              dir="rtl"
                              className="font-arabic truncate text-muted-foreground"
                            >
                              {classRow.name_ar}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {classRow.academic_year ? (
                              <span className="text-[11px] text-muted-foreground">
                                {classRow.academic_year}
                              </span>
                            ) : null}
                            <Badge
                              variant={classRow.is_active ? "outline" : "muted"}
                            >
                              {classRow.is_active ? (
                                <Bi
                                  en={studentsUi.filters.activeOnly.en}
                                  ar={studentsUi.filters.activeOnly.ar}
                                  hideSeparator
                                />
                              ) : (
                                <Bi
                                  en={studentsUi.classes.inactive.en}
                                  ar={studentsUi.classes.inactive.ar}
                                  hideSeparator
                                />
                              )}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
