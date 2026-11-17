"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth/dal";
import {
  getResourceCategoryById,
  getTeacherResourceById,
  gradeExists,
} from "@/lib/data/resources";
import type { ResourceAdminAction } from "@/lib/domain/types";
import {
  RESOURCE_BUCKET,
  buildResourceStoragePath,
  isStoredResourceType,
  moveResourceStoragePath,
} from "@/lib/resources/files";
import {
  moveResourceObject,
  removeResourceObject,
  verifyUploadedResourceObject,
} from "@/lib/resources/storage";
import { parseYouTubeInput } from "@/lib/resources/youtube";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import {
  categoryIdSchema,
  createCategorySchema,
  createResourceSchema,
  fieldErrorsFrom,
  prepareResourceUploadSchema,
  resourceIdSchema,
  setResourcePublishedSchema,
  updateCategorySchema,
  updateResourceSchema,
  type ResourceActionResult,
  type ResourceErrorCode,
} from "@/lib/validation/resources";

/**
 * Resource management actions. Every entry point starts with requireTeacher(),
 * validates with zod, proves referenced grades/categories exist, and only then
 * touches data. The browser never supplies a trusted grade for students, and a
 * storage path must match the submitted grade and type.
 */

function fail(
  error: ResourceErrorCode,
  extra: Partial<ResourceActionResult> = {},
): ResourceActionResult {
  return { ok: false, error, ...extra };
}

async function logResourceEvent(
  actorId: string,
  target: { resourceId?: string | null; categoryId?: string | null },
  action: ResourceAdminAction,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("resource_admin_events").insert({
    resource_id: target.resourceId ?? null,
    category_id: target.categoryId ?? null,
    actor_id: actorId,
    action,
    detail,
  });

  if (error) {
    // Auditing must not turn a successful management action into a failure,
    // but it should be visible in server logs.
    console.error("resource event log failed", error.message);
  }
}

async function resolveCategory(
  categoryId: string | undefined,
): Promise<{ ok: true; categoryId: string | null } | { ok: false }> {
  if (!categoryId) {
    return { ok: true, categoryId: null };
  }

  const category = await getResourceCategoryById(categoryId);
  return category ? { ok: true, categoryId } : { ok: false };
}

async function cleanupUnreferencedObject(path: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .select("id")
    .eq("storage_path", path)
    .maybeSingle();

  if (error) {
    console.error("resource path reference check failed", error.message);
    return;
  }

  if (!data) {
    await removeResourceObject(path);
  }
}

function isUniqueViolation(message: string, constraint: string): boolean {
  return message.includes(constraint);
}

function revalidateResourceSurfaces(resourceId?: string): void {
  revalidatePath("/teacher/resources");
  revalidatePath("/teacher");
  revalidatePath("/student/resources");
  revalidatePath("/student");

  if (resourceId) {
    revalidatePath(`/teacher/resources/${resourceId}`);
    revalidatePath(`/student/resources/${resourceId}`);
  }
}

function revalidateCategorySurfaces(): void {
  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/resources/categories");
  revalidatePath("/student/resources");
}

/* -------------------------------------------------------------------------- */
/* Upload preparation and resource creation                                    */
/* -------------------------------------------------------------------------- */

export async function prepareResourceUploadAction(
  input: unknown,
): Promise<ResourceActionResult> {
  await requireTeacher();

  const parsed = prepareResourceUploadSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;

  if (!isStoredResourceType(data.type)) {
    return fail("type_invalid", { fieldErrors: { type: "type_invalid" } });
  }

  if (!(await gradeExists(data.grade_id))) {
    return fail("grade_not_found", {
      fieldErrors: { grade_id: "grade_not_found" },
    });
  }

  const category = await resolveCategory(data.category_id);

  if (!category.ok) {
    return fail("category_not_found", {
      fieldErrors: { category_id: "category_not_found" },
    });
  }

  const path = buildResourceStoragePath({
    gradeId: data.grade_id,
    type: data.type,
    fileName: data.file_name,
    mimeType: data.mime_type,
  });

  if (!path) {
    return fail("file_type_invalid", {
      fieldErrors: { mime_type: "file_type_invalid" },
    });
  }

  const supabase = await createClient();
  const { data: signed, error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !signed) {
    console.error("signed upload URL failed", error?.message ?? "no data");
    return fail("storage_failed");
  }

  return {
    ok: true,
    upload: {
      bucket: RESOURCE_BUCKET,
      path,
      token: signed.token,
    },
  };
}

export async function createResourceAction(
  input: unknown,
): Promise<ResourceActionResult> {
  const staff = await requireTeacher();
  const parsed = createResourceSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;

  if (!(await gradeExists(data.grade_id))) {
    return fail("grade_not_found", {
      fieldErrors: { grade_id: "grade_not_found" },
    });
  }

  const category = await resolveCategory(data.category_id);

  if (!category.ok) {
    return fail("category_not_found", {
      fieldErrors: { category_id: "category_not_found" },
    });
  }

  let storagePath: string | null = null;
  let externalUrl: string | null = null;
  let thumbnailUrl: string | null = null;

  if (data.type === "youtube") {
    const youtube = parseYouTubeInput(data.youtube_url);

    if (!youtube) {
      return fail("youtube_url_invalid", {
        fieldErrors: { youtube_url: "youtube_url_invalid" },
      });
    }

    externalUrl = youtube.url;
    thumbnailUrl = youtube.thumbnailUrl;
  } else {
    if (!isStoredResourceType(data.type) || !data.storage_path) {
      return fail("file_required", {
        fieldErrors: { storage_path: "file_required" },
      });
    }

    const verification = await verifyUploadedResourceObject(
      data.storage_path,
      data.type,
    );

    if (!verification.ok) {
      return fail(verification.error, {
        fieldErrors: { storage_path: verification.error },
      });
    }

    storagePath = data.storage_path;
  }

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("resources")
    .insert({
      grade_id: data.grade_id,
      category_id: category.categoryId,
      type: data.type,
      title_en: data.title_en,
      title_ar: data.title_ar,
      description_en: data.description_en ?? null,
      description_ar: data.description_ar ?? null,
      storage_path: storagePath,
      external_url: externalUrl,
      thumbnail_url: thumbnailUrl,
      is_published: data.is_published,
      sort_order: data.sort_order,
      created_by: staff.id,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    const message = error?.message ?? "resource insert failed";

    if (isUniqueViolation(message, "resources_storage_path_unique")) {
      return fail("upload_conflict", {
        fieldErrors: { storage_path: "upload_conflict" },
      });
    }

    if (
      isUniqueViolation(message, "resources_storage_path_grade_type_check") ||
      isUniqueViolation(message, "resources_source_check")
    ) {
      return fail("file_name_invalid", {
        fieldErrors: { storage_path: "file_name_invalid" },
      });
    }

    console.error("resource insert failed", message);

    if (storagePath) {
      await cleanupUnreferencedObject(storagePath);
    }

    return fail("unknown");
  }

  const resourceId = (inserted as { id: string }).id;

  await logResourceEvent(staff.id, { resourceId }, "created", {
    type: data.type,
    grade_id: data.grade_id,
    category_id: category.categoryId,
    is_published: data.is_published,
    has_file: Boolean(storagePath),
  });

  revalidateResourceSurfaces(resourceId);

  return { ok: true, resourceId };
}

/* -------------------------------------------------------------------------- */
/* Editing, publishing and deleting                                            */
/* -------------------------------------------------------------------------- */

export async function updateResourceAction(
  input: unknown,
): Promise<ResourceActionResult> {
  const staff = await requireTeacher();
  const parsed = updateResourceSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  const existing = await getTeacherResourceById(data.resource_id);

  if (!existing) {
    return fail("not_found");
  }

  if (existing.type !== data.type) {
    return fail("type_immutable", { fieldErrors: { type: "type_immutable" } });
  }

  if (!(await gradeExists(data.grade_id))) {
    return fail("grade_not_found", {
      fieldErrors: { grade_id: "grade_not_found" },
    });
  }

  const category = await resolveCategory(data.category_id);

  if (!category.ok) {
    return fail("category_not_found", {
      fieldErrors: { category_id: "category_not_found" },
    });
  }

  let storagePath = existing.storage_path;
  let externalUrl: string | null = null;
  let thumbnailUrl: string | null = null;
  let movedFrom: string | null = null;

  if (data.type === "youtube") {
    const youtube = parseYouTubeInput(data.youtube_url);

    if (!youtube) {
      return fail("youtube_url_invalid", {
        fieldErrors: { youtube_url: "youtube_url_invalid" },
      });
    }

    externalUrl = youtube.url;
    thumbnailUrl = youtube.thumbnailUrl;
  } else {
    if (
      !isStoredResourceType(data.type) ||
      !existing.storage_path
    ) {
      return fail("upload_missing");
    }

    if (existing.grade_id !== data.grade_id) {
      const movedPath = moveResourceStoragePath(
        existing.storage_path,
        data.grade_id,
      );

      if (!movedPath) {
        return fail("file_name_invalid");
      }

      const moved = await moveResourceObject(
        existing.storage_path,
        movedPath,
      );

      if (!moved) {
        return fail("storage_failed");
      }

      movedFrom = existing.storage_path;
      storagePath = movedPath;
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("resources")
    .update({
      grade_id: data.grade_id,
      category_id: category.categoryId,
      title_en: data.title_en,
      title_ar: data.title_ar,
      description_en: data.description_en ?? null,
      description_ar: data.description_ar ?? null,
      storage_path: storagePath,
      external_url: externalUrl,
      thumbnail_url: thumbnailUrl,
      is_published: data.is_published,
      sort_order: data.sort_order,
    })
    .eq("id", data.resource_id);

  if (error) {
    if (movedFrom && storagePath) {
      await moveResourceObject(storagePath, movedFrom);
    }

    if (isUniqueViolation(error.message, "resources_storage_path_unique")) {
      return fail("upload_conflict");
    }

    if (
      isUniqueViolation(error.message, "resources_storage_path_grade_type_check") ||
      isUniqueViolation(error.message, "resources_source_check")
    ) {
      return fail("file_name_invalid");
    }

    console.error("resource update failed", error.message);
    return fail("unknown");
  }

  const gradeChanged = existing.grade_id !== data.grade_id;
  const publishChanged = existing.is_published !== data.is_published;

  await logResourceEvent(staff.id, { resourceId: data.resource_id }, "updated", {
    type: data.type,
    grade_id: data.grade_id,
    category_id: category.categoryId,
    grade_changed: gradeChanged,
    is_published: data.is_published,
    has_file: data.type !== "youtube",
  });

  if (publishChanged) {
    await logResourceEvent(
      staff.id,
      { resourceId: data.resource_id },
      data.is_published ? "published" : "unpublished",
    );
  }

  revalidateResourceSurfaces(data.resource_id);

  return { ok: true, resourceId: data.resource_id };
}

export async function setResourcePublishedAction(
  input: unknown,
): Promise<ResourceActionResult> {
  const staff = await requireTeacher();
  const parsed = setResourcePublishedSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const data = parsed.data;
  const isPublished = data.is_published === "true";
  const existing = await getTeacherResourceById(data.resource_id);

  if (!existing) {
    return fail("not_found");
  }

  if (existing.is_published === isPublished) {
    return { ok: true, resourceId: data.resource_id };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("resources")
    .update({ is_published: isPublished })
    .eq("id", data.resource_id);

  if (error) {
    console.error("resource publish toggle failed", error.message);
    return fail("unknown");
  }

  await logResourceEvent(
    staff.id,
    { resourceId: data.resource_id },
    isPublished ? "published" : "unpublished",
  );

  revalidateResourceSurfaces(data.resource_id);

  return { ok: true, resourceId: data.resource_id };
}

export async function deleteResourceAction(
  input: unknown,
): Promise<ResourceActionResult> {
  const staff = await requireTeacher();
  const parsed = resourceIdSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const resourceId = parsed.data.resource_id;
  const existing = await getTeacherResourceById(resourceId);

  if (!existing) {
    return fail("not_found");
  }

  const cleanupOk = existing.storage_path
    ? await removeResourceObject(existing.storage_path)
    : true;

  const supabase = await createClient();
  const { error } = await supabase
    .from("resources")
    .delete()
    .eq("id", resourceId);

  if (error) {
    console.error("resource delete failed", error.message);
    return fail("unknown");
  }

  await logResourceEvent(staff.id, { resourceId }, "deleted", {
    title_en: existing.title_en,
    type: existing.type,
    grade_id: existing.grade_id,
    category_id: existing.category_id,
    was_published: existing.is_published,
    had_file: Boolean(existing.storage_path),
    storage_cleanup_failed: !cleanupOk,
  });

  revalidateResourceSurfaces(resourceId);

  return { ok: true, resourceId };
}

/* -------------------------------------------------------------------------- */
/* Category management                                                         */
/* -------------------------------------------------------------------------- */

function mapCategoryWriteError(message: string): ResourceErrorCode {
  if (isUniqueViolation(message, "resource_categories_slug_key")) {
    return "slug_taken";
  }

  console.error("resource category write failed", message);
  return "unknown";
}

export async function createCategoryAction(
  input: unknown,
): Promise<ResourceActionResult> {
  const staff = await requireTeacher();
  const parsed = createCategorySchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  const slug = data.slug ?? slugify(data.name_en, 60);

  if (slug.length < 2) {
    return fail("slug_invalid", { fieldErrors: { slug: "slug_invalid" } });
  }

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("resource_categories")
    .insert({
      name_en: data.name_en,
      name_ar: data.name_ar,
      slug,
      description_en: data.description_en ?? null,
      description_ar: data.description_ar ?? null,
      sort_order: data.sort_order,
      is_active: data.is_active,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    const code = mapCategoryWriteError(error?.message ?? "category insert failed");
    return fail(code, {
      fieldErrors: code === "slug_taken" ? { slug: code } : undefined,
    });
  }

  const categoryId = (inserted as { id: string }).id;

  await logResourceEvent(staff.id, { categoryId }, "category_created", {
    name_en: data.name_en,
    slug,
    is_active: data.is_active,
  });

  revalidateCategorySurfaces();

  return { ok: true, categoryId };
}

export async function updateCategoryAction(
  input: unknown,
): Promise<ResourceActionResult> {
  const staff = await requireTeacher();
  const parsed = updateCategorySchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const data = parsed.data;
  const existing = await getResourceCategoryById(data.category_id);

  if (!existing) {
    return fail("category_not_found");
  }

  const slug = data.slug ?? existing.slug;

  if (slug.length < 2) {
    return fail("slug_invalid", { fieldErrors: { slug: "slug_invalid" } });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("resource_categories")
    .update({
      name_en: data.name_en,
      name_ar: data.name_ar,
      slug,
      description_en: data.description_en ?? null,
      description_ar: data.description_ar ?? null,
      sort_order: data.sort_order,
      is_active: data.is_active,
    })
    .eq("id", data.category_id);

  if (error) {
    const code = mapCategoryWriteError(error.message);
    return fail(code, {
      fieldErrors: code === "slug_taken" ? { slug: code } : undefined,
    });
  }

  await logResourceEvent(
    staff.id,
    { categoryId: data.category_id },
    "category_updated",
    {
      name_en: data.name_en,
      slug,
      is_active: data.is_active,
      renamed:
        existing.name_en !== data.name_en || existing.name_ar !== data.name_ar,
    },
  );

  revalidateCategorySurfaces();

  return { ok: true, categoryId: data.category_id };
}

export async function deleteCategoryAction(
  input: unknown,
): Promise<ResourceActionResult> {
  const staff = await requireTeacher();
  const parsed = categoryIdSchema.safeParse(input);

  if (!parsed.success) {
    return fail("validation_failed");
  }

  const categoryId = parsed.data.category_id;
  const existing = await getResourceCategoryById(categoryId);

  if (!existing) {
    return fail("category_not_found");
  }

  const supabase = await createClient();
  const countResult = await supabase
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if (countResult.error) {
    console.error("category resource count failed", countResult.error.message);
  }

  const { error } = await supabase
    .from("resource_categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    console.error("category delete failed", error.message);
    return fail("unknown");
  }

  await logResourceEvent(staff.id, { categoryId }, "category_deleted", {
    name_en: existing.name_en,
    slug: existing.slug,
    resource_count: countResult.count ?? 0,
  });

  revalidateCategorySurfaces();

  return { ok: true, categoryId };
}
