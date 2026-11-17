import { describe, expect, it } from "vitest";
import { ui } from "@/lib/i18n/dictionary";
import {
  passwordErrorCopy,
  studentErrorCopy,
  studentEventCopy,
  studentsUi,
} from "@/lib/i18n/students";
import { authErrorCopy, validationMessageCopy } from "@/lib/i18n/messages";
import {
  resourceErrorCopy,
  resourceEventCopy,
  resourceStatusCopy,
  resourceTypeCopy,
  resourcesUi,
} from "@/lib/i18n/resources";
import {
  AUTH_ERROR_CODES,
} from "@/lib/validation/auth";
import {
  PASSWORD_ERROR_CODES,
  STUDENT_ERROR_CODES,
} from "@/lib/validation/students";
import { RESOURCE_ERROR_CODES } from "@/lib/validation/resources";

type Bilingual = { en: string; ar: string };

function collectBilingual(value: unknown, path = ""): Array<[string, Bilingual]> {
  if (
    value &&
    typeof value === "object" &&
    "en" in value &&
    "ar" in value &&
    typeof (value as Bilingual).en === "string" &&
    typeof (value as Bilingual).ar === "string"
  ) {
    return [[path, value as Bilingual]];
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      collectBilingual(child, path ? `${path}.${key}` : key),
    );
  }

  return [];
}

describe("bilingual copy", () => {
  it("provides non-empty English and Arabic labels for every UI string", () => {
    const entries = collectBilingual(ui);
    expect(entries.length).toBeGreaterThan(30);

    for (const [path, copy] of entries) {
      expect(copy.en.trim(), `${path}.en`).not.toBe("");
      expect(copy.ar.trim(), `${path}.ar`).not.toBe("");
      // Arabic labels must contain Arabic script, not accidental English copy.
      expect(copy.ar, `${path}.ar`).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("covers every authentication error code", () => {
    for (const code of AUTH_ERROR_CODES) {
      expect(authErrorCopy[code]?.en).toBeTruthy();
      expect(authErrorCopy[code]?.ar).toBeTruthy();
    }
  });

  it("covers every login validation message", () => {
    for (const key of [
      "student_id_required",
      "student_id_invalid",
      "email_required",
      "email_invalid",
      "password_required",
      "password_short",
    ]) {
      expect(validationMessageCopy[key]?.en).toBeTruthy();
      expect(validationMessageCopy[key]?.ar).toBeTruthy();
    }
  });

  it("provides bilingual copy for every student administration string", () => {
    const entries = collectBilingual(studentsUi);
    expect(entries.length).toBeGreaterThan(70);

    for (const [path, copy] of entries) {
      expect(copy.en.trim(), `${path}.en`).not.toBe("");
      expect(copy.ar.trim(), `${path}.ar`).not.toBe("");
      expect(copy.ar, `${path}.ar`).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("covers every student administration error code", () => {
    for (const code of STUDENT_ERROR_CODES) {
      expect(studentErrorCopy[code]?.en).toBeTruthy();
      expect(studentErrorCopy[code]?.ar).toBeTruthy();
      expect(studentErrorCopy[code]?.ar).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("covers every password error code", () => {
    for (const code of PASSWORD_ERROR_CODES) {
      expect(passwordErrorCopy[code]?.en).toBeTruthy();
      expect(passwordErrorCopy[code]?.ar).toBeTruthy();
    }
  });

  it("labels every audit action in both languages", () => {
    for (const action of [
      "created",
      "invited",
      "invite_resent",
      "access_reset",
      "password_reset",
      "student_id_changed",
      "updated",
      "activated",
      "deactivated",
    ] as const) {
      expect(studentEventCopy[action]?.en).toBeTruthy();
      expect(studentEventCopy[action]?.ar).toBeTruthy();
    }
  });

  it("provides bilingual copy for every resource-management string", () => {
    const entries = collectBilingual(resourcesUi);
    expect(entries.length).toBeGreaterThan(80);

    for (const [path, copy] of entries) {
      expect(copy.en.trim(), `${path}.en`).not.toBe("");
      expect(copy.ar.trim(), `${path}.ar`).not.toBe("");
      expect(copy.ar, `${path}.ar`).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("covers every resource error code", () => {
    for (const code of RESOURCE_ERROR_CODES) {
      expect(resourceErrorCopy[code]?.en, `${code}.en`).toBeTruthy();
      expect(resourceErrorCopy[code]?.ar, `${code}.ar`).toBeTruthy();
      expect(resourceErrorCopy[code]?.ar, `${code}.ar`).toMatch(
        /[\u0600-\u06FF]/,
      );
    }
  });

  it("labels every resource audit action in both languages", () => {
    for (const action of [
      "created",
      "updated",
      "published",
      "unpublished",
      "deleted",
      "category_created",
      "category_updated",
      "category_deleted",
    ] as const) {
      expect(resourceEventCopy[action]?.en).toBeTruthy();
      expect(resourceEventCopy[action]?.ar).toBeTruthy();
      expect(resourceEventCopy[action]?.ar).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("labels every resource type and publish state", () => {
    for (const type of ["pdf", "image", "youtube"] as const) {
      expect(resourceTypeCopy[type]?.en).toBeTruthy();
      expect(resourceTypeCopy[type]?.ar).toMatch(/[\u0600-\u06FF]/);
    }

    for (const status of ["published", "draft"] as const) {
      expect(resourceStatusCopy[status]?.en).toBeTruthy();
      expect(resourceStatusCopy[status]?.ar).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
