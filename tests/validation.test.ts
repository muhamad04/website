import { describe, expect, it } from "vitest";
import {
  loginSchema,
  staffLoginSchema,
  studentLoginSchema,
} from "@/lib/validation/auth";

describe("login validation", () => {
  it("accepts a staff email and password", () => {
    const result = loginSchema.safeParse({
      mode: "staff",
      email: "teacher@example.com",
      password: "Teacher123!",
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.mode !== "student") {
      expect(result.data.email).toBe("teacher@example.com");
    }
  });

  it("keeps legacy email-only staff input valid", () => {
    const result = loginSchema.safeParse({
      email: "teacher@example.com",
      password: "Teacher123!",
    });

    expect(result.success).toBe(true);
  });

  it("trims but does not prematurely lower-case a staff email", () => {
    const result = staffLoginSchema.safeParse({
      email: "  Sara@Example.com  ",
      password: "Student123!",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("Sara@Example.com");
    }
  });

  it("accepts a Student ID and password without an email", () => {
    const result = studentLoginSchema.safeParse({
      mode: "student",
      student_id: "  G10-001  ",
      password: "Student123!",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.student_id).toBe("G10-001");
    }
  });

  it("rejects an invalid Student ID with a stable message code", () => {
    const result = studentLoginSchema.safeParse({
      mode: "student",
      student_id: "G10 001",
      password: "Student123!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("student_id_invalid");
    }
  });

  it("rejects a missing Student ID or password", () => {
    const missingId = studentLoginSchema.safeParse({
      mode: "student",
      student_id: "",
      password: "Student123!",
    });
    const missingPassword = studentLoginSchema.safeParse({
      mode: "student",
      student_id: "G10-001",
      password: "",
    });

    expect(missingId.success).toBe(false);
    if (!missingId.success) {
      expect(missingId.error.issues[0]?.message).toBe("student_id_required");
    }

    expect(missingPassword.success).toBe(false);
    if (!missingPassword.success) {
      expect(missingPassword.error.issues[0]?.message).toBe("password_required");
    }
  });

  it("rejects an invalid staff email with a stable message code", () => {
    const result = staffLoginSchema.safeParse({
      email: "not-an-email",
      password: "Student123!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("email_invalid");
    }
  });

  it("rejects a short password with a stable message code", () => {
    const result = staffLoginSchema.safeParse({
      email: "sara@example.com",
      password: "123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("password_short");
    }
  });

  it("rejects missing staff fields", () => {
    const result = staffLoginSchema.safeParse({ email: "", password: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("email_required");
      expect(messages).toContain("password_required");
    }
  });
});
