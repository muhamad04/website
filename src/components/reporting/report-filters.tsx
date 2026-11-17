import Link from "next/link";
import { Search } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { reportingUi } from "@/lib/i18n/reporting";
import { cn } from "@/lib/utils";
import type { ReportFilters } from "@/lib/reporting/filters";
import type { ReportingFilterOptions } from "@/lib/data/reporting";

/**
 * Plain GET form shared by the teacher dashboard and the results page.
 * Filters remain shareable URLs and the export link reuses the same query.
 */
export function ReportFiltersBar({
  action,
  filters,
  options,
  showSearch = false,
  idPrefix = "report",
}: {
  action: string;
  filters: ReportFilters;
  options: ReportingFilterOptions;
  showSearch?: boolean;
  idPrefix?: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form
      action={action}
      method="get"
      className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
    >
      {showSearch ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={id("search")}>
            <Bi
              en={reportingUi.filters.search.en}
              ar={reportingUi.filters.search.ar}
            />
          </Label>
          <Input
            id={id("search")}
            name="q"
            type="search"
            defaultValue={filters.search ?? ""}
            placeholder={`${reportingUi.filters.searchPlaceholder.en} / ${reportingUi.filters.searchPlaceholder.ar}`}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={id("grade")}>
          <Bi
            en={reportingUi.filters.grade.en}
            ar={reportingUi.filters.grade.ar}
          />
        </Label>
        <Select id={id("grade")} name="grade" defaultValue={filters.gradeId ?? ""}>
          <option value="">{reportingUi.filters.allGrades.en}</option>
          {options.grades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name_en} · {grade.name_ar}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("class")}>
          <Bi
            en={reportingUi.filters.class.en}
            ar={reportingUi.filters.class.ar}
          />
        </Label>
        <Select id={id("class")} name="class" defaultValue={filters.classId ?? ""}>
          <option value="">{reportingUi.filters.allClasses.en}</option>
          {options.grades.map((grade) =>
            grade.classes.length > 0 ? (
              <optgroup
                key={grade.id}
                label={`${grade.name_en} · ${grade.name_ar}`}
              >
                {grade.classes.map((classRow) => (
                  <option key={classRow.id} value={classRow.id}>
                    {classRow.name_en} · {classRow.name_ar}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("student")}>
          <Bi
            en={reportingUi.filters.student.en}
            ar={reportingUi.filters.student.ar}
          />
        </Label>
        <Select
          id={id("student")}
          name="student"
          defaultValue={filters.studentId ?? ""}
        >
          <option value="">{reportingUi.filters.allStudents.en}</option>
          {options.students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.full_name_en}
              {student.student_number ? ` · ${student.student_number}` : ""}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("assessment")}>
          <Bi
            en={reportingUi.filters.assessment.en}
            ar={reportingUi.filters.assessment.ar}
          />
        </Label>
        <Select
          id={id("assessment")}
          name="assessment"
          defaultValue={filters.assessmentId ?? ""}
        >
          <option value="">{reportingUi.filters.allAssessments.en}</option>
          {options.assessments.map((assessment) => (
            <option key={assessment.id} value={assessment.id}>
              {assessment.title_en} · {assessment.title_ar}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("type")}>
          <Bi
            en={reportingUi.filters.type.en}
            ar={reportingUi.filters.type.ar}
          />
        </Label>
        <Select id={id("type")} name="type" defaultValue={filters.type}>
          <option value="all">{reportingUi.filters.allTypes.en}</option>
          <option value="quiz">{reportingUi.filters.quizOnly.en}</option>
          <option value="exam">{reportingUi.filters.examOnly.en}</option>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("grading")}>
          <Bi
            en={reportingUi.filters.grading.en}
            ar={reportingUi.filters.grading.ar}
          />
        </Label>
        <Select id={id("grading")} name="grading" defaultValue={filters.grading}>
          <option value="all">{reportingUi.filters.allGrading.en}</option>
          <option value="pending">{reportingUi.filters.pendingReview.en}</option>
          <option value="completed">
            {reportingUi.filters.reviewCompleted.en}
          </option>
          <option value="not_required">
            {reportingUi.filters.notRequired.en}
          </option>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("from")}>
          <Bi en={reportingUi.filters.from.en} ar={reportingUi.filters.from.ar} />
        </Label>
        <Input
          id={id("from")}
          name="from"
          type="date"
          defaultValue={filters.from ?? ""}
          max={filters.to ?? undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("to")}>
          <Bi en={reportingUi.filters.to.en} ar={reportingUi.filters.to.ar} />
        </Label>
        <Input
          id={id("to")}
          name="to"
          type="date"
          defaultValue={filters.to ?? ""}
          min={filters.from ?? undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm">
          <Search aria-hidden="true" className="size-3.5" />
          <Bi en={reportingUi.filters.apply.en} ar={reportingUi.filters.apply.ar} />
        </Button>
        <Link
          href={action}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <Bi en={reportingUi.filters.clear.en} ar={reportingUi.filters.clear.ar} />
        </Link>
      </div>
    </form>
  );
}
