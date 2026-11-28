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
import { StaffAccessLinkPanel } from "@/app/(app)/teacher/staff/access-link-panel";
import {
  createStaffAction,
  updateStaffAction,
} from "@/app/(app)/teacher/staff/actions";
import { staffErrorCopy, staffUi } from "@/lib/i18n/staff";
import type { StaffRecord } from "@/lib/domain/types";
import type { FieldErrors, StaffActionResult } from "@/lib/validation/staff";

type Values = {
  full_name_en: string;
  full_name_ar: string;
  email: string;
  role: "teacher" | "admin";
  is_active: "true" | "false";
};

function initialValues(staff?: StaffRecord): Values {
  return {
    full_name_en: staff?.full_name_en ?? "",
    full_name_ar: staff?.full_name_ar ?? "",
    email: staff?.email ?? "",
    role: staff?.role ?? "teacher",
    is_active: staff ? (staff.is_active ? "true" : "false") : "true",
  };
}

export function StaffForm({
  mode,
  staff,
}: {
  mode: "create" | "edit";
  staff?: StaffRecord;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => initialValues(staff));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<
    StaffActionResult["error"] | null
  >(null);
  const [result, setResult] = useState<StaffActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setSaved(false);
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setResult(null);
    setSaved(false);

    startTransition(async () => {
      const payload =
        mode === "create"
          ? {
              full_name_en: values.full_name_en,
              // English-only authoring; mirror the English name into the
              // legacy Arabic column so validation and the schema stay happy.
              full_name_ar: values.full_name_en,
              email: values.email,
              role: values.role,
              is_active: values.is_active,
            }
          : {
              staff_id: staff?.id ?? "",
              full_name_en: values.full_name_en,
              // Keep the stored Arabic name untouched on edit.
              full_name_ar: values.full_name_ar,
              email: values.email,
            };

      const outcome =
        mode === "create"
          ? await createStaffAction(payload)
          : await updateStaffAction(payload);

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setFormError(outcome.error ?? "unknown");
        return;
      }

      setResult(outcome);

      if (mode === "edit") {
        setSaved(true);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {formError ? (
        <Alert variant="error">
          <Bi
            en={staffErrorCopy[formError].en}
            ar={staffErrorCopy[formError].en}
          />
        </Alert>
      ) : null}

      {mode === "edit" && saved ? (
        <Alert variant="success">
          <Bi
            en={staffUi.messages.updated.en}
            ar={staffUi.messages.updated.en}
          />
        </Alert>
      ) : null}

      {mode === "create" && result?.ok ? (
        <div className="space-y-3">
          <Alert variant={result.accessUrl ? "success" : "info"}>
            <Bi
              en={
                result.accessUrl
                  ? staffUi.messages.created.en
                  : staffUi.messages.createdNoLink.en
              }
              ar={
                result.accessUrl
                  ? staffUi.messages.created.en
                  : staffUi.messages.createdNoLink.en
              }
            />
          </Alert>

          {result.accessUrl ? (
            <StaffAccessLinkPanel url={result.accessUrl} />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/teacher/staff/${result.staffId ?? ""}`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Bi
                en={staffUi.actions.openProfile.en}
                ar={staffUi.actions.openProfile.en}
              />
            </Link>
            <Link
              href="/teacher/staff"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Bi
                en={staffUi.actions.backToList.en}
                ar={staffUi.actions.backToList.en}
              />
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="full_name_en"
          label={staffUi.form.nameEn}
          error={errors.full_name_en}
          errorCopy={staffErrorCopy}
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
          id="email"
          label={staffUi.form.email}
          hint={staffUi.form.emailHint}
          error={errors.email}
          errorCopy={staffErrorCopy}
          className="sm:col-span-2"
        >
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            autoComplete="off"
            dir="ltr"
            aria-invalid={Boolean(errors.email)}
            required
          />
        </Field>

        {mode === "create" ? (
          <>
            <Field
              id="role"
              label={staffUi.form.role}
              hint={staffUi.form.roleHint}
              error={errors.role}
              errorCopy={staffErrorCopy}
            >
              <Select
                id="role"
                value={values.role}
                onChange={(event) =>
                  update("role", event.target.value as Values["role"])
                }
                aria-invalid={Boolean(errors.role)}
              >
                <option value="teacher">{staffUi.roles.teacher.en}</option>
                <option value="admin">{staffUi.roles.admin.en}</option>
              </Select>
            </Field>

            <Field
              id="is_active"
              label={staffUi.form.active}
              hint={staffUi.form.activeHint}
              error={errors.is_active}
              errorCopy={staffErrorCopy}
            >
              <Select
                id="is_active"
                value={values.is_active}
                onChange={(event) =>
                  update(
                    "is_active",
                    event.target.value as Values["is_active"],
                  )
                }
                aria-invalid={Boolean(errors.is_active)}
              >
                <option value="true">{staffUi.filters.activeOnly.en}</option>
                <option value="false">
                  {staffUi.filters.inactiveOnly.en}
                </option>
              </Select>
            </Field>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
            <Bi
              en={staffUi.form.statusNote.en}
              ar={staffUi.form.statusNote.en}
            />
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Bi
              en={staffUi.actions.saving.en}
              ar={staffUi.actions.saving.en}
            />
          ) : (
            <Bi
              en={
                mode === "create"
                  ? staffUi.actions.create.en
                  : staffUi.actions.save.en
              }
              ar={
                mode === "create"
                  ? staffUi.actions.create.en
                  : staffUi.actions.save.en
              }
            />
          )}
        </Button>
        <Link
          href="/teacher/staff"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Bi
            en={staffUi.actions.backToList.en}
            ar={staffUi.actions.backToList.en}
          />
        </Link>
      </div>
    </form>
  );
}
