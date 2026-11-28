import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireTeacher } from "@/lib/auth/dal";
import { listGradesWithClasses } from "@/lib/data/students";
import { studentsUi } from "@/lib/i18n/students";
import { cn } from "@/lib/utils";
import { StudentForm } from "@/app/(app)/teacher/students/student-form";

export const metadata: Metadata = {
  title: "New student",
};

export const dynamic = "force-dynamic";

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeacher();

  const [gradesResult, params] = await Promise.all([
    listGradesWithClasses(),
    searchParams,
  ]);

  const grades = gradesResult.grades;
  const requestedGrade =
    typeof params.grade === "string" ? params.grade : undefined;
  const defaultGradeId = grades.some((grade) => grade.id === requestedGrade)
    ? requestedGrade
    : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={studentsUi.eyebrow.en} ar={studentsUi.eyebrow.en} />}
        title={
          <Bi en={studentsUi.form.createTitle.en} ar={studentsUi.form.createTitle.en} />
        }
        description={
          <Bi
            en={studentsUi.form.createSubtitle.en}
            ar={studentsUi.form.createSubtitle.en}
          />
        }
        actions={
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
        }
      />

      {grades.length === 0 ? (
        <Alert variant="info">
          <div className="space-y-2">
            <Bi
              en="No grades exist yet. You can still create the account, but the student cannot open the student area until a grade is assigned."
              ar="لا توجد صفوف بعد. يمكنك إنشاء الحساب، لكن لن يستطيع الطالب فتح مساحة الطالب حتى يُسنَد إليه صف."
            />
            <Link
              href="/teacher/classes"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi
                en={studentsUi.actions.manageClasses.en}
                ar={studentsUi.actions.manageClasses.en}
              />
            </Link>
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <Bi en="Account details" ar="بيانات الحساب" />
          </CardTitle>
          <CardDescription>
            <Bi
              en="The Student ID becomes the student's sign-in name. Email is optional contact data. Passwords are never shown here."
              ar="يصبح رقم الطالب اسم دخول الطالب. البريد الإلكتروني بيانات تواصل اختيارية. لا تُعرض كلمات المرور هنا أبدًا."
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentForm
            mode="create"
            grades={grades}
            defaultGradeId={defaultGradeId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
