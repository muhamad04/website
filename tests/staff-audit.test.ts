import { describe, expect, it } from "vitest";
import { sanitiseStaffAuditDetail } from "@/lib/staff/audit-detail";

describe("staff audit metadata", () => {
  it("keeps safe, flat metadata", () => {
    expect(
      sanitiseStaffAuditDetail({
        role: "admin",
        previous_role: "teacher",
        is_active: false,
        email_changed: true,
        setup_issued: true,
      }),
    ).toEqual({
      role: "admin",
      previous_role: "teacher",
      is_active: false,
      email_changed: true,
      setup_issued: true,
    });
  });

  it("removes passwords, tokens, keys and access links", () => {
    const detail = sanitiseStaffAuditDetail({
      role: "teacher",
      password: "secret",
      initial_password: "secret",
      token: "token",
      access_token: "token",
      access_url: "https://example.test/recovery",
      recovery_link: "https://example.test/recovery",
      setup_link: "https://example.test/recovery",
      service_role_key: "service",
      private_key: "private",
      api_key: "api",
      url: "https://example.test",
      nested: { password: "secret" },
    });

    expect(detail).toEqual({ role: "teacher" });
  });

  it("drops invalid keys and non-scalar values", () => {
    const detail = sanitiseStaffAuditDetail({
      "Not A Key": true,
      "role": "admin",
      nested: { role: "admin" },
      list: ["admin"],
      count: 3,
    });

    expect(detail).toEqual({ role: "admin", count: 3 });
  });

  it("caps string values and the number of keys", () => {
    const long = sanitiseStaffAuditDetail({ role: "x".repeat(250) });
    expect(String(long.role)).toHaveLength(200);

    const many: Record<string, unknown> = {};
    for (let index = 0; index < 30; index += 1) {
      many[`key_${index}`] = true;
    }
    expect(Object.keys(sanitiseStaffAuditDetail(many))).toHaveLength(20);
  });

  it("returns an empty object for empty input", () => {
    expect(sanitiseStaffAuditDetail({})).toEqual({});
  });
});
