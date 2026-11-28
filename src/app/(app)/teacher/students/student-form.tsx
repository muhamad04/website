"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Bi } from "@/components/bilingual";
import { FormField as Field } from "@/components/form-field";
import { cn } from "@/lib/utils";
import { AccessLinkPanel } from "@/app/(app)/teacher/students/access-link-panel";
import {
  createStudentAction,
  updateStudentAction,
} from "@/app/(app)/teacher/students/actions";
import {
  passwordErrorCopy,
  studentErrorCopy,
  studentsUi,
} from "@/lib/i18n/students";
import type { GradeWithClasses, StudentRecord } from "@/lib/domain/types";
import type {
  FieldErrors,
  StudentActionResult,
  StudentErrorCode,
} from "@/lib/validation/students";

type Values = {
  full_name_en: string;
  full_name_ar: string;
  email: string;
  username: string;
  student_number: string;
  grade_id: string;
  class_id: string;
  password_mode: "link" | "set";
  initial_password: string;
};

function initialValues(
  student?: StudentRecord,
  defaultGradeId?: string,
  defaultClassId?: string,
): Values {
  return {
    full_name_en: student?.full_name_en ?? "",
    full_name_ar: student?.full_name_ar ?? "",
    email: student?.email ?? "",
    username: student?.username ?? "",
    student_number: student?.student_number ?? "",
    grade_id: student?.grade_id ?? defaultGradeId ?? "",
    class_id: student?.class_id ?? defaultClassId ?? "",
    password_mode: "link",
    initial_password: "",
  };
}

export function StudentForm({
  mode,
  student,
  grades,
  defaultGradeId,
  defaultClassId,
}: {
  mode: "create" | "edit";
  student?: StudentRecord;
  grades: GradeWithClasses[];
  defaultGradeId?: string;
  defaultClassId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() =>
    initialValues(student, defaultGradeId, defaultClassId),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<StudentErrorCode | null>(null);
  const [result, setResult] = useState<StudentActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((previous) => {
      const next = { ...previous, [key]: value };

      if (key === "grade_id") {
        next.class_id = "";
      }

      return next;
    });
  };

  const selectedGrade = grades.find((grade) => grade.id === values.grade_id);
  const classOptions = selectedGrade?.classes ?? [];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setResult(null);

    startTransition(async () => {
      const payload =
        mode === "create"
          ? {
              full_name_en: values.full_name_en,
              // English-only authoring; mirror into the legacy Arabic column.
              full_name_ar: values.full_name_en,
              email: values.email,
              username: values.username,
              student_number: values.student_number,
              grade_id: values.grade_id,
              class_id: values.class_id,
              password_mode: values.password_mode,
              initial_password:
                values.password_mode === "set"
                  ? values.initial_password
                  : "",
            }
          : {
              student_id: student?.id ?? "",
              full_name_en: values.full_name_en,
              // Keep the stored Arabic name untouched on edit.
              full_name_ar: values.full_name_ar,
              email: values.email,
              username: values.username,
              student_number: values.student_number,
              grade_id: values.grade_id,
              class_id: values.class_id,
            };

      const outcome =
        mode === "create"
          ? await createStudentAction(payload)
          : await updateStudentAction(payload);

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setFormError(outcome.error ?? "unknown");
        return;
      }

      setResult(outcome);

      if (mode === "edit") {
        router.refresh();
      } else if (!outcome.accessUrl) {
        router.push(`/teacher/students/${outcome.studentId ?? ""}`);
      }
    });
  };

  const disabled = pending;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {formError ? (
        <Alert variant="error">
          <Bi
            en={studentErrorCopy[formError].en}
            ar={studentErrorCopy[formError].en}
          />
        </Alert>
      ) : null}

      {mode === "edit" && result?.ok ? (
        <Alert variant="success">
          <Bi
            en={studentsUi.messages.updated.en}
            ar={studentsUi.messages.updated.en}
          />
        </Alert>
      ) : null}

      {mode === "create" && result?.ok ? (
        <div className="space-y-3">
          <Alert variant="success">
            <Bi
              en={studentsUi.messages.created.en}
              ar={studentsUi.messages.created.en}
            />
          </Alert>

          {result.accessUrl ? (
            <AccessLinkPanel url={result.accessUrl} />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/teacher/students/${result.studentId ?? ""}`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Bi
                en={studentsUi.actions.open.en}
                ar={studentsUi.actions.open.en}
              />
            </Link>
            <Link
              href="/teacher/students"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi
                en={studentsUi.actions.backToList.en}
                ar={studentsUi.actions.backToList.en}
              />
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="full_name_en"
          label={studentsUi.form.nameEn}
          error={errors.full_name_en}
        >
          <Input
            id="full_name_en"
            value={values.full_name_en}
            onChange={(event) => update("full_name_en", event.target.value)}
            autoComplete="off"
            dir="ltr"
            aria-invalid={Boolean(errors.full_name_en)}
            required
          />
        </Field>

        <Field
          id="student_number"
          label={studentsUi.form.studentNumber}
          hint={studentsUi.form.studentNumberHint}
          error={errors.student_number}
        >
          <Input
            id="student_number"
            value={values.student_number}
            onChange={(event) => update("student_number", event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            dir="ltr"
            aria-invalid={Boolean(errors.student_number)}
            required
          />
        </Field>

        <Field
          id="email"
          label={studentsUi.form.email}
          hint={studentsUi.form.emailHint}
          error={errors.email}
        >
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            autoComplete="off"
            dir="ltr"
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field
          id="grade_id"
          label={studentsUi.form.grade}
          error={errors.grade_id}
        >
          <Select
            id="grade_id"
            value={values.grade_id}
            onChange={(event) => update("grade_id", event.target.value)}
            aria-invalid={Boolean(errors.grade_id)}
            required
          >
            <option value="">{studentsUi.form.noGrade.en}</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name_en}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="class_id"
          label={studentsUi.form.class}
          hint={studentsUi.form.classHint}
          error={errors.class_id}
        >
          <Select
            id="class_id"
            value={values.class_id}
            onChange={(event) => update("class_id", event.target.value)}
            disabled={!selectedGrade || classOptions.length === 0}
            aria-invalid={Boolean(errors.class_id)}
            required
          >
            <option value="">{studentsUi.form.noClass.en}</option>
            {classOptions.map((classRow) => (
              <option key={classRow.id} value={classRow.id}>
                {classRow.name_en}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="username"
          label={studentsUi.form.username}
          hint={studentsUi.form.usernameHint}
          error={errors.username}
          className="sm:col-span-2"
        >
          <Input
            id="username"
            value={values.username}
            onChange={(event) => update("username", event.target.value)}
            autoComplete="off"
            dir="ltr"
            aria-invalid={Boolean(errors.username)}
          />
        </Field>
      </div>

      {mode === "create" ? (
        <fieldset className="space-y-3 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">
            <Bi
              en={studentsUi.form.passwordTitle.en}
              ar={studentsUi.form.passwordTitle.en}
            />
          </legend>
          <p className="text-xs leading-relaxed text-muted-foreground">
            <Bi
              en={studentsUi.form.passwordSubtitle.en}
              ar={studentsUi.form.passwordSubtitle.en}
            />
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  value: "link" as const,
                  label: studentsUi.form.passwordModeLink,
                  hint: studentsUi.form.passwordModeLinkHint,
                },
                {
                  value: "set" as const,
                  label: studentsUi.form.passwordModeSet,
                  hint: studentsUi.form.passwordModeSetHint,
                },
              ]
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors",
                  values.password_mode === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-secondary/40",
                )}
              >
                <input
                  type="radio"
                  name="password_mode"
                  value={option.value}
                  checked={values.password_mode === option.value}
                  onChange={() => update("password_mode", option.value)}
                  className="mt-1 size-4 accent-[var(--primary)]"
                />
                <span className="space-y-0.5">
                  <Bi
                    en={option.label.en}
                    ar={option.label.en}
                    layout="stacked"
                    className="font-medium text-foreground"
                  />
                  <Bi
                    en={option.hint.en}
                    ar={option.hint.en}
                    layout="stacked"
                    className="text-xs text-muted-foreground"
                  />
                </span>
              </label>
            ))}
          </div>

          {values.password_mode === "set" ? (
            <Field
              id="initial_password"
              label={studentsUi.form.initialPassword}
              hint={studentsUi.form.initialPasswordHint}
              error={errors.initial_password}
              errorCopy={passwordErrorCopy}
            >
              <Input
                id="initial_password"
                type="password"
                value={values.initial_password}
                onChange={(event) =>
                  update("initial_password", event.target.value)
                }
                autoComplete="new-password"
                dir="ltr"
                aria-invalid={Boolean(errors.initial_password)}
                required
              />
            </Field>
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={disabled}>
          {pending ? (
            <Bi
              en={studentsUi.actions.saving.en}
              ar={studentsUi.actions.saving.en}
            />
          ) : (
            <Bi
              en={
                mode === "create"
                  ? studentsUi.actions.create.en
                  : studentsUi.actions.save.en
              }
              ar={
                mode === "create"
                  ? studentsUi.actions.create.en
                  : studentsUi.actions.save.en
              }
            />
          )}
        </Button>
        <Link
          href="/teacher/students"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Bi en={studentsUi.actions.backToList.en} ar={studentsUi.actions.backToList.en} />
        </Link>
      </div>
    </form>
  );
}
