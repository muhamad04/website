import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ImportDraft, ImportFileKind, ImportStatus } from "@/lib/import/types";

export type AssessmentImportRow = {
  id: string;
  created_by: string;
  status: ImportStatus;
  source_file_name: string;
  source_mime_type: string;
  source_size: number;
  source_kind: ImportFileKind;
  answer_file_name: string | null;
  answer_mime_type: string | null;
  answer_size: number | null;
  answer_kind: ImportFileKind | null;
  source_path: string | null;
  answer_path: string | null;
  source_text: string;
  answer_text: string;
  draft: ImportDraft;
  assessment_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

const IMPORT_SELECT = `
  id,
  created_by,
  status,
  source_file_name,
  source_mime_type,
  source_size,
  source_kind,
  answer_file_name,
  answer_mime_type,
  answer_size,
  answer_kind,
  source_path,
  answer_path,
  source_text,
  answer_text,
  draft,
  assessment_id,
  created_at,
  updated_at,
  expires_at
`;

export async function getAssessmentImport(
  id: string,
): Promise<AssessmentImportRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessment_imports")
    .select(IMPORT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("assessment import lookup failed", error.message);
    return null;
  }

  return (data as unknown as AssessmentImportRow | null) ?? null;
}

export async function listRecentImportDrafts(
  limit = 5,
): Promise<AssessmentImportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessment_imports")
    .select(IMPORT_SELECT)
    .eq("status", "draft")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 3, limit));

  if (error) {
    console.error("assessment import list failed", error.message);
    return [];
  }

  // Rows created by the signed-upload init step exist before parsing finishes.
  // Hide them until a real draft is stored.
  return ((data ?? []) as unknown as AssessmentImportRow[])
    .filter((row) => Array.isArray(row.draft?.sections))
    .slice(0, limit);
}
