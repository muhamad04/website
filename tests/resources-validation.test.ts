import { describe, expect, it } from "vitest";
import {
  RESOURCE_MAX_FILE_BYTES,
  buildResourceStoragePath,
} from "@/lib/resources/files";
import {
  RESOURCE_ERROR_CODES,
  categoryIdSchema,
  createCategorySchema,
  createResourceSchema,
  fieldErrorsFrom,
  prepareResourceUploadSchema,
  resourceIdSchema,
  setResourcePublishedSchema,
  updateCategorySchema,
  updateResourceSchema,
} from "@/lib/validation/resources";

const GRADE_ID = "11000000-0000-4000-8000-000000000001";
const OTHER_GRADE_ID = "11000000-0000-4000-8000-000000000002";
const CATEGORY_ID = "44000000-0000-4000-8000-000000000001";
const RESOURCE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const pdfPath = buildResourceStoragePath({
  gradeId: GRADE_ID,
  type: "pdf",
  fileName: "Unit 3 Grammar.pdf",
  mimeType: "application/pdf",
  id: RESOURCE_ID,
})!;

const imagePath = buildResourceStoragePath({
  gradeId: GRADE_ID,
  type: "image",
  fileName: "Mind map.png",
  mimeType: "image/png",
  id: RESOURCE_ID,
})!;

const baseMetadata = {
  grade_id: GRADE_ID,
  type: "pdf" as const,
  title_en: "Unit 3 Grammar",
  title_ar: "قواعد الوحدة الثالثة",
  description_en: "Present perfect practice",
  description_ar: "تدريب على المضارع التام",
  sort_order: "2",
  is_published: "true",
};

function messages(result: {
  success: boolean;
  error?: { issues: ReadonlyArray<{ message: string }> };
}): string[] {
  return result.success || !result.error
    ? []
    : result.error.issues.map((issue) => issue.message);
}

describe("resource validation", () => {
  it("accepts a complete PDF resource", () => {
    const result = createResourceSchema.safeParse({
      ...baseMetadata,
      storage_path: pdfPath,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.storage_path).toBe(pdfPath);
      expect(result.data.sort_order).toBe(2);
      expect(result.data.is_published).toBe(true);
      expect(result.data.category_id).toBeUndefined();
    }
  });

  it("normalises booleans, blank optionals and empty order values", () => {
    const result = createResourceSchema.safeParse({
      ...baseMetadata,
      category_id: "",
      description_en: "   ",
      sort_order: "",
      is_published: "false",
      storage_path: pdfPath,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category_id).toBeUndefined();
      expect(result.data.description_en).toBeUndefined();
      expect(result.data.sort_order).toBe(0);
      expect(result.data.is_published).toBe(false);
    }
  });

  it("requires bilingual titles and a real grade", () => {
    const result = createResourceSchema.safeParse({
      ...baseMetadata,
      grade_id: "not-a-uuid",
      title_en: "",
      title_ar: " ",
      storage_path: pdfPath,
    });

    expect(messages(result)).toEqual(
      expect.arrayContaining([
        "grade_required",
        "title_required",
        "title_required",
      ]),
    );
  });

  it("requires a storage path for PDFs and images", () => {
    const result = createResourceSchema.safeParse(baseMetadata);

    expect(messages(result)).toContain("file_required");
    if (!result.success) {
      expect(fieldErrorsFrom(result.error.issues).storage_path).toBe(
        "file_required",
      );
    }
  });

  it("rejects a storage path that belongs to another grade or type", () => {
    const wrongGrade = createResourceSchema.safeParse({
      ...baseMetadata,
      storage_path: pdfPath.replace(GRADE_ID, OTHER_GRADE_ID),
    });
    const wrongType = createResourceSchema.safeParse({
      ...baseMetadata,
      storage_path: imagePath,
    });

    expect(messages(wrongGrade)).toContain("file_name_invalid");
    expect(messages(wrongType)).toContain("file_name_invalid");
  });

  it("rejects a file URL for a YouTube resource", () => {
    const result = createResourceSchema.safeParse({
      ...baseMetadata,
      type: "youtube",
      youtube_url: "https://youtu.be/dQw4w9WgXcQ",
      storage_path: pdfPath,
    });

    expect(messages(result)).toContain("validation_failed");
  });

  it("requires and validates a YouTube link", () => {
    const missing = createResourceSchema.safeParse({
      ...baseMetadata,
      type: "youtube",
    });
    const invalid = createResourceSchema.safeParse({
      ...baseMetadata,
      type: "youtube",
      youtube_url: "https://example.com/video",
    });
    const valid = createResourceSchema.safeParse({
      ...baseMetadata,
      type: "youtube",
      youtube_url: "https://youtu.be/dQw4w9WgXcQ",
    });

    expect(messages(missing)).toContain("youtube_url_required");
    expect(messages(invalid)).toContain("youtube_url_invalid");
    expect(valid.success).toBe(true);
  });

  it("accepts only the three known resource types", () => {
    const result = createResourceSchema.safeParse({
      ...baseMetadata,
      type: "video",
      storage_path: pdfPath,
    });

    expect(result.success).toBe(false);
  });

  it("validates upload metadata before issuing a signed URL", () => {
    const valid = prepareResourceUploadSchema.safeParse({
      ...baseMetadata,
      file_name: "Unit 3.pdf",
      file_size: 1024,
      mime_type: "application/pdf",
    });
    const oversized = prepareResourceUploadSchema.safeParse({
      ...baseMetadata,
      file_name: "Unit 3.pdf",
      file_size: RESOURCE_MAX_FILE_BYTES + 1,
      mime_type: "application/pdf",
    });
    const wrongMime = prepareResourceUploadSchema.safeParse({
      ...baseMetadata,
      type: "image",
      file_name: "photo.gif",
      file_size: 1024,
      mime_type: "image/gif",
    });
    const empty = prepareResourceUploadSchema.safeParse({
      ...baseMetadata,
      file_name: "Unit 3.pdf",
      file_size: 0,
      mime_type: "application/pdf",
    });

    expect(valid.success).toBe(true);
    expect(messages(oversized)).toContain("file_too_large");
    expect(messages(wrongMime)).toContain("file_type_invalid");
    expect(messages(empty)).toContain("file_empty");
  });

  it("never prepares an upload for a YouTube resource", () => {
    const result = prepareResourceUploadSchema.safeParse({
      ...baseMetadata,
      type: "youtube",
      file_name: "clip.mp4",
      file_size: 1024,
      mime_type: "video/mp4",
    });

    expect(messages(result)).toContain("type_invalid");
  });

  it("requires a resource id and a supported publish value", () => {
    expect(
      updateResourceSchema.safeParse({ ...baseMetadata, resource_id: "nope" })
        .success,
    ).toBe(false);
    expect(resourceIdSchema.safeParse({ resource_id: RESOURCE_ID }).success).toBe(
      true,
    );
    expect(
      setResourcePublishedSchema.safeParse({
        resource_id: RESOURCE_ID,
        is_published: "yes",
      }).success,
    ).toBe(false);
    expect(
      setResourcePublishedSchema.safeParse({
        resource_id: RESOURCE_ID,
        is_published: "false",
      }).success,
    ).toBe(true);
  });

  it("accepts a category without an explicit slug", () => {
    const result = createCategorySchema.safeParse({
      name_en: "Grammar",
      name_ar: "القواعد",
      slug: "",
      description_en: "",
      sort_order: "",
      is_active: "true",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBeUndefined();
      expect(result.data.sort_order).toBe(0);
      expect(result.data.is_active).toBe(true);
    }
  });

  it("slugifies a provided category slug and rejects unusable ones", () => {
    const normalised = createCategorySchema.safeParse({
      name_en: "Reading Skills",
      name_ar: "مهارات القراءة",
      slug: " Reading Skills! ",
    });
    const arabicOnly = createCategorySchema.safeParse({
      name_en: "Writing",
      name_ar: "الكتابة",
      slug: "!!!",
    });

    expect(normalised.success).toBe(true);
    if (normalised.success) {
      expect(normalised.data.slug).toBe("reading-skills");
    }

    expect(messages(arabicOnly)).toContain("slug_invalid");
  });

  it("requires bilingual category names and a real category id", () => {
    const missingNames = createCategorySchema.safeParse({
      name_en: "",
      name_ar: "",
    });
    const badId = updateCategorySchema.safeParse({
      name_en: "Grammar",
      name_ar: "القواعد",
      category_id: "not-a-uuid",
    });

    expect(messages(missingNames)).toEqual(
      expect.arrayContaining(["category_name_required"]),
    );
    expect(badId.success).toBe(false);
    expect(categoryIdSchema.safeParse({ category_id: CATEGORY_ID }).success).toBe(
      true,
    );
  });

  it("exposes a stable, unique list of error codes", () => {
    expect(new Set(RESOURCE_ERROR_CODES).size).toBe(
      RESOURCE_ERROR_CODES.length,
    );
    expect(RESOURCE_ERROR_CODES).toContain("upload_failed");
    expect(RESOURCE_ERROR_CODES).toContain("slug_taken");
  });
});
