"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPasswordAction } from "@/app/set-password/actions";
import { passwordErrorCopy, studentsUi } from "@/lib/i18n/students";
import { cn } from "@/lib/utils";
import type {
  FieldErrors,
  PasswordErrorCode,
} from "@/lib/validation/students";

export function SetPasswordForm({ nextPath }: { nextPath: string }) {
  const [values, setValues] = useState({
    password: "",
    confirm_password: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<PasswordErrorCode | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setError(null);

    startTransition(async () => {
      const outcome = await setPasswordAction(values);

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setError(outcome.error);
        return;
      }

      setDone(true);
      setValues({ password: "", confirm_password: "" });
    });
  };

  if (done) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <Bi
            en={studentsUi.password.success.en}
            ar={studentsUi.password.success.ar}
          />
        </Alert>
        <Link
          href={nextPath}
          className={cn(buttonVariants(), "w-full")}
        >
          <Bi
            en={studentsUi.password.continue.en}
            ar={studentsUi.password.continue.ar}
          />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="error">
          <Bi en={passwordErrorCopy[error].en} ar={passwordErrorCopy[error].ar} />
        </Alert>
      ) : null}

      <FormField
        id="new-password"
        label={studentsUi.password.newPassword}
        hint={studentsUi.password.hint}
        error={errors.password}
      >
        <Input
          id="new-password"
          type="password"
          value={values.password}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              password: event.target.value,
            }))
          }
          autoComplete="new-password"
          dir="ltr"
          aria-invalid={Boolean(errors.password)}
          required
        />
      </FormField>

      <FormField
        id="confirm-password"
        label={studentsUi.password.confirmPassword}
        error={errors.confirm_password}
      >
        <Input
          id="confirm-password"
          type="password"
          value={values.confirm_password}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              confirm_password: event.target.value,
            }))
          }
          autoComplete="new-password"
          dir="ltr"
          aria-invalid={Boolean(errors.confirm_password)}
          required
        />
      </FormField>

      <Button type="submit" className="w-full" disabled={pending}>
        <KeyRound aria-hidden="true" className="size-4" />
        <Bi
          en={
            pending
              ? studentsUi.password.saving.en
              : studentsUi.password.submit.en
          }
          ar={
            pending
              ? studentsUi.password.saving.ar
              : studentsUi.password.submit.ar
          }
        />
      </Button>
    </form>
  );
}
