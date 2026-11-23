import { beforeEach, describe, expect, it, vi } from "vitest";

const TEACHER_ID = "33000000-0000-4000-8000-000000000011";
const OTHER_ID = "33000000-0000-4000-8000-000000000012";
const GRADE_ID = "11000000-0000-4000-8000-000000000001";
const IMPORT_ID = "22000000-0000-4000-8000-000000000001";

const state = vi.hoisted(() => ({
  profile: null as { id: string; role: string; is_active: boolean } | null,
  gradeExists: true,
  row: null as Record<string, unknown> | null,
  inserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  updates: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  deletes: [] as Array<{ table: string; id: string }>,
  removedFolders: [] as string[],
}));

vi.mock("@/lib/auth/dal", () => ({
  getCurrentProfile: async () => state.profile,
}));

vi.mock("@/lib/data/resources", () => ({
  gradeExists: async () => state.gradeExists,
}));

vi.mock("@/lib/data/imports", () => ({
  getAssessmentImport: async () => state.row,
}));

vi.mock("@/lib/import/storage", () => ({
  createImportSignedUpload: async (path: string) => ({
    ok: true,
    upload: { path, token: "token", signedUrl: "https://storage.test/upload" },
  }),
  removeImportFolder: async (userId: string, importId: string) => {
    state.removedFolders.push(`${userId}/${importId}`);
    return true;
  },
  statImportObject: async () => ({
    ok: true,
    stat: { size: 64, contentType: "text/plain" },
  }),
  downloadImportObject: async () => ({
    ok: true,
    bytes: new TextEncoder().encode(
      "Unit 5 Quiz\n1. Choose the correct answer. (1 mark)\nA. cat\nB. dog\n",
    ),
  }),
  removeImportObjects: async () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => ({
      insert: (payload: Record<string, unknown>) => {
        state.inserts.push({ table, payload });
        return { error: null };
      },
      update: (payload: Record<string, unknown>) => {
        state.updates.push({ table, payload });
        return { eq: () => ({ error: null }) };
      },
      delete: () => ({
        eq: (_column: string, id: string) => {
          state.deletes.push({ table, id });
          return { error: null };
        },
      }),
    }),
  }),
}));

import { POST as initPost } from "@/app/(app)/teacher/assessments/import/upload/init/route";
import { POST as finalizePost } from "@/app/(app)/teacher/assessments/import/upload/finalize/route";
import { POST as abortPost } from "@/app/(app)/teacher/assessments/import/upload/abort/route";

function request(body: unknown): Request {
  return new Request("http://localhost/teacher/assessments/import/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const file = {
  role: "questions" as const,
  name: "Conditionals_Quiz.txt",
  size: 64,
  type: "text/plain",
};

beforeEach(() => {
  state.profile = { id: TEACHER_ID, role: "teacher", is_active: true };
  state.gradeExists = true;
  state.row = null;
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
  state.removedFolders = [];
});

describe("signed upload init route", () => {
  it("rejects students", async () => {
    state.profile = { id: TEACHER_ID, role: "student", is_active: true };

    const response = await initPost(
      request({ grade_id: GRADE_ID, type: "quiz", files: [file] }),
    );

    expect(response.status).toBe(403);
    expect(state.inserts).toHaveLength(0);
  });

  it("rejects an oversized file with 413", async () => {
    const response = await initPost(
      request({
        grade_id: GRADE_ID,
        type: "quiz",
        files: [{ ...file, size: 50 * 1024 * 1024 + 1 }],
      }),
    );

    expect(response.status).toBe(413);
    expect(state.inserts).toHaveLength(0);
  });

  it("rejects an executable name before creating a signed URL", async () => {
    const response = await initPost(
      request({
        grade_id: GRADE_ID,
        type: "quiz",
        files: [{ ...file, name: "quiz.exe" }],
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "file_name_invalid",
    });
  });

  it("registers an owner-scoped row and returns signed uploads", async () => {
    const response = await initPost(
      request({ grade_id: GRADE_ID, type: "quiz", files: [file] }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      importId: string;
      uploads: Array<{ path: string; role: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.uploads).toHaveLength(1);
    expect(body.uploads[0].path.startsWith(`${TEACHER_ID}/`)).toBe(true);
    const staging = state.inserts.filter(
      (insert) => insert.table === "assessment_imports",
    );
    expect(staging).toHaveLength(1);
    expect(staging[0].payload.created_by).toBe(TEACHER_ID);
    expect(staging[0].payload.status).toBe("draft");
  });
});

describe("signed upload finalize route", () => {
  it("rejects students", async () => {
    state.profile = { id: TEACHER_ID, role: "student", is_active: true };

    const response = await finalizePost(
      request({ import_id: IMPORT_ID, grade_id: GRADE_ID, files: [file] }),
    );

    expect(response.status).toBe(403);
  });

  it("rejects a row owned by another teacher", async () => {
    state.row = {
      id: IMPORT_ID,
      created_by: OTHER_ID,
      status: "draft",
      source_file_name: file.name,
      source_mime_type: file.type,
      source_size: file.size,
      source_kind: "txt",
      answer_file_name: null,
      answer_mime_type: null,
      answer_size: null,
      answer_kind: null,
      source_path: `${OTHER_ID}/${IMPORT_ID}/questions-Conditionals_Quiz.txt`,
      answer_path: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      draft: {},
    };

    const response = await finalizePost(
      request({ import_id: IMPORT_ID, grade_id: GRADE_ID, files: [file] }),
    );

    expect(response.status).toBe(404);
    expect(state.updates).toHaveLength(0);
  });

  it("parses only after verifying the owner path", async () => {
    const path = `${TEACHER_ID}/${IMPORT_ID}/questions-Conditionals_Quiz.txt`;
    state.row = {
      id: IMPORT_ID,
      created_by: TEACHER_ID,
      status: "draft",
      source_file_name: file.name,
      source_mime_type: file.type,
      source_size: file.size,
      source_kind: "txt",
      answer_file_name: null,
      answer_mime_type: null,
      answer_size: null,
      answer_kind: null,
      source_path: path,
      answer_path: null,
      source_text: "",
      answer_text: "",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      draft: {},
    };

    const response = await finalizePost(
      request({ import_id: IMPORT_ID, grade_id: GRADE_ID, files: [file] }),
    );
    const body = (await response.json()) as { ok: boolean; importId: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(state.updates).toHaveLength(1);
    const draft = state.updates[0].payload.draft as {
      stats: { questionCount: number };
    };
    expect(draft.stats.questionCount).toBe(1);
  });

  it("refuses a stored path outside the owner folder", async () => {
    state.row = {
      id: IMPORT_ID,
      created_by: TEACHER_ID,
      status: "draft",
      source_file_name: file.name,
      source_mime_type: file.type,
      source_size: file.size,
      source_kind: "txt",
      answer_file_name: null,
      answer_mime_type: null,
      answer_size: null,
      answer_kind: null,
      source_path: `${OTHER_ID}/${IMPORT_ID}/questions-Conditionals_Quiz.txt`,
      answer_path: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      draft: {},
    };

    const response = await finalizePost(
      request({ import_id: IMPORT_ID, grade_id: GRADE_ID, files: [file] }),
    );

    expect(response.status).toBe(403);
    expect(state.updates).toHaveLength(0);
    expect(state.removedFolders).toContain(`${TEACHER_ID}/${IMPORT_ID}`);
  });
});

describe("signed upload abort route", () => {
  it("refuses to delete another teacher's row", async () => {
    state.row = { id: IMPORT_ID, created_by: OTHER_ID, status: "draft" };

    const response = await abortPost(request({ import_id: IMPORT_ID }));

    expect(response.status).toBe(404);
    expect(state.deletes).toHaveLength(0);
  });
});
