import { describe, expect, it } from "vitest";
import {
  changeStaffRoleSchema,
  createStaffSchema,
  fieldErrorsFrom,
  setStaffActiveSchema,
  staffAccessRequestSchema,
  updateStaffSchema,
} from "@/lib/validation/staff";

const STAFF_ID = "33000000-0000-4000-8000-000000000001";

const validCreate = {
  full_name_en: "Nora Hassan",
  full_name_ar: "نورة حسن",
  email: "nora@example.com",
  role: "teacher" as const,
  is_active: "true" as const,
};

describe("staff validation", () => {
  it("accepts a complete staff account", () => {
    const result = createStaffSchema.safeParse(validCreate);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("nora@example.com");
      expect(result.data.role).toBe("teacher");
      expect(result.data.is_active).toBe("true");
    }
  });

  it("normalises the email to lower case", () => {
    const result = createStaffSchema.safeParse({
      ...validCreate,
      email: "  Nora@Example.COM  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("nora@example.com");
    }
  });

  it("requires a valid email address", () => {
    const missing = createStaffSchema.safeParse({
      ...validCreate,
      email: "   ",
    });
    const invalid = createStaffSchema.safeParse({
      ...validCreate,
      email: "not-an-email",
    });

    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.message).toBe("email_required");
    }

    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toBe("email_invalid");
    }
  });

  it("requires both names and bounds their length", () => {
    const missing = createStaffSchema.safeParse({
      ...validCreate,
      full_name_en: "   ",
      full_name_ar: "",
    });

    expect(missing.success).toBe(false);
    if (!missing.success) {
      const messages = missing.error.issues.map((issue) => issue.message);
      expect(messages).toContain("name_required");
    }

    const tooLong = createStaffSchema.safeParse({
      ...validCreate,
      full_name_en: "x".repeat(121),
    });

    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(tooLong.error.issues[0]?.message).toBe("name_too_long");
    }
  });

  it("accepts only teacher or admin roles", () => {
    for (const role of ["teacher", "admin"] as const) {
      expect(createStaffSchema.safeParse({ ...validCreate, role }).success).toBe(
        true,
      );
    }

    const student = createStaffSchema.safeParse({
      ...validCreate,
      role: "student",
    });
    expect(student.success).toBe(false);

    if (!student.success) {
      expect(student.error.issues[0]?.message).toBe("role_invalid");
    }
  });

  it("maps boolean active values and defaults to active", () => {
    const fromBoolean = createStaffSchema.safeParse({
      ...validCreate,
      is_active: false,
    });
    expect(fromBoolean.success).toBe(true);
    if (fromBoolean.success) {
      expect(fromBoolean.data.is_active).toBe("false");
    }

    const withoutStatus = createStaffSchema.safeParse({
      ...validCreate,
      is_active: undefined,
    });
    expect(withoutStatus.success).toBe(true);
    if (withoutStatus.success) {
      expect(withoutStatus.data.is_active).toBe("true");
    }
  });

  it("never accepts a password field into staff input", () => {
    const result = createStaffSchema.safeParse({
      ...validCreate,
      password: "should-not-be-accepted",
      initial_password: "should-not-be-accepted",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect("password" in result.data).toBe(false);
      expect("initial_password" in result.data).toBe(false);
    }
  });

  it("uses a dedicated update schema without role or status", () => {
    const result = updateStaffSchema.safeParse({
      staff_id: STAFF_ID,
      full_name_en: validCreate.full_name_en,
      full_name_ar: validCreate.full_name_ar,
      email: "NORA@example.com",
      role: "admin",
      is_active: "false",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("nora@example.com");
      expect("role" in result.data).toBe(false);
      expect("is_active" in result.data).toBe(false);
    }
  });

  it("validates dedicated role, activation and access requests", () => {
    expect(
      changeStaffRoleSchema.safeParse({ staff_id: STAFF_ID, role: "admin" })
        .success,
    ).toBe(true);
    expect(
      changeStaffRoleSchema.safeParse({ staff_id: STAFF_ID, role: "student" })
        .success,
    ).toBe(false);
    expect(
      setStaffActiveSchema.safeParse({ staff_id: STAFF_ID, is_active: "false" })
        .success,
    ).toBe(true);
    expect(
      staffAccessRequestSchema.safeParse({ staff_id: "not-a-uuid" }).success,
    ).toBe(false);
  });

  it("flattens zod issues into the first stable code per field", () => {
    const result = createStaffSchema.safeParse({
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
