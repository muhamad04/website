import { describe, expect, it } from "vitest";
import {
  NEW_PASSWORD_MAX_LENGTH,
  NEW_PASSWORD_MIN_LENGTH,
  isStrongNewPassword,
  newPasswordIssue,
} from "@/lib/validation/password";
import {
  createStudentSchema,
  setPasswordSchema,
} from "@/lib/validation/students";

const GRADE_ID = "11000000-0000-4000-8000-000000000001";
const CLASS_ID = "22000000-0000-4000-8000-000000000001";

describe("new-password policy", () => {
  it("requires a password", () => {
    expect(newPasswordIssue("")).toBe("password_required");
  });

  it("requires at least ten characters", () => {
    expect(newPasswordIssue("short")).toBe("password_short");
    expect(
      newPasswordIssue("a".repeat(NEW_PASSWORD_MIN_LENGTH - 1)),
    ).toBe("password_short");
  });

  it("rejects an over-long password", () => {
    expect(
      newPasswordIssue("a".repeat(NEW_PASSWORD_MAX_LENGTH + 1)),
    ).toBe("password_too_long");
  });

  it("rejects repeated characters and keyboard sequences", () => {
    expect(newPasswordIssue("aaaaaaaaaaaa")).toBe("password_weak");
    expect(newPasswordIssue("abcdefghij")).toBe("password_weak");
    expect(newPasswordIssue("qwertyuiop")).toBe("password_weak");
    expect(newPasswordIssue("1234567890")).toBe("password_weak");
  });

  it("rejects common passwords regardless of case", () => {
    expect(newPasswordIssue("Password123")).toBe("password_weak");
    expect(newPasswordIssue("student123")).toBe("password_weak");
  });

  it("accepts a long, non-obvious password", () => {
    expect(newPasswordIssue("correct horse battery staple")).toBeNull();
    expect(newPasswordIssue("G10-Sara-2026!")).toBeNull();
    expect(isStrongNewPassword("correct horse battery staple")).toBe(true);
  });

  it("applies the policy to a password reset", () => {
    const short = setPasswordSchema.safeParse({
      password: "short",
      confirm_password: "short",
    });
    const weak = setPasswordSchema.safeParse({
      password: "password123",
      confirm_password: "password123",
    });
    const strong = setPasswordSchema.safeParse({
      password: "correct horse battery staple",
      confirm_password: "correct horse battery staple",
    });

    expect(short.success).toBe(false);
    if (!short.success) {
      expect(short.error.issues[0]?.message).toBe("password_short");
    }

    expect(weak.success).toBe(false);
    if (!weak.success) {
      expect(weak.error.issues[0]?.message).toBe("password_weak");
    }

    expect(strong.success).toBe(true);
  });

  it("applies the policy to a teacher-set initial password", () => {
    const base = {
      full_name_en: "Sara Ahmed",
      full_name_ar: "سارة أحمد",
      email: "sara@example.com",
      username: "sara.ahmed",
      student_number: "S-001",
      grade_id: GRADE_ID,
      class_id: CLASS_ID,
      password_mode: "set" as const,
    };

    const weak = createStudentSchema.safeParse({
      ...base,
      initial_password: "password123",
    });
    const strong = createStudentSchema.safeParse({
      ...base,
      initial_password: "correct horse battery staple",
    });

    expect(weak.success).toBe(false);
    if (!weak.success) {
      expect(weak.error.issues[0]?.message).toBe("password_weak");
    }

    expect(strong.success).toBe(true);
  });
});
