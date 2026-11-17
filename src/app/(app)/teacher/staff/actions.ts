"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  countOtherActiveAdmins,
  getManagedStaffProfile,
} from "@/lib/data/staff";
import { logStaffEvent } from "@/lib/staff/audit";
import {
  evaluateStaffActivation,
  evaluateStaffRoleChange,
} from "@/lib/staff/rules";
import {
  createStaffAccount,
  issueStaffAccessLink,
  restoreStaffAuthEmail,
  syncStaffAuthMetadata,
  updateStaffAuthEmail,
} from "@/lib/staff/provisioning";
import {
  changeStaffRoleSchema,
  createStaffSchema,
  fieldErrorsFrom,
  setStaffActiveSchema,
  staffAccessRequestSchema,
  updateStaffSchema,
  type StaffActionResult,
  type StaffErrorCode,
} from "@/lib/validation/staff";

/**
 * Every action starts with requireAdmin(), re-validates input, proves the
 * target is a staff profile and then applies the same self/last-admin rules as
 * the database trigger. No action accepts a role or active flag from a
 * teacher, and no action accepts a password.
 */

function fail(
  error: StaffErrorCode,
  extra: Partial<StaffActionResult> = {},
): StaffActionResult {
  return { ok: false, error, ...extra };
}

function revalidateStaff(staffId?: string): void {
  revalidatePath("/teacher/staff");
  revalidatePath("/teacher");
  revalidatePath("/teacher/reporting");

  if (staffId) {
    revalidatePath(`/teacher/staff/${staffId}`);
  }
}

function mapStaffWriteError(
  message: string,
  fallback: StaffErrorCode = "unknown",
): StaffErrorCode {
  if (message.includes("last_admin_protected")) {
    return "last_admin_protected";
  }

  if (
    message.includes("profile_self_admin_change_forbidden") ||
    message.includes("profile_role_change_forbidden") ||
    message.includes("profile_staff_update_forbidden")
  ) {
    return "forbidden";
  }

  if (
    message.includes("profiles_email_not_blank") ||
    message.includes("profiles_email_not_internal")
  ) {
    return "email_invalid";
  }

  console.error("staff profile write failed", message);
  return fallback;
}

async function staffEmailInUse(
  email: string,
  exceptId?: string,
): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id")
    .eq("email", email);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    // Supabase Auth remains the authority; do not report a false duplicate.
    console.error("staff email lookup failed", error.message);
    return false;
  }

  return (data ?? []).length > 0;
}

export async function createStaffAction(
  input: unknown,
): Promise<StaffActionResult> {
  const admin = await requireAdmin();

  const parsed = createStaffSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;

  if (await staffEmailInUse(data.email)) {
    return fail("email_taken", {
      fieldErrors: { email: "email_taken" },
    });
  }

  const provisioned = await createStaffAccount({
    email: data.email,
    full_name_en: data.full_name_en,
    full_name_ar: data.full_name_ar,
    role: data.role,
    is_active: data.is_active === "true",
  });

  if (!provisioned.ok) {
    const fieldErrors =
      provisioned.error === "email_taken" ||
      provisioned.error === "email_invalid"
        ? { email: provisioned.error }
        : undefined;

    return fail(provisioned.error, { fieldErrors });
  }

  await logStaffEvent(admin.id, provisioned.userId, "created", {
    role: data.role,
    is_active: data.is_active === "true",
    setup_issued: Boolean(provisioned.accessUrl),
  });

  if (provisioned.accessUrl) {
    const now = new Date().toISOString();
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ invitation_sent_at: now })
      .eq("id", provisioned.userId);

    if (error) {
      console.error("staff invitation timestamp failed", error.message);
    }
  }

  revalidateStaff(provisioned.userId);

  return {
    ok: true,
    staffId: provisioned.userId,
    staffName: data.full_name_en,
    accessUrl: provisioned.accessUrl,
  };
}

export async function updateStaffAction(
  input: unknown,
): Promise<StaffActionResult> {
  const admin = await requireAdmin();

  const parsed = updateStaffSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  const target = await getManagedStaffProfile(data.staff_id);

  if (!target) {
    return fail("not_found");
  }

  const previousEmail = (target.email ?? "").trim().toLowerCase();
  const emailChanged = previousEmail !== data.email;

  if (emailChanged && (await staffEmailInUse(data.email, target.id))) {
    return fail("email_taken", {
      fieldErrors: { email: "email_taken" },
    });
  }

  if (emailChanged) {
    const identity = await updateStaffAuthEmail(target.id, data.email);

    if (!identity.ok) {
      return fail(identity.error, {
        fieldErrors: { email: identity.error },
      });
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name_en: data.full_name_en,
      full_name_ar: data.full_name_ar,
      email: data.email,
    })
    .eq("id", target.id)
    .in("role", ["teacher", "admin"]);

  if (error) {
    if (emailChanged) {
      await restoreStaffAuthEmail(target.id, previousEmail || null);
    }

    const code = mapStaffWriteError(error.message);
    return fail(
      code,
      code === "email_invalid" ? { fieldErrors: { email: code } } : {},
    );
  }

  await logStaffEvent(admin.id, target.id, "updated", {
    email_changed: emailChanged,
    name_changed:
      data.full_name_en !== target.full_name_en ||
      (data.full_name_ar ?? null) !== (target.full_name_ar ?? null),
  });

  revalidateStaff(target.id);

  return {
    ok: true,
    staffId: target.id,
    staffName: data.full_name_en,
  };
}

export async function changeStaffRoleAction(
  input: unknown,
): Promise<StaffActionResult> {
  const admin = await requireAdmin();

  const parsed = changeStaffRoleSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  const target = await getManagedStaffProfile(data.staff_id);

  if (!target) {
    return fail("not_found");
  }

  const otherActiveAdmins =
    target.role === "admin" && target.is_active
      ? await countOtherActiveAdmins(target.id)
      : 0;

  const decision = evaluateStaffRoleChange({
    actorId: admin.id,
    actorRole: admin.role,
    targetId: target.id,
    targetRole: target.role,
    targetIsActive: target.is_active,
    nextRole: data.role,
    otherActiveAdmins,
  });

  if (!decision.allowed) {
    return fail(decision.error);
  }

  if (target.role === data.role) {
    return { ok: true, staffId: target.id, staffName: target.full_name_en };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: data.role })
    .eq("id", target.id)
    .in("role", ["teacher", "admin"]);

  if (error) {
    return fail(
      mapStaffWriteError(error.message, "self_role_change_forbidden"),
    );
  }

  await syncStaffAuthMetadata(target.id, { app_role: data.role });

  await logStaffEvent(admin.id, target.id, "role_changed", {
    previous_role: target.role,
    role: data.role,
  });

  revalidateStaff(target.id);

  return {
    ok: true,
    staffId: target.id,
    staffName: target.full_name_en,
  };
}

export async function setStaffActiveAction(
  input: unknown,
): Promise<StaffActionResult> {
  const admin = await requireAdmin();

  const parsed = setStaffActiveSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const data = parsed.data;
  const nextIsActive = data.is_active === "true";
  const target = await getManagedStaffProfile(data.staff_id);

  if (!target) {
    return fail("not_found");
  }

  const otherActiveAdmins =
    target.role === "admin" && target.is_active
      ? await countOtherActiveAdmins(target.id)
      : 0;

  const decision = evaluateStaffActivation({
    actorId: admin.id,
    actorRole: admin.role,
    targetId: target.id,
    targetRole: target.role,
    targetIsActive: target.is_active,
    nextIsActive,
    otherActiveAdmins,
  });

  if (!decision.allowed) {
    return fail(decision.error);
  }

  if (target.is_active === nextIsActive) {
    return { ok: true, staffId: target.id, staffName: target.full_name_en };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: nextIsActive })
    .eq("id", target.id)
    .in("role", ["teacher", "admin"]);

  if (error) {
    return fail(
      mapStaffWriteError(error.message, "self_deactivation_forbidden"),
    );
  }

  await syncStaffAuthMetadata(target.id, { is_active: nextIsActive });

  await logStaffEvent(
    admin.id,
    target.id,
    nextIsActive ? "activated" : "deactivated",
  );

  revalidateStaff(target.id);

  return {
    ok: true,
    staffId: target.id,
    staffName: target.full_name_en,
  };
}

export async function resetStaffAccessAction(
  input: unknown,
): Promise<StaffActionResult> {
  const admin = await requireAdmin();

  const parsed = staffAccessRequestSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const data = parsed.data;
  const target = await getManagedStaffProfile(data.staff_id);

  if (!target) {
    return fail("not_found");
  }

  if (!target.email) {
    return fail("reset_failed");
  }

  const accessUrl = await issueStaffAccessLink(target.email);

  if (!accessUrl) {
    return fail("reset_failed");
  }

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ access_reset_at: now, invitation_sent_at: now })
    .eq("id", target.id)
    .in("role", ["teacher", "admin"]);

  if (error) {
    console.error("staff access reset timestamp failed", error.message);
  }

  await logStaffEvent(admin.id, target.id, "access_reset", {
    setup_issued: true,
  });

  revalidateStaff(target.id);

  return {
    ok: true,
    staffId: target.id,
    staffName: target.full_name_en,
    accessUrl,
  };
}
