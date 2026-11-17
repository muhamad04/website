import Link from "next/link";
import { Search } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { studentsUi } from "@/lib/i18n/students";
import type { GradeWithClasses } from "@/lib/domain/types";
import type { StudentFilters } from "@/lib/students/filters";

/**
 * Plain GET form: filters are shareable URLs and work without JavaScript.
 * Values are re-parsed and sanitised server-side on every request.
 */
export function StudentFiltersBar({
  filters,
  grades,
}: {
  filters: StudentFilters;
  grades: GradeWithClasses[];
}) {
  return (
    <form
      action="/teacher/students"
      method="get"
      className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))] lg:items-end"
    >
      <div className="space-y-1.5">
        <Label htmlFor="student-search">
          <Bi en={studentsUi.filters.search.en} ar={studentsUi.filters.search.ar} />
        </Label>
        <Input
          id="student-search"
          name="q"
          type="search"
          defaultValue={filters.search ?? ""}
          placeholder={`${studentsUi.filters.searchPlaceholder.en} / ${studentsUi.filters.searchPlaceholder.ar}`}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="student-grade">
          <Bi en={studentsUi.filters.grade.en} ar={studentsUi.filters.grade.ar} />
        </Label>
        <Select
          id="student-grade"
          name="grade"
          defaultValue={filters.gradeId ?? ""}
        >
          <option value="">{studentsUi.filters.allGrades.en}</option>
          {grades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name_en} · {grade.name_ar}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="student-class">
          <Bi en={studentsUi.filters.class.en} ar={studentsUi.filters.class.ar} />
        </Label>
        <Select
          id="student-class"
          name="class"
          defaultValue={filters.classId ?? ""}
        >
          <option value="">{studentsUi.filters.allClasses.en}</option>
          {grades.map((grade) =>
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
        <Label htmlFor="student-status">
          <Bi en={studentsUi.filters.status.en} ar={studentsUi.filters.status.ar} />
        </Label>
        <Select id="student-status" name="status" defaultValue={filters.status}>
          <option value="all">{studentsUi.filters.allStatuses.en}</option>
          <option value="active">{studentsUi.filters.activeOnly.en}</option>
          <option value="inactive">{studentsUi.filters.inactiveOnly.en}</option>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm">
          <Search aria-hidden="true" className="size-3.5" />
          <Bi en={studentsUi.filters.apply.en} ar={studentsUi.filters.apply.ar} />
        </Button>
        <Link
          href="/teacher/students"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <Bi en={studentsUi.filters.clear.en} ar={studentsUi.filters.clear.ar} />
        </Link>
      </div>
    </form>
  );
}
