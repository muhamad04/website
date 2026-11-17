import { describe, expect, it } from "vitest";
import {
  accessRequestSchema,
  createStudentSchema,
  fieldErrorsFrom,
  setPasswordSchema,
  updateStudentSchema,
  slugify,
} from "@/lib/validation/students";
import {
  canonicalStudentId,
  isValidStudentId,
  normaliseStudentId,
} from "@/lib/validation/student-id";

const GRADE_ID = "11000000-0000-4000-8000-000000000001";
const CLASS_ID = "22000000-0000-4000-8000-000000000001";
const STUDENT_ID = "33000000-0000-4000-8000-000000000001";

const validCreate = {
  full_name_en: "Sara Ahmed",
  full_name_ar: "سارة أحمد",
  email: "sara@example.com",
  username: "sara.ahmed",
  student_number: "S-001",
  grade_id: GRADE_ID,
  class_id: CLASS_ID,
  password_mode: "link" as const,
  initial_password: "",
};

describe("student validation", () => {
  it("accepts a complete student", () => {
    const result = createStudentSchema.safeParse(validCreate);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.grade_id).toBe(GRADE_ID);
      expect(result.data.password_mode).toBe("link");
      expect(result.data.email).toBe("sara@example.com");
    }
  });

  it("defaults the access mode to a one-time setup link", () => {
    const withoutMode = { ...validCreate, password_mode: undefined };
    const result = createStudentSchema.safeParse(withoutMode);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password_mode).toBe("link");
    }
  });

  it("accepts a student without an email", () => {
    const result = createStudentSchema.safeParse({
      ...validCreate,
      email: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
    }
  });

  it("treats a blank username as absent and keeps required fields strict", () => {
    const result = createStudentSchema.safeParse({
      ...validCreate,
      username: "no spaces allowed",
      grade_id: "",
      class_id: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("username_invalid");
      expect(messages).toContain("grade_required");
      expect(messages).toContain("class_required");
    }

    const withoutUsername = createStudentSchema.safeParse({
      ...validCreate,
      username: "",
    });

    expect(withoutUsername.success).toBe(true);
    if (withoutUsername.success) {
      expect(withoutUsername.data.username).toBeUndefined();
    }
  });

  it("rejects missing names and a bad email with stable codes", () => {
    const result = createStudentSchema.safeParse({
      ...validCreate,
      full_name_en: "   ",
      full_name_ar: "",
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("name_required");
      expect(messages).toContain("email_invalid");
    }
  });

  it("requires a Student ID and rejects unsafe formats", () => {
    const missing = createStudentSchema.safeParse({
      ...validCreate,
      student_number: "   ",
    });

    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.message).toBe("student_id_required");
    }

    for (const value of [
      "a",
      "a b",
      ".abc",
      "abc.",
      "a..b",
      "A/B",
      "x".repeat(41),
    ]) {
      const result = createStudentSchema.safeParse({
        ...validCreate,
        student_number: value,
      });

      expect(result.success, value).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("student_id_invalid");
      }
    }
  });

  it("canonicalises a trimmed Student ID without losing its display case", () => {
    const result = createStudentSchema.safeParse({
      ...validCreate,
      student_number: "  G10-001  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.student_number).toBe("G10-001");
    }

    expect(canonicalStudentId("  g10-001  ")).toBe("g10-001");
    expect(normaliseStudentId("  G10-001  ")).toBe("g10-001");
    expect(isValidStudentId("G10-001")).toBe(true);
    expect(isValidStudentId("G10..001")).toBe(false);
    expect(isValidStudentId("-G10")).toBe(false);
  });

  it("requires an initial password only when the teacher sets one", () => {
    const missing = createStudentSchema.safeParse({
      ...validCreate,
      password_mode: "set",
      initial_password: "",
    });

    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.message).toBe("password_required");
    }

    const short = createStudentSchema.safeParse({
      ...validCreate,
      password_mode: "set",
      initial_password: "short",
    });

    expect(short.success).toBe(false);
    if (!short.success) {
      expect(short.error.issues[0]?.message).toBe("password_short");
    }

    const valid = createStudentSchema.safeParse({
      ...validCreate,
      password_mode: "set",
      initial_password: "longenough",
    });

    expect(valid.success).toBe(true);
  });

  it("requires a real uuid for updates and access requests", () => {
    const update = updateStudentSchema.safeParse({
      ...validCreate,
      student_id: "not-a-uuid",
    });
    const access = accessRequestSchema.safeParse({ student_id: "nope" });

    expect(update.success).toBe(false);
    expect(access.success).toBe(false);
  });

  it("accepts an update without the create-only password fields", () => {
    const result = updateStudentSchema.safeParse({
      student_id: STUDENT_ID,
      full_name_en: validCreate.full_name_en,
      full_name_ar: validCreate.full_name_ar,
      email: "",
      username: validCreate.username,
      student_number: validCreate.student_number,
      grade_id: validCreate.grade_id,
      class_id: validCreate.class_id,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
      expect(result.data.student_number).toBe("S-001");
    }
  });

  it("matches both passwords and enforces eight characters", () => {
    const mismatch = setPasswordSchema.safeParse({
      password: "longenough",
      confirm_password: "different",
    });
    const short = setPasswordSchema.safeParse({
      password: "short",
      confirm_password: "short",
    });
    const valid = setPasswordSchema.safeParse({
      password: "longenough",
      confirm_password: "longenough",
    });

    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0]?.message).toBe("password_mismatch");
    }

    expect(short.success).toBe(false);
    if (!short.success) {
      expect(short.error.issues[0]?.message).toBe("password_short");
    }

    expect(valid.success).toBe(true);
  });

  it("slugifies English grade names", () => {
    expect(slugify("Grade 10 A!")).toBe("grade-10-a");
    expect(slugify("  --Grade 11--  ")).toBe("grade-11");
    expect(slugify("الصف العاشر")).toBe("");
  });

  it("flattens zod issues into field errors, keeping the first", () => {
    const result = createStudentSchema.safeParse({
      ...validCreate,
      full_name_en: "",
      email: "x",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrorsFrom(result.error.issues);
      expect(errors.full_name_en).toBe("name_required");
      expect(errors.email).toBe("email_invalid");
    }
  });
});
