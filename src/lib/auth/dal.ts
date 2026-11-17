import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isStaffRole, type StaffRole } from "@/lib/domain/roles";
import type {
  ClassSummary,
  GradeSummary,
  Profile,
  ProfileWithRelations,
} from "@/lib/domain/types";

/**
 * Data Access Layer. Every protected page and server action re-reads the
 * signed-in user here instead of trusting props, cookies or client-supplied
 * role/grade values.
 */

export const getSessionUser = cache(async () => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
});

export const getCurrentProfile = cache(
  async (): Promise<ProfileWithRelations | null> => {
    const user = await getSessionUser();

    if (!user) {
      return null;
    }

    const supabase = await createClient();
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("profiles lookup failed", profileError.message);
      return null;
    }

    if (!profileData) {
      return null;
    }

    const profile = profileData as Profile;
    let grade: GradeSummary | null = null;
    let classRow: ClassSummary | null = null;

    const [gradeResult, classResult] = await Promise.all([
      profile.grade_id
        ? supabase
            .from("grades")
            .select("id, name_en, name_ar, slug")
            .eq("id", profile.grade_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      profile.class_id
        ? supabase
            .from("classes")
            .select("id, name_en, name_ar")
            .eq("id", profile.class_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (gradeResult.error) {
      console.error("grade lookup failed", gradeResult.error.message);
    } else {
      grade = (gradeResult.data as GradeSummary | null) ?? null;
    }

    if (classResult.error) {
      console.error("class lookup failed", classResult.error.message);
    } else {
      classRow = (classResult.data as ClassSummary | null) ?? null;
    }

    return { ...profile, grade, class: classRow };
  },
);

export async function requireProfile(): Promise<ProfileWithRelations> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/account-pending");
  }

  if (!profile.is_active) {
    redirect("/account-disabled");
  }

  return profile;
}

export async function requireTeacher(): Promise<
  ProfileWithRelations & { role: StaffRole }
> {
  const profile = await requireProfile();

  if (!isStaffRole(profile.role)) {
    redirect("/student");
  }

  return profile as ProfileWithRelations & { role: StaffRole };
}

export async function requireAdmin(): Promise<
  ProfileWithRelations & { role: "admin" }
> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    redirect("/teacher");
  }

  return profile as ProfileWithRelations & { role: "admin" };
}

export async function requireStudent(): Promise<
  ProfileWithRelations & { role: "student" }
> {  const profile = await requireProfile();

  if (profile.role !== "student") {
    redirect("/teacher");
  }

  if (!profile.grade_id || !profile.grade) {
    redirect("/account-pending");
  }

  return profile as ProfileWithRelations & { role: "student" };
}
