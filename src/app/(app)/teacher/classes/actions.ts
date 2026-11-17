"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  classSchema,
  fieldErrorsFrom,
  gradeSchema,
  slugify,
  type StudentActionResult,
} from "@/lib/validation/students";

/**
 * Grade and class setup. Staff-only through requireTeacher() and RLS; the
 * composite foreign key on profiles prevents a class from ever being assigned
 * to a student in another grade.
 */

export async function createGradeAction(
  input: unknown,
): Promise<StudentActionResult> {
  await requireTeacher();

  const parsed = gradeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_failed",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const data = parsed.data;
  const slug =
    data.slug ?? (slugify(data.name_en) || `grade-${Date.now().toString(36)}`);

  const supabase = await createClient();
  const { error } = await supabase.from("grades").insert({
    name_en: data.name_en,
    name_ar: data.name_ar,
    slug,
    sort_order: data.sort_order,
  });

  if (error) {
    if (error.message.includes("grades_slug_key")) {
      return {
        ok: false,
        error: "slug_taken",
        fieldErrors: { slug: "slug_taken" },
      };
    }

    if (error.message.includes("grades_name_en_unique")) {
      return {
        ok: false,
        error: "name_taken",
        fieldErrors: { name_en: "name_taken" },
      };
    }

    console.error("grade create failed", error.message);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/teacher/classes");
  revalidatePath("/teacher/students");
  revalidatePath("/teacher/students/new");
  revalidatePath("/teacher");

  return { ok: true };
}

export async function createClassAction(
  input: unknown,
): Promise<StudentActionResult> {
  await requireTeacher();

  const parsed = classSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_failed",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("classes").insert({
    grade_id: data.grade_id,
    name_en: data.name_en,
    name_ar: data.name_ar,
    academic_year: data.academic_year ?? null,
  });

  if (error) {
    if (error.message.includes("classes_grade_name_unique")) {
      return {
        ok: false,
        error: "name_taken",
        fieldErrors: { name_en: "name_taken" },
      };
    }

    if (error.code === "23503") {
      return {
        ok: false,
        error: "grade_class_mismatch",
        fieldErrors: { grade_id: "grade_class_mismatch" },
      };
    }

    console.error("class create failed", error.message);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/teacher/classes");
  revalidatePath("/teacher/students");
  revalidatePath("/teacher/students/new");
  revalidatePath("/teacher");

  return { ok: true };
}
