import { z } from "zod";
import type { ResourceType } from "@/lib/domain/types";
import {
  RESOURCE_MAX_FILE_BYTES,
  isAllowedMimeForType,
  isResourceStoragePathFor,
  isStoredResourceType,
} from "@/lib/resources/files";
import { parseYouTubeInput } from "@/lib/resources/youtube";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/validation/fields";
import { slugify } from "@/lib/slug";

/**
 * Stable resource error codes. Provider wording never reaches the browser;
 * the UI maps these codes to bilingual sentences.
 */
export const RESOURCE_ERROR_CODES = [
  "validation_failed",
  "title_required",
  "title_too_long",
  "description_too_long",
  "grade_required",
  "grade_not_found",
  "category_not_found",
  "type_invalid",
  "youtube_url_required",
  "youtube_url_invalid",
  "file_required",
  "file_name_invalid",
  "file_type_invalid",
  "file_too_large",
  "file_empty",
  "upload_failed",
  "upload_missing",
  "upload_conflict",
  "storage_failed",
  "service_unavailable",
  "not_found",
  "type_immutable",
  "slug_invalid",
  "slug_taken",
  "category_name_required",
  "category_name_too_long",
  "forbidden",
  "unknown",
] as const;

export type ResourceErrorCode = (typeof RESOURCE_ERROR_CODES)[number];

export type ResourceActionResult = {
  ok: boolean;
  error?: ResourceErrorCode;
  fieldErrors?: FieldErrors;
  resourceId?: string;
  categoryId?: string;
  /** Short-lived signed upload details. Never logged or persisted. */
  upload?: {
    bucket: string;
    path: string;
    token: string;
  };
};

const optionalText = (max: number, error: string = "description_too_long") =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(max, { error }).optional(),
  );

const optionalUuid = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.uuid({ error: "validation_failed" }).optional(),
);

const sortOrder = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? 0 : value),
  z.coerce.number().int().min(0).max(999).default(0),
);

const booleanValue = z.preprocess(
  (value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  },
  z.boolean().default(false),
);

const resourceBaseSchema = z.object({
  grade_id: z.uuid({ error: "grade_required" }),
  category_id: optionalUuid,
  type: z.enum(["pdf", "image", "youtube"], { error: "type_invalid" }),
  title_en: z
    .string()
    .trim()
    .min(1, { error: "title_required" })
    .max(160, { error: "title_too_long" }),
  title_ar: z
    .string()
    .trim()
    .min(1, { error: "title_required" })
    .max(160, { error: "title_too_long" }),
  description_en: optionalText(2000),
  description_ar: optionalText(2000),
  sort_order: sortOrder,
  is_published: booleanValue,
});

export const resourceMetadataSchema = resourceBaseSchema;
export type ResourceMetadataInput = z.infer<typeof resourceMetadataSchema>;

function requireYouTubeUrl(
  value: { type: ResourceType; youtube_url?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (value.type !== "youtube") {
    return;
  }

  if (!value.youtube_url) {
    ctx.addIssue({
      code: "custom",
      path: ["youtube_url"],
      message: "youtube_url_required",
    });
    return;
  }

  if (!parseYouTubeInput(value.youtube_url)) {
    ctx.addIssue({
      code: "custom",
      path: ["youtube_url"],
      message: "youtube_url_invalid",
    });
  }
}

export const prepareResourceUploadSchema = resourceBaseSchema
  .extend({
    file_name: z
      .string()
      .trim()
      .min(1, { error: "file_required" })
      .max(240, { error: "file_name_invalid" }),
    file_size: z.coerce
      .number()
      .int()
      .min(1, { error: "file_empty" })
      .max(RESOURCE_MAX_FILE_BYTES, { error: "file_too_large" }),
    mime_type: z
      .string()
      .trim()
      .min(1, { error: "file_type_invalid" })
      .max(120, { error: "file_type_invalid" }),
  })
  .superRefine((value, ctx) => {
    if (!isStoredResourceType(value.type)) {
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: "type_invalid",
      });
      return;
    }

    if (!isAllowedMimeForType(value.type, value.mime_type)) {
      ctx.addIssue({
        code: "custom",
        path: ["mime_type"],
        message: "file_type_invalid",
      });
    }
  });

export type PrepareResourceUploadInput = z.infer<
  typeof prepareResourceUploadSchema
>;

export const createResourceSchema = resourceBaseSchema
  .extend({
    youtube_url: optionalText(500),
    storage_path: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.type === "youtube") {
      requireYouTubeUrl(value, ctx);

      if (value.storage_path) {
        ctx.addIssue({
          code: "custom",
          path: ["storage_path"],
          message: "validation_failed",
        });
      }

      return;
    }

    if (!value.storage_path) {
      ctx.addIssue({
        code: "custom",
        path: ["storage_path"],
        message: "file_required",
      });
      return;
    }

    if (value.youtube_url) {
      ctx.addIssue({
        code: "custom",
        path: ["youtube_url"],
        message: "validation_failed",
      });
    }

    if (
      !isStoredResourceType(value.type) ||
      !isResourceStoragePathFor(
        value.storage_path,
        value.grade_id,
        value.type,
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["storage_path"],
        message: "file_name_invalid",
      });
    }
  });

export type CreateResourceInput = z.infer<typeof createResourceSchema>;

export const updateResourceSchema = resourceBaseSchema
  .extend({
    resource_id: z.uuid({ error: "validation_failed" }),
    youtube_url: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.type === "youtube") {
      requireYouTubeUrl(value, ctx);
    }
  });

export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

export const resourceIdSchema = z.object({
  resource_id: z.uuid({ error: "validation_failed" }),
});

export const setResourcePublishedSchema = z.object({
  resource_id: z.uuid({ error: "validation_failed" }),
  is_published: z.enum(["true", "false"]),
});

const categoryBaseSchema = z.object({
  name_en: z
    .string()
    .trim()
    .min(1, { error: "category_name_required" })
    .max(80, { error: "category_name_too_long" }),
  name_ar: z
    .string()
    .trim()
    .min(1, { error: "category_name_required" })
    .max(80, { error: "category_name_too_long" }),
  slug: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : slugify(String(value), 60),
    z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{2,60}$/, { error: "slug_invalid" })
      .optional(),
  ),
  description_en: optionalText(300),
  description_ar: optionalText(300),
  sort_order: sortOrder,
  is_active: booleanValue,
});

export const createCategorySchema = categoryBaseSchema;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = categoryBaseSchema.extend({
  category_id: z.uuid({ error: "validation_failed" }),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categoryIdSchema = z.object({
  category_id: z.uuid({ error: "validation_failed" }),
});

export { fieldErrorsFrom };
export type { FieldErrors };
