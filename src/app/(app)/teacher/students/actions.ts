"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  getClassGradeId,
  getManagedProfileRole,
} from "@/lib/data/students";
import {
  createStudentAccount,
  changeStudentAuthIdentity,
  issueStudentAccessLink,
  restoreStudentAuthIdentity,
  studentIdentityKey,
} from "@/lib/students/provisioning";
import {
  accessRequestSchema,
  createStudentSchema,
  fieldErrorsFrom,
  setStudentActiveSchema,
  updateStudentSchema,
  type StudentActionResult,
  type StudentErrorCode,
} from "@/lib/validation/students";
import type { StudentAdminAction } from "@/lib/domain/types";

/**
 * Every action starts with requireTeacher(), validates with zod, proves the
 * target row is a student, and only then touches data. No action accepts a role
 * field, so a teacher can never promote an account through this surface.
 */

function fail(
  error: StudentErrorCode,
  extra: Partial<StudentActionResult> = {},
): StudentActionResult {
  return { ok: false, error, ...extra };
}

async function logStudentEvent(
  actorId: string,
  studentId: string,
  action: StudentAdminAction,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("student_admin_events").insert({
    student_id: studentId,
    actor_id: actorId,
    action,
    detail,
  });

  if (error) {
    // Auditing must never turn a successful administration action into a
    // failure, but it should be visible in server logs.
    console.error("student event log failed", error.message);
  }
}

type Placement =
  | { ok: true; gradeId: string | null; classId: string | null }
  | { ok: false; error: StudentErrorCode };

async function resolvePlacement(
  gradeId: string | undefined,
  classId: string | undefined,
): Promise<Placement> {
  if (!classId) {
    return { ok: true, gradeId: gradeId ?? null, classId: null };
  }

  const classGradeId = await getClassGradeId(classId);

  if (!classGradeId) {
    return { ok: false, error: "grade_class_mismatch" };
  }

  if (gradeId && gradeId !== classGradeId) {
    return { ok: false, error: "grade_class_mismatch" };
  }

  return { ok: true, gradeId: classGradeId, classId };
}

function mapProfileWriteError(message: string): StudentErrorCode {
  if (message.includes("profiles_student_number_unique")) {
    return "student_id_taken";
  }

  if (
    message.includes("profiles_student_number_required") ||
    message.includes("profiles_student_number_format")
  ) {
    return "student_id_invalid";
  }

  if (message.includes("profiles_username_unique")) {
    return "username_taken";
  }

  if (message.includes("profiles_class_grade_fk")) {
    return "grade_class_mismatch";
  }

  console.error("student profile write failed", message);
  return "unknown";
}

/** Fast, friendly duplicate check before Auth identity work begins. */
async function studentIdInUse(
  studentNumber: string,
  exceptId?: string,
): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id")
    .eq("student_number_normalized", studentIdentityKey(studentNumber))
    .limit(1);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { data, error } = await query;

  if (error) {
    // The unique index remains the authority; do not report a false duplicate.
    console.error("student ID lookup failed", error.message);
    return false;
  }

  return (data ?? []).length > 0;
}

export async function createStudentAction(
  input: unknown,
): Promise<StudentActionResult> {
  const staff = await requireTeacher();

  const parsed = createStudentSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  const placement = await resolvePlacement(data.grade_id, data.class_id);

  if (!placement.ok) {
    return fail(placement.error, {
      fieldErrors: { class_id: placement.error },
    });
  }

  if (!placement.gradeId || !placement.classId) {
    return fail("validation_failed", {
      fieldErrors: { grade_id: "grade_required", class_id: "class_required" },
    });
  }

  if (await studentIdInUse(data.student_number)) {
    return fail("student_id_taken", {
      fieldErrors: { student_number: "student_id_taken" },
    });
  }

  const provisioned = await createStudentAccount({
    email: data.email ?? null,
    full_name_en: data.full_name_en,
    full_name_ar: data.full_name_ar,
    username: data.username ?? null,
    student_number: data.student_number,
    grade_id: placement.gradeId,
    class_id: placement.classId,
    initial_password: data.initial_password ?? null,
  });

  if (!provisioned.ok) {
    const fieldErrors: Record<string, string> | undefined =
      provisioned.error === "student_id_taken" ||
      provisioned.error === "student_id_invalid"
        ? { student_number: provisioned.error }
        : provisioned.error === "email_invalid"
          ? { email: provisioned.error }
          : undefined;
    return fail(provisioned.error, { fieldErrors });
  }

  await logStudentEvent(staff.id, provisioned.userId, "created", {
    grade_id: placement.gradeId,
    class_id: placement.classId,
    student_number: data.student_number,
    has_email: Boolean(data.email),
    initial_password_set: data.password_mode === "set",
  });

  if (provisioned.accessUrl) {
    const now = new Date().toISOString();
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ invitation_sent_at: now })
      .eq("id", provisioned.userId);

    if (error) {
      console.error("invitation timestamp failed", error.message);
    }

    await logStudentEvent(staff.id, provisioned.userId, "invited", {
      delivery: "link",
    });
  }

  revalidatePath("/teacher/students");
  revalidatePath("/teacher");

  return {
    ok: true,
    studentId: provisioned.userId,
    studentName: data.full_name_en,
    accessUrl: provisioned.accessUrl,
  };
}

export async function updateStudentAction(
  input: unknown,
): Promise<StudentActionResult> {
  const staff = await requireTeacher();

  const parsed = updateStudentSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  const target = await getManagedProfileRole(data.student_id);

  if (!target) {
    return fail("not_found");
  }

  if (target.role !== "student") {
    return fail("not_a_student");
  }

  const placement = await resolvePlacement(data.grade_id, data.class_id);

  if (!placement.ok) {
    return fail(placement.error, {
      fieldErrors: { class_id: placement.error },
    });
  }

  if (!placement.gradeId || !placement.classId) {
    return fail("validation_failed", {
      fieldErrors: { grade_id: "grade_required", class_id: "class_required" },
    });
  }

  const previousStudentNumber = target.student_number;
  const nextEmail = data.email ?? null;
  const studentIdChanged =
    !previousStudentNumber ||
    studentIdentityKey(previousStudentNumber) !==
      studentIdentityKey(data.student_number);
  const emailChanged =
    (target.email ?? "").trim().toLowerCase() !==
    (nextEmail ?? "").trim().toLowerCase();

  if (studentIdChanged) {
    if (await studentIdInUse(data.student_number, data.student_id)) {
      return fail("student_id_taken", {
        fieldErrors: { student_number: "student_id_taken" },
      });
    }

    const identity = await changeStudentAuthIdentity(
      data.student_id,
      data.student_number,
    );

    if (!identity.ok) {
      return fail(identity.error, {
        fieldErrors: { student_number: identity.error },
      });
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name_en: data.full_name_en,
      full_name_ar: data.full_name_ar,
      email: nextEmail,
      username: data.username ?? null,
      student_number: data.student_number,
      grade_id: placement.gradeId,
      class_id: placement.classId,
    })
    .eq("id", data.student_id);

  if (error) {
    if (studentIdChanged && previousStudentNumber) {
      await restoreStudentAuthIdentity(data.student_id, previousStudentNumber);
    }

    const code = mapProfileWriteError(error.message);
    const field =
      code === "username_taken"
        ? "username"
        : code === "student_id_taken" || code === "student_id_invalid"
          ? "student_number"
          : code === "grade_class_mismatch"
            ? "class_id"
            : undefined;

    return fail(code, field ? { fieldErrors: { [field]: code } } : {});
  }

  if (studentIdChanged) {
    await logStudentEvent(staff.id, data.student_id, "student_id_changed", {
      previous_student_number: previousStudentNumber,
      student_number: data.student_number,
    });
  }

  await logStudentEvent(staff.id, data.student_id, "updated", {
    email_changed: emailChanged,
    student_id_changed: studentIdChanged,
    grade_id: placement.gradeId,
    class_id: placement.classId,
    had_username: Boolean(data.username),
  });

  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${data.student_id}`);
  revalidatePath("/teacher");

  return {
    ok: true,
    studentId: data.student_id,
    studentName: data.full_name_en,
  };
}

export async function setStudentActiveAction(
  input: unknown,
): Promise<StudentActionResult> {
  const staff = await requireTeacher();

  const parsed = setStudentActiveSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const data = parsed.data;
  const isActive = data.is_active === "true";
  const target = await getManagedProfileRole(data.student_id);

  if (!target) {
    return fail("not_found");
  }

  if (target.role !== "student") {
    return fail("not_a_student");
  }

  if (target.is_active === isActive) {
    return { ok: true, studentId: data.student_id };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", data.student_id)
    .eq("role", "student");

  if (error) {
    console.error("student activation failed", error.message);
    return fail("unknown");
  }

  await logStudentEvent(
    staff.id,
    data.student_id,
    isActive ? "activated" : "deactivated",
  );

  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${data.student_id}`);
  revalidatePath("/teacher");

  return { ok: true, studentId: data.student_id };
}

export async function resetStudentAccessAction(
  input: unknown,
): Promise<StudentActionResult> {
  const staff = await requireTeacher();

  const parsed = accessRequestSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const data = parsed.data;
  const target = await getManagedProfileRole(data.student_id);

  if (!target) {
    return fail("not_found");
  }

  if (target.role !== "student") {
    return fail("not_a_student");
  }

  if (!target.student_number) {
    return fail("student_id_invalid");
  }

  const accessUrl = await issueStudentAccessLink(target.student_number);

  if (!accessUrl) {
    return fail("reset_failed");
  }

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ access_reset_at: now, invitation_sent_at: now })
    .eq("id", data.student_id)
    .eq("role", "student");

  if (error) {
    console.error("password reset timestamp failed", error.message);
  }

  await logStudentEvent(staff.id, data.student_id, "password_reset", {
    delivery: "link",
  });

  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${data.student_id}`);

  return {
    ok: true,
    studentId: data.student_id,
    accessUrl,
  };
}
