"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { FormMessage } from "@/components/form-message";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { signInAction } from "@/lib/auth/actions";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/validation/fields";
import { ui } from "@/lib/i18n/dictionary";
import { authErrorCopy } from "@/lib/i18n/messages";
import {
  staffLoginSchema,
  studentLoginSchema,
  type AuthErrorCode,
  type LoginInput,
} from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

type Mode = "student" | "staff";

export function LoginForm({
  initialError,
}: {
  initialError?: AuthErrorCode;
}) {
  const [mode, setMode] = useState<Mode>("student");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<AuthErrorCode | null>(
    initialError ?? null,
  );
  const [isPending, startTransition] = useTransition();

  const switchMode = (next: Mode) => {
    if (next === mode) {
      return;
    }

    setMode(next);
    setPassword("");
    setFieldErrors({});
    setServerError(null);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    const parsed =
      mode === "student"
        ? studentLoginSchema.safeParse({
            mode: "student",
            student_id: studentId,
            password,
          })
        : staffLoginSchema.safeParse({
            mode: "staff",
            email,
            password,
          });

    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    const payload: LoginInput = parsed.data;

    startTransition(async () => {
      const result = await signInAction(payload);

      if (!result.ok) {
        setServerError(result.error);
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="space-y-5"
      aria-busy={isPending}
    >
      <div
        className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary/50 p-1"
        role="tablist"
        aria-label="Sign-in type / نوع تسجيل الدخول"
      >
        {(
          [
            { value: "student" as const, label: ui.login.studentTab },
            { value: "staff" as const, label: ui.login.staffTab },
          ]
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={mode === option.value}
            onClick={() => switchMode(option.value)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              mode === option.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            disabled={isPending}
          >
            <Bi en={option.label.en} ar={option.label.ar} hideSeparator />
          </button>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        <Bi
          en={
            mode === "student"
              ? ui.login.studentSubtitle.en
              : ui.login.staffSubtitle.en
          }
          ar={
            mode === "student"
              ? ui.login.studentSubtitle.ar
              : ui.login.staffSubtitle.ar
          }
        />
      </p>

      {serverError ? (
        <Alert variant="error">
          <Bi
            en={authErrorCopy[serverError].en}
            ar={authErrorCopy[serverError].ar}
          />
        </Alert>
      ) : null}

      {mode === "student" ? (
        <div className="space-y-2">
          <Label htmlFor="student_id">
            <Bi en={ui.common.studentId.en} ar={ui.common.studentId.ar} />
          </Label>
          <Input
            id="student_id"
            type="text"
            inputMode="text"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            dir="ltr"
            placeholder="G10-001"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            aria-invalid={Boolean(fieldErrors.student_id)}
            aria-describedby={
              fieldErrors.student_id ? "student-id-error" : undefined
            }
            disabled={isPending}
            required
          />
          <FormMessage
            message={fieldErrors.student_id}
            className="text-xs"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="email">
            <Bi en={ui.common.email.en} ar={ui.common.email.ar} />
          </Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@example.com"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            disabled={isPending}
            required
          />
          <FormMessage message={fieldErrors.email} className="text-xs" />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">
          <Bi en={ui.common.password.en} ar={ui.common.password.ar} />
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={
            fieldErrors.password ? "password-error" : undefined
          }
          disabled={isPending}
          required
        />
        <FormMessage message={fieldErrors.password} className="text-xs" />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" />
            <Bi en={ui.login.signingIn.en} ar={ui.login.signingIn.ar} />
          </>
        ) : (
          <>
            <LogIn aria-hidden="true" />
            <Bi en={ui.common.signIn.en} ar={ui.common.signIn.ar} />
          </>
        )}
      </Button>
    </form>
  );
}
