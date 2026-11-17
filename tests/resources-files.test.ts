import { describe, expect, it } from "vitest";
import {
  RESOURCE_MAX_FILE_BYTES,
  buildResourceStoragePath,
  extensionForMime,
  isAllowedMimeForType,
  isResourceStoragePathFor,
  moveResourceStoragePath,
  parseResourceStoragePath,
  safeFileStem,
} from "@/lib/resources/files";

const GRADE_A = "11000000-0000-4000-8000-000000000001";
const GRADE_B = "11000000-0000-4000-8000-000000000002";
const RESOURCE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("resource file rules", () => {
  it("allows only PDFs for pdf resources", () => {
    expect(isAllowedMimeForType("pdf", "application/pdf")).toBe(true);
    expect(isAllowedMimeForType("pdf", "APPLICATION/PDF")).toBe(true);
    expect(isAllowedMimeForType("pdf", "image/png")).toBe(false);
  });

  it("allows the three supported image types", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      expect(isAllowedMimeForType("image", mime)).toBe(true);
    }

    expect(isAllowedMimeForType("image", "image/gif")).toBe(false);
    expect(isAllowedMimeForType("image", "application/pdf")).toBe(false);
  });

  it("maps MIME types to extensions and rejects unknown ones", () => {
    expect(extensionForMime("application/pdf")).toBe("pdf");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/webp")).toBe("webp");
    expect(extensionForMime("text/html")).toBeNull();
  });

  it("turns any file name into a safe lowercase stem", () => {
    expect(safeFileStem("Unit 3 — Grammar!.pdf")).toBe("unit-3-grammar");
    expect(safeFileStem("  My File (1).PNG")).toBe("my-file-1");
    expect(safeFileStem("ملف.pdf")).toBe("resource");
    expect(safeFileStem("....pdf")).toBe("resource");
    expect(safeFileStem("x".repeat(200) + ".pdf")).toHaveLength(60);
  });

  it("builds paths inside the grade/type folder", () => {
    const path = buildResourceStoragePath({
      gradeId: GRADE_A,
      type: "pdf",
      fileName: "Unit 3 — Grammar!.pdf",
      mimeType: "application/pdf",
      id: RESOURCE_ID,
    });

    expect(path).toBe(`${GRADE_A}/pdf/${RESOURCE_ID}-unit-3-grammar.pdf`);
  });

  it("returns null when the MIME type has no allowed extension", () => {
    expect(
      buildResourceStoragePath({
        gradeId: GRADE_A,
        type: "image",
        fileName: "photo.gif",
        mimeType: "image/gif",
      }),
    ).toBeNull();
  });

  it("parses a generated path back into grade, type and file name", () => {
    const path = `${GRADE_A}/image/${RESOURCE_ID}-class-photo.webp`;
    const parsed = parseResourceStoragePath(path);

    expect(parsed).toEqual({
      gradeId: GRADE_A,
      type: "image",
      fileName: `${RESOURCE_ID}-class-photo.webp`,
    });
  });

  it("rejects malformed, traversal and unknown paths", () => {
    expect(parseResourceStoragePath(null)).toBeNull();
    expect(parseResourceStoragePath("")).toBeNull();
    expect(parseResourceStoragePath("not/a/real/path.pdf")).toBeNull();
    expect(
      parseResourceStoragePath(`${GRADE_A}/pdf/../../secret.pdf`),
    ).toBeNull();
    expect(
      parseResourceStoragePath(`${GRADE_A}/video/${RESOURCE_ID}-clip.mp4`),
    ).toBeNull();
  });

  it("checks that a path belongs to the given grade and type", () => {
    const path = `${GRADE_A}/pdf/${RESOURCE_ID}-notes.pdf`;

    expect(isResourceStoragePathFor(path, GRADE_A, "pdf")).toBe(true);
    expect(isResourceStoragePathFor(path, GRADE_A.toUpperCase(), "pdf")).toBe(
      true,
    );
    expect(isResourceStoragePathFor(path, GRADE_B, "pdf")).toBe(false);
    expect(isResourceStoragePathFor(path, GRADE_A, "image")).toBe(false);
  });

  it("moves a file to a new grade folder without changing its name", () => {
    const path = `${GRADE_A}/pdf/${RESOURCE_ID}-notes.pdf`;

    expect(moveResourceStoragePath(path, GRADE_B)).toBe(
      `${GRADE_B}/pdf/${RESOURCE_ID}-notes.pdf`,
    );
    expect(moveResourceStoragePath("bad/path", GRADE_B)).toBeNull();
  });

  it("keeps the 25 MB limit aligned with the storage bucket", () => {
    expect(RESOURCE_MAX_FILE_BYTES).toBe(25 * 1024 * 1024);
  });
});
