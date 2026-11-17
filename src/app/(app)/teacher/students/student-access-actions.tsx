"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserCheck, UserX } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import {
  resetStudentAccessAction,
  setStudentActiveAction,
} from "@/app/(app)/teacher/students/actions";
import { AccessLinkPanel } from "@/app/(app)/teacher/students/access-link-panel";
import {
  studentErrorCopy,
  studentsUi,
} from "@/lib/i18n/students";
import type { StudentErrorCode } from "@/lib/validation/students";

type AccessState = {
  url: string;
};

export function StudentAccessActions({
  studentId,
  isActive,
}: {
  studentId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<StudentErrorCode | null>(null);
  const [access, setAccess] = useState<AccessState | null>(null);

  const resetPassword = () => {
    setError(null);
    setAccess(null);

    startTransition(async () => {
      const result = await resetStudentAccessAction({ student_id: studentId });

      if (!result.ok || !result.accessUrl) {
        setError(result.error ?? "reset_failed");
        return;
      }

      setAccess({ url: result.accessUrl });
      router.refresh();
    });
  };

  const toggle = () => {
    setError(null);

    startTransition(async () => {
      const result = await setStudentActiveAction({
        student_id: studentId,
        is_active: isActive ? "false" : "true",
      });

      if (!result.ok) {
        setError(result.error ?? "unknown");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={resetPassword}
        >
          <KeyRound aria-hidden="true" className="size-3.5" />
          <Bi
            en={studentsUi.actions.resetAccess.en}
            ar={studentsUi.actions.resetAccess.ar}
            hideSeparator
          />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={isActive ? "ghost" : "secondary"}
          disabled={pending}
          onClick={toggle}
        >
          {isActive ? (
            <UserX aria-hidden="true" className="size-3.5" />
          ) : (
            <UserCheck aria-hidden="true" className="size-3.5" />
          )}
          <Bi
            en={
              isActive
                ? studentsUi.actions.deactivate.en
                : studentsUi.actions.activate.en
            }
            ar={
              isActive
                ? studentsUi.actions.deactivate.ar
                : studentsUi.actions.activate.ar
            }
            hideSeparator
          />
        </Button>
      </div>

      <FormError copy={error ? studentErrorCopy[error] : null} />

      {access ? <AccessLinkPanel url={access.url} /> : null}
    </div>
  );
}
