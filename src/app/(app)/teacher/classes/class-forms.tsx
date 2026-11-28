"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createClassAction,
  createGradeAction,
} from "@/app/(app)/teacher/classes/actions";
import { studentErrorCopy, studentsUi } from "@/lib/i18n/students";
import type {
  FieldErrors,
  StudentErrorCode,
} from "@/lib/validation/students";

export function GradeForm() {
  const router = useRouter();
  const [values, setValues] = useState({
    name_en: "",
    name_ar: "",
    slug: "",
    sort_order: "0",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<StudentErrorCode | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setError(null);
    setDone(false);

    startTransition(async () => {
      const outcome = await createGradeAction({
        ...values,
        name_ar: values.name_en,
      });

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setError(outcome.error ?? "unknown");
        return;
      }

      setDone(true);
      setValues({ name_en: "", name_ar: "", slug: "", sort_order: "0" });
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="error">
          <Bi en={studentErrorCopy[error].en} ar={studentErrorCopy[error].en} />
        </Alert>
      ) : null}
      {done ? (
        <Alert variant="success">
          <Bi en="Grade added." ar="Grade added." />
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id="grade-name-en"
          label={studentsUi.classes.gradeNameEn}
          error={errors.name_en}
        >
          <Input
            id="grade-name-en"
            value={values.name_en}
            onChange={(event) =>
              setValues((previous) => ({
                ...previous,
                name_en: event.target.value,
              }))
            }
            dir="ltr"
            aria-invalid={Boolean(errors.name_en)}
            required
          />
        </FormField>

        <FormField
          id="grade-slug"
          label={studentsUi.classes.slug}
          hint={studentsUi.classes.slugHint}
          error={errors.slug}
        >
          <Input
            id="grade-slug"
            value={values.slug}
            onChange={(event) =>
              setValues((previous) => ({
                ...previous,
                slug: event.target.value,
              }))
            }
            dir="ltr"
            placeholder="grade-10"
          />
        </FormField>

        <FormField
          id="grade-order"
          label={studentsUi.classes.sortOrder}
          error={errors.sort_order}
        >
          <Input
            id="grade-order"
            type="number"
            min={0}
            max={999}
            value={values.sort_order}
            onChange={(event) =>
              setValues((previous) => ({
                ...previous,
                sort_order: event.target.value,
              }))
            }
            dir="ltr"
          />
        </FormField>
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        <Plus aria-hidden="true" className="size-3.5" />
        <Bi
          en={pending ? studentsUi.actions.saving.en : studentsUi.classes.addGrade.en}
          ar={pending ? studentsUi.actions.saving.en : studentsUi.classes.addGrade.en}
        />
      </Button>
    </form>
  );
}

export function ClassForm({
  grades,
  defaultGradeId,
}: {
  grades: Array<{ id: string; name_en: string; name_ar: string }>;
  defaultGradeId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    grade_id: defaultGradeId ?? grades[0]?.id ?? "",
    name_en: "",
    name_ar: "",
    academic_year: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<StudentErrorCode | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setError(null);
    setDone(false);

    startTransition(async () => {
      const outcome = await createClassAction({
        ...values,
        name_ar: values.name_en,
      });

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setError(outcome.error ?? "unknown");
        return;
      }

      setDone(true);
      setValues((previous) => ({
        ...previous,
        name_en: "",
        name_ar: "",
        academic_year: "",
      }));
      router.refresh();
    });
  };

  if (grades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        <Bi
          en={studentsUi.classes.noGradesHint.en}
          ar={studentsUi.classes.noGradesHint.en}
        />
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="error">
          <Bi en={studentErrorCopy[error].en} ar={studentErrorCopy[error].en} />
        </Alert>
      ) : null}
      {done ? (
        <Alert variant="success">
          <Bi en="Class added." ar="Class added." />
        </Alert>
      ) : null}

      <FormField
        id="class-grade"
        label={studentsUi.classes.grade}
        error={errors.grade_id}
      >
        <Select
          id="class-grade"
          value={values.grade_id}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              grade_id: event.target.value,
            }))
          }
          aria-invalid={Boolean(errors.grade_id)}
          required
        >
          {grades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name_en}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id="class-name-en"
          label={studentsUi.classes.classNameEn}
          error={errors.name_en}
        >
          <Input
            id="class-name-en"
            value={values.name_en}
            onChange={(event) =>
              setValues((previous) => ({
                ...previous,
                name_en: event.target.value,
              }))
            }
            dir="ltr"
            aria-invalid={Boolean(errors.name_en)}
            required
          />
        </FormField>

      </div>

      <FormField
        id="class-year"
        label={studentsUi.classes.academicYear}
        error={errors.academic_year}
      >
        <Input
          id="class-year"
          value={values.academic_year}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              academic_year: event.target.value,
            }))
          }
          dir="ltr"
          placeholder="2026/2027"
        />
      </FormField>

      <Button type="submit" size="sm" disabled={pending}>
        <Plus aria-hidden="true" className="size-3.5" />
        <Bi
          en={pending ? studentsUi.actions.saving.en : studentsUi.classes.addClass.en}
          ar={pending ? studentsUi.actions.saving.en : studentsUi.classes.addClass.en}
        />
      </Button>
    </form>
  );
}
