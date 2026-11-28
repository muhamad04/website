"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  changeStaffRoleAction,
  resetStaffAccessAction,
  setStaffActiveAction,
} from "@/app/(app)/teacher/staff/actions";
import { StaffAccessLinkPanel } from "@/app/(app)/teacher/staff/access-link-panel";
import { staffErrorCopy, staffUi } from "@/lib/i18n/staff";
import type { StaffErrorCode } from "@/lib/validation/staff";

type StaffRole = "teacher" | "admin";

export function StaffAccessActions({
  staffId,
  role,
  isActive,
  isSelf,
  otherActiveAdmins,
}: {
  staffId: string;
  role: StaffRole;
  isActive: boolean;
  isSelf: boolean;
  otherActiveAdmins: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<StaffErrorCode | null>(null);
  const [message, setMessage] = useState<
    "reset" | "roleChanged" | "activated" | "deactivated" | null
  >(null);
  const [access, setAccess] = useState<string | null>(null);
  const [nextRole, setNextRole] = useState<StaffRole>(role);
  const [active, setActive] = useState(isActive);

  const currentRole = role;
  const roleLocked = isSelf;
  const deactivateLocked =
    active &&
    role === "admin" &&
    (isSelf || otherActiveAdmins < 1);
  const roleChangeWouldRemoveLastAdmin =
    active &&
    role === "admin" &&
    otherActiveAdmins < 1 &&
    nextRole !== "admin";

  const reset = () => {
    setError(null);
    setMessage(null);
    setAccess(null);

    startTransition(async () => {
      const result = await resetStaffAccessAction({ staff_id: staffId });

      if (!result.ok || !result.accessUrl) {
        setError(result.error ?? "reset_failed");
        return;
      }

      setAccess(result.accessUrl);
      setMessage("reset");
      router.refresh();
    });
  };

  const toggle = () => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await setStaffActiveAction({
        staff_id: staffId,
        is_active: active ? "false" : "true",
      });

      if (!result.ok) {
        setError(result.error ?? "unknown");
        return;
      }

      const nextActive = !active;
      setActive(nextActive);
      setMessage(nextActive ? "activated" : "deactivated");
      router.refresh();
    });
  };

  const changeRole = () => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await changeStaffRoleAction({
        staff_id: staffId,
        role: nextRole,
      });

      if (!result.ok) {
        setError(result.error ?? "unknown");
        return;
      }

      setMessage("roleChanged");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="staff-role"
          className="text-sm font-semibold text-foreground"
        >
          <Bi en={staffUi.form.role.en} ar={staffUi.form.role.en} />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            id="staff-role"
            value={nextRole}
            onChange={(event) =>
              setNextRole(event.target.value as StaffRole)
            }
            disabled={pending || roleLocked}
          >
            <option value="teacher">{staffUi.roles.teacher.en}</option>
            <option value="admin">{staffUi.roles.admin.en}</option>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={changeRole}
            disabled={
              pending ||
              roleLocked ||
              nextRole === currentRole ||
              roleChangeWouldRemoveLastAdmin
            }
            className="shrink-0"
          >
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            <Bi
              en={staffUi.actions.changeRole.en}
              ar={staffUi.actions.changeRole.en}
              hideSeparator
            />
          </Button>
        </div>
        {roleLocked ? (
          <p className="text-xs text-muted-foreground">
            <Bi
              en={staffUi.guards.selfRole.en}
              ar={staffUi.guards.selfRole.en}
            />
          </p>
        ) : roleChangeWouldRemoveLastAdmin ? (
          <p className="text-xs text-muted-foreground">
            <Bi
              en={staffUi.guards.lastAdmin.en}
              ar={staffUi.guards.lastAdmin.en}
            />
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={reset}
          disabled={pending}
        >
          <KeyRound aria-hidden="true" className="size-3.5" />
          <Bi
            en={staffUi.actions.resetAccess.en}
            ar={staffUi.actions.resetAccess.en}
            hideSeparator
          />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={active ? "ghost" : "secondary"}
          onClick={toggle}
          disabled={pending || deactivateLocked}
        >
          {active ? (
            <UserX aria-hidden="true" className="size-3.5" />
          ) : (
            <UserCheck aria-hidden="true" className="size-3.5" />
          )}
          <Bi
            en={
              active
                ? staffUi.actions.deactivate.en
                : staffUi.actions.activate.en
            }
            ar={
              active
                ? staffUi.actions.deactivate.en
                : staffUi.actions.activate.en
            }
            hideSeparator
          />
        </Button>
      </div>

      {deactivateLocked ? (
        <p className="text-xs text-muted-foreground">
          <Bi
            en={
              isSelf
                ? staffUi.guards.selfDeactivate.en
                : staffUi.guards.lastAdmin.en
            }
            ar={
              isSelf
                ? staffUi.guards.selfDeactivate.en
                : staffUi.guards.lastAdmin.en
            }
          />
        </p>
      ) : null}

      <FormError copy={error ? staffErrorCopy[error] : null} />

      {message ? (
        <Alert variant="success">
          <Bi
            en={staffUi.messages[message].en}
            ar={staffUi.messages[message].en}
          />
        </Alert>
      ) : null}

      {access ? <StaffAccessLinkPanel url={access} /> : null}
    </div>
  );
}
