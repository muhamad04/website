import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ASSESSMENT_MAX_FILE_BYTES } from "@/lib/assessments/files";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261126120000_security_hardening.sql",
  ),
  "utf8",
);

describe("security hardening migration", () => {
  it("blocks direct student attempt writes", () => {
    expect(sql).toMatch(
      /drop policy if exists attempts_student_update_own on public\.attempts/i,
    );
    expect(sql).toMatch(
      /create trigger attempts_block_status_forgery[\s\S]*before update on public\.attempts/i,
    );
    expect(sql).toContain("attempt_already_submitted");
    expect(sql).toContain("attempt_direct_write_forbidden");
    expect(sql).toMatch(
      /new\.last_heartbeat_at is distinct from old\.last_heartbeat_at/i,
    );
  });

  it("enforces strict heartbeat staleness in the database", () => {
    expect(sql).toMatch(
      /create or replace function public\.student_owns_open_attempt[\s\S]*?last_heartbeat_at[\s\S]*?heartbeat_timeout_seconds/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.student_can_write_answer[\s\S]*last_heartbeat_at/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.protect_answer_integrity[\s\S]*raise exception 'attempt_stale'/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.student_attempt_payload[\s\S]*raise exception 'attempt_stale'/i,
    );
  });

  it("requires an owned open attempt for a submission upload", () => {
    expect(sql).toMatch(
      /drop policy if exists storage_submissions_student_insert on storage\.objects/i,
    );
    expect(sql).toMatch(
      /create policy storage_submissions_student_insert on storage\.objects[\s\S]*a\.status = 'in_progress'[\s\S]*a\.expires_at > now\(\)/i,
    );
  });

  it("aligns the bucket limit with the application constant", () => {
    expect(ASSESSMENT_MAX_FILE_BYTES).toBe(25 * 1024 * 1024);
    expect(sql).toContain(`file_size_limit = ${ASSESSMENT_MAX_FILE_BYTES}`);
  });

  it("keeps the login throttle service-role only", () => {
    expect(sql).toContain("login_throttle_retry_after");
    expect(sql).toContain("login_throttle_record");
    expect(sql).toMatch(
      /revoke all on table public\.login_throttle_events from public, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.login_throttle_retry_after[\s\S]*to service_role/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.login_throttle_record[\s\S]*to service_role/i,
    );
  });
});
