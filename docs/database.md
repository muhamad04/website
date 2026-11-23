# Database and access control · قاعدة البيانات والصلاحيات

The schema lives in `supabase/migrations/` and is applied in filename order.

| Migration | Contents |
| --------- | -------- |
| `20261112091000_schema.sql` | Enums, 14 tables, constraints, indexes, updated-at triggers, auth user trigger |
| `20261112091100_rls.sql` | Access helper functions, RLS policies, attempt/answer integrity triggers |
| `20261112091200_storage.sql` | Private storage buckets and storage RLS |
| `20261112091300_student_payload.sql` | Sanitized assessment read function for students |
| `20261114090000_student_administration.sql` | Provisioning timestamps, grade-scoped student-number uniqueness, audit log, profile privilege guard |
| `20261114120000_resource_management.sql` | Resource audit log, storage-path grade/type guard, browsing indexes |
| `20261115090000_assessment_system.sql` | Assessment audit log, in-progress-only student attempt reads, stricter answer file paths, six assessment RPCs |
| `20261115100000_assessment_hardening.sql` | Idempotent finalization, manual-review unblocking, atomic section/question reorder RPCs |
| `20261115110000_assessment_flow_fixes.sql` | Enum casts in finalize/grade RPCs, security-definer answer helpers and policies |
| `20261115120000_assessment_cascade_fixes.sql` | Integrity triggers trust identity-less cascade updates so staff accounts can be deleted after grading |
| `20261116090000_reporting.sql` | Reporting settings, Google Sheets sync ledger, reporting audit log |
| `20261116110000_student_identity.sql` | Student ID login identity: optional contact email, generated normalised Student ID, global uniqueness, format/required checks, audit actions |
| `20261116120000_student_identity_trigger_fix.sql` | Auth trigger tolerates GoTrue applying `app_metadata` after insert; provisioning owns the explicit profile upsert |
| `20261116130000_student_identity_trigger_guard_fix.sql` | Explicit NULL handling so the auth trigger never inserts a NULL role |
| `20261116140000_staff_management.sql` | Staff audit log, admin-only RLS and the last-admin / self-protection trigger |
| `20261116150000_assessment_import.sql` | Private assessment-import staging table, owner/path guard trigger, private `assessment-imports` bucket and four import audit actions |
| `20261119120000_strict_exam_mode.sql` | Strict exam settings, submission reasons, heartbeat/suspicious-event counters, stale-attempt sweep, seeded question/option randomisation and the `attempt_auto_submitted` audit action |
| `20261123120000_assessment_import_50mb.sql` | Raises the private `assessment-imports` bucket limit to 50 MiB and pins the allowed import MIME types. No table, policy or auth changes; apply only with explicit approval |

## Tables

| Table | Purpose |
| ----- | ------- |
| `profiles` | One row per Auth user; role, Student ID, grade, class, active status, optional contact email |
| `grades` | Grade 10, Grade 11, etc. (bilingual names, sort order) |
| `classes` | Classes inside a grade; composite `(id, grade_id)` key |
| `resource_categories` | Grammar, Reading, Listening, etc. |
| `resources` | PDFs, images and YouTube links by grade/category |
| `assessments` | Quiz/exam metadata, timer, retake rules, grading mode, strict-mode settings |
| `assessment_sections` | Ordered sections within an assessment |
| `questions` | All eight question types, marks, prompt, answer key |
| `question_options` | Multiple-choice / true-false options |
| `matching_pairs` | Matching left/right items with an opaque `right_key` |
| `attempts` | One row per student attempt, with server-set timer fields, heartbeat time, submission reason and suspicious-event counters |
| `answers` | Structured student responses and marks |
| `manual_grades` | Reviewer score and feedback for manually graded answers |
| `google_sheet_sync_logs` | Idempotency ledger: one row per attempt |
| `reporting_settings` | One non-secret row: sync on/off, mock mode, sheet tab |
| `reporting_admin_events` | Append-only audit trail for reporting sync, retries and settings |
| `student_admin_events` | Append-only audit trail for teacher student administration |
| `resource_admin_events` | Append-only audit trail for resource and category management |
| `assessment_admin_events` | Append-only audit trail for assessment authoring, publishing and grading |
| `staff_admin_events` | Append-only audit trail for staff creation, edits, role changes, activation and access resets |
| `assessment_imports` | Private, owner-scoped staging rows for uploaded question/answer files and the parsed draft before an assessment is created |

All primary keys are UUIDs. All mutable tables have `created_at` / `updated_at`
with an automatic updated-at trigger. Foreign keys use `restrict`, `cascade` or
`set null` deliberately — for example, attempts restrict deletion of an
assessment, while sections/questions/options cascade with their parent.

### Notable constraints

- `resources`: PDF/image resources require `storage_path`; YouTube requires
  `external_url`, never both. Storage paths are unique. PDF/image paths must
  start with `<grade_id>/<pdf|image>/` and end in a single file name, enforced by
  `resources_storage_path_grade_type_check` so a forged or stale path is rejected
  even through the REST API.
- `profiles`: `(class_id, grade_id)` references `classes(id, grade_id)`, so a
  student cannot be placed in a class from another grade.
- `assessments`: retakes and `max_attempts` must agree (1 attempt when retakes
  are off; 2–10 when enabled). Availability windows must be ordered.
  `heartbeat_timeout_seconds` is limited to 15–600. `strict_exam_mode` and
  `allow_resume_after_connection_loss` default from the type (exams strict,
  quizzes optional) through a `BEFORE INSERT/UPDATE` trigger.
- `attempts`: unique `(assessment_id, student_id, attempt_number)` prevents
  duplicate attempts; `expires_at > started_at`; submissions cannot predate the
  start. `submission_reason` is a seven-value enum, and the suspicious-event
  counters cannot go negative. Students may not change the reason, heartbeat or
  counters directly; only the heartbeat RPC (which checks ownership and state)
  and trusted service-role finalisation can write them.
- `answers`: unique `(attempt_id, question_id)` prevents duplicate answers.
- `manual_grades`: one grade per answer; `score <= max_score`.
- `google_sheet_sync_logs.attempt_id` is unique, which makes retries idempotent.
  Only teachers/admins can read the ledger; every write uses the service role.
- `reporting_settings` is a singleton (`id = 1`) with `sync_enabled`,
  `mock_mode` and a 1–100 character `sheet_name`. There is no insert or delete
  policy: the row is seeded by the migration and only updated by an admin.
- `reporting_admin_events`: action is constrained to manual sync, retry,
  settings update and connectivity check; `actor_id` must equal `auth.uid()` and
  the row has no update or delete policy.
- `profiles`: `lower(username)` is unique when present. Students sign in with
  `student_number`, which is required for every student row, format-checked
  (2–40 letters, digits, dots, dashes or underscores) and globally unique via a
  generated `student_number_normalized` column (`lower(btrim(student_number))`).
  Student IDs may not be blank. Contact `email` is optional for students and a
  check constraint rejects any `@accounts.internal` value, so the private Auth
  identifier can never be stored there.
- `student_admin_events`: action is constrained to the known administration
  actions; the row has no update or delete policy.
- `resource_admin_events`: action is constrained to the known resource/category
  actions; `resource_id`/`category_id` deliberately have no foreign key so the
  history survives deletion. The row has no update or delete policy.
- `assessment_admin_events`: action is constrained to the known assessment
  actions; `assessment_id` deliberately has no foreign key so the history
  survives deletion. Actor attribution must equal `auth.uid()`; the row has no
  update or delete policy.
- `staff_admin_events`: action is constrained to `created`, `updated`,
  `role_changed`, `activated`, `deactivated` and `access_reset`. `detail` holds a
  sanitised, flat metadata object — never passwords, tokens, setup links or keys.
  `staff_id` cascades with the profile, `actor_id` is set to null if the actor is
  deleted, actor attribution must equal `auth.uid()` and the row has no update or
  delete policy.
- `assessment_imports`: `status` is limited to `draft`, `saved` or `cancelled`;
  `source_kind`/`answer_kind` to `docx`, `pdf` or `txt`; sizes cannot be
  negative. `created_by` cascades with the profile and `assessment_id` is set to
  null if the saved assessment is deleted. `expires_at` defaults to 24 hours and
  temporary `source_text`/`answer_text` are cleared when the import is saved or
  cancelled. Students have no policy on the table at all.

## Access helper functions

All helpers are `security definer` with `search_path = public` to avoid recursive
RLS checks on `profiles`:

| Function | Meaning |
| -------- | ------- |
| `current_profile_role()` | Active caller's role, or null |
| `is_teacher()` | Caller is an active `teacher` or `admin` |
| `is_admin()` | Caller is an active `admin` |
| `current_grade_id()` | Active student's grade, or null |
| `is_active_user()` | Caller has an active profile |
| `is_privileged()` | Teacher/admin **or** service-role request |
| `get_student_assessment_payload(uuid, text)` | Grade-checked, answer-key-free assessment JSON; the optional seed gives a stable question/option order |
| `student_can_write_answer(uuid, uuid)` | Caller owns an open attempt that contains the question |
| `student_owns_open_attempt(uuid)` | Caller owns the attempt and it is `in_progress` |
| `student_can_read_answers(uuid)` | Own open attempt, or submitted results when `results_visibility` allows them |

Assessment RPCs (all `security definer`; `anon` is revoked):

| Function | Caller | Purpose |
| -------- | ------ | ------- |
| `student_assessment_overview()` | Student | Published assessments for the caller's grade with attempt counts, strict settings and a visibility-gated result summary |
| `student_start_attempt(uuid)` | Student | Validate grade/publication/window/retakes/create or resume the timed attempt; refuses an attempt whose heartbeat went stale |
| `student_attempt_payload(uuid)` | Student | Sanitized assessment + saved answers, only while `in_progress` |
| `student_attempt_result(uuid)` | Student | Ownership- and visibility-gated result; returns `visible = false` without score, answers or feedback when hidden |
| `attempt_heartbeat(uuid, boolean, boolean)` | Student (owner) | Record a server heartbeat and suspicious-event counts; returns `stale` when the timeout was missed instead of reviving the attempt |
| `finalize_attempt(uuid, jsonb, attempt_submission_reason)` | Service role / staff | Apply trusted automatic marks, record the submission reason, append an audit event for automatic closes, idempotent once closed |
| `finalize_stale_attempts(integer)` | Service role / staff | Return expired or heartbeat-stale attempts for idempotent finalisation |
| `teacher_grade_attempt(uuid, jsonb)` | Teacher/admin | Save manual marks and bilingual feedback, then recompute the attempt score |
| `reorder_assessment_sections(uuid, uuid[])` | Teacher/admin | Atomic section reorder |
| `reorder_section_questions(uuid, uuid[])` | Teacher/admin | Atomic question reorder |

## Strict Exam Mode

Strict mode is a server-authoritative policy, not a client trick:

- `assessments.strict_exam_mode` defaults to true for exams and false for
  quizzes. `submit_on_tab_hidden`, `submit_on_navigation` and
  `allow_resume_after_connection_loss` decide which signals close an attempt;
  `heartbeat_timeout_seconds` decides when a silent browser counts as gone.
- The browser only reports `visibilitychange`, `pagehide`, `beforeunload`,
  `offline`, focus loss and in-app navigation. The signal route
  (`/api/student/attempts/[attemptId]/signal`) authenticates the student, proves
  ownership, re-reads the settings and only then finalises through
  `finalize_attempt`.
- A heartbeat is stored server-side. When a strict attempt without connection-loss
  resume misses its timeout, `attempt_heartbeat` reports `stale`,
  `student_start_attempt` refuses to resume it and
  `finalize_stale_attempts` returns it for idempotent finalisation.
- The maintenance endpoint `GET /api/assessments/sweep` runs the sweep for
  manual or external schedulers. Set the optional `CRON_SECRET` and call it with
  `Authorization: Bearer <secret>`; without a secret it requires a signed-in
  teacher/admin. Vercel Hobby has no minute-level cron, so student and teacher
  pages also sweep lazily with a short throttle.
- Every closed attempt stores one of `student_submitted`, `time_expired`,
  `left_assessment`, `tab_hidden`, `page_unloaded`, `heartbeat_expired` or
  `connection_lost`. Automatic closes append one `attempt_auto_submitted` audit
  row with the attempt, student and reason — never question or answer content.
- Strict mode cannot stop a student from using a second device; the UI and docs
  say so explicitly. Answer keys and hidden results remain protected exactly as
  before.

## RLS matrix

`✓` = allowed, `—` = denied, `own` = only the caller's row(s).

| Table | Teacher / admin | Student |
| ----- | --------------- | ------- |
| `profiles` | Full CRUD | Read `own` |
| `grades` | Full CRUD | Read own assigned grade |
| `classes` | Full CRUD | Read classes in own grade |
| `resource_categories` | Full CRUD | Read active categories |
| `resources` | Full CRUD | Read published rows for own grade |
| `assessments` | Full CRUD | Read published rows for own grade |
| `assessment_sections` | Full CRUD | — (use RPC) |
| `questions` | Full CRUD | — (use RPC) |
| `question_options` | Full CRUD | — (use RPC) |
| `matching_pairs` | Full CRUD | — (use RPC) |
| `attempts` | Full CRUD | Read `own` while `in_progress`; insert/update `own` while in progress or submitting. Post-submission reads use the result RPC |
| `answers` | Full CRUD | Read `own` while in progress, then only when `results_visibility` allows; insert/update `own` while in progress through the answer helper |
| `manual_grades` | Full CRUD | Read `own` after grading when results are not hidden |
| `google_sheet_sync_logs` | Read | — |
| `reporting_settings` | Admin read/update | — |
| `reporting_admin_events` | Read and append `own actor_id` | — |
| `student_admin_events` | Read and append `own actor_id` | — |
| `resource_admin_events` | Read and append `own actor_id` | — |
| `assessment_admin_events` | Read and append `own actor_id` | — |
| `staff_admin_events` | Admin read and append `own actor_id`; teachers denied | — |
| `assessment_imports` | Read/insert/update/delete `own`; admins read/manage all | — |
| `storage.objects` (`resources`) | Full CRUD | Read files linked to a published resource in own grade |
| `storage.objects` (`assessment-submissions`) | Full CRUD | Read/insert only under `<own uuid>/…` |
| `storage.objects` (`assessment-imports`) | Full CRUD under `<own uuid>/…`; admins all folders | — |

### Direct writes by students

Students may create their own attempt row only for a published assessment for
their grade, starting `in_progress`. The `protect_attempt_integrity` trigger then
overrides:

- `student_id`, `status`, `started_at` and `expires_at` (expiry is computed from
  the assessment's time limit on the server);
- score fields, grading fields and manual-review status.

On update, students can only move from `in_progress` to `submitted` (or keep
saving), cannot change the assessment/attempt number/timer, and cannot set
scores. `submitted_at` is set by the trigger. A second submission raises an
error, and any direct student write after `expires_at` raises `attempt_expired`.
The server actions finalise expired attempts with the service-role client
through `finalize_attempt`, which is idempotent for an already-closed attempt.

Attempt creation also enforces the assessment's `allow_retakes` and
`max_attempts` values, rejects a second simultaneous `in_progress` attempt, and
assigns `attempt_number` from the stored maximum. These checks run in the
trigger, so calling the REST API directly cannot bypass them.

`protect_answer_integrity` similarly nulls grading fields on student insert and
preserves them on update, prevents moving an answer to another
attempt/question, and rejects answer writes when the parent attempt is not in
progress or the timer has expired.

Service-role requests bypass RLS and are recognised as privileged by these
triggers, so trusted grading jobs can write scores. Never expose that key to a
browser. Automatic marks are computed in the server-only
`src/lib/assessments/grading.ts` and applied by `finalize_attempt`; the browser
never supplies marks for automatic questions.

Answer policies call `student_can_write_answer` / `student_owns_open_attempt`
rather than joining `questions` and `assessment_sections` directly, because
those tables are teacher-only and a direct join can never be satisfied by a
student. The same helpers keep the write rules identical for the server actions
and the REST API.

Both integrity triggers treat an update with no end-user identity
(`auth.uid()` is null) as trusted. That is what allows the
`on delete set null` cascades from `profiles.graded_by` / `actor_id` to run
when a staff account is deleted; without it, deleting a teacher who had graded
work failed. Direct browser writes always carry the student's `auth.uid()`, so
every student rule is unchanged, and RLS still blocks anonymous or foreign
callers before a trigger can run.

## Attempt lifecycle and result visibility

1. `student_start_attempt` checks the assessment is published, belongs to the
   caller's grade, is inside its availability window and has attempts left. It
   returns the existing `in_progress` attempt instead of creating a duplicate.
2. The runner reads `student_attempt_payload`, which only works while the
   attempt is `in_progress`, and saves answers through the user-scoped client.
3. `finalize_attempt` (service role, after computing objective marks server-side)
   sets `submitted_at`, the score, and either `graded` or `grading` when an
   answered manual question still needs a human. It is idempotent.
4. `teacher_grade_attempt` saves manual marks and feedback, then recomputes the
   attempt score and marks the manual review complete.
5. Result reads always go through `student_attempt_result`, gated by
   `results_visibility`:
   - `immediately`: visible for `submitted`, `grading` and `graded`;
   - `after_review`: visible only when `graded`;
   - `hidden`: never returns score, answers or feedback.

Students no longer have direct SELECT access to submitted attempt rows, which
closes the column-level leak on `attempts.score`/`percentage`. Expired attempts
are finalized lazily by the student pages that encounter them; there is no
scheduled job, and every finalization path calls the same idempotent RPC.

## Sanitized student assessment payload

Students cannot query question tables directly because they contain correct
answers. Instead call:

```sql
select public.get_student_assessment_payload('<assessment uuid>');
```

It raises `assessment_not_available` unless the caller is an active student, the
assessment is published for their grade, and the availability window is open. It
returns sections and questions with prompts, marks and options/left/right items
only. `correct_answer`, `question_options.is_correct` and
`matching_pairs.right_key` are not exposed with the left item, so the matching
answer cannot be derived from the payload.

## Reporting and Google Sheets sync

- Attempt finalisation and manual grading schedule `requestAttemptSync` through
  Next.js `after()`. The worker uses the service-role client, so it runs after
  the response and cannot fail the student's submission.
- `google_sheet_sync_logs` stores one row per attempt, the frozen 18-column
  payload and the sheet row reference. A regrade compares payloads and updates
  the same row; column A is searched for the submission ID before any write.
- `reporting_settings` is read by the worker and by `/teacher/reporting`.
  Credentials never enter the database: they stay in server environment
  variables and the admin page only renders booleans.
- `reporting_admin_events` records manual sync, retry, settings changes and
  connectivity checks. Admin reads/updates of `reporting_settings` and the
  admin-only page are enforced by `public.is_admin()`.

## Storage conventions

```text
resources/<grade_id>/<pdf|image>/<uuid>-<filename>
assessment-submissions/<student_id>/<attempt_id>/<uuid>-<filename>
assessment-imports/<owner_id>/<import_id>/<questions|answers>-<filename>
```

Resource file names are normalised to lowercase ASCII stems, and the grade/type
folder is validated by both the server actions and
`resources_storage_path_grade_type_check`. Moving a resource to another grade
moves its object to the new grade folder before the row is updated.

Allowed MIME types are PDF, JPEG, PNG and WebP. Limits: 25 MB for resources and
20 MB for submissions. Buckets are private. Uploads use a short-lived signed
upload URL issued with the teacher's session; after the browser uploads,
the server re-reads the object's real size and MIME type with the service-role
client before inserting the row. Viewers receive short-lived signed URLs created
with the signed-in user's session, so Storage RLS still applies.

The `assessment-imports` bucket is private and much stricter: only PDF,
`text/plain` and DOCX are allowed. Each file is capped at 50 MiB
(`ASSESSMENT_IMPORT_MAX_BYTES=52428800`) and the bucket enforces the same
backstop through `20261123120000_assessment_import_50mb.sql` (apply with
explicit approval); both the application and Storage reject anything else.
Uploads never pass through a Vercel Function body: the browser asks
`/teacher/assessments/import/upload/init` for short-lived signed upload URLs,
uploads directly, and `/upload/finalize` verifies ownership and the object's
real size before downloading once for parsing. `/upload/abort` removes an
abandoned folder. Objects live under the uploading staff member's UUID, and the
storage policy only permits that folder
(`(storage.foldername(name))[1] = auth.uid()`), with admins allowed to clean any
folder. Students have no access at all.

## Profile privilege guard

`protect_profile_privileges` runs before every `profiles` update. A teacher may
edit student profiles, but only an admin (or a service-role / definer job with no
end-user `auth.uid()`) can:

- change `profiles.role`;
- edit a profile whose current role is `teacher` or `admin`.

Both cases raise `42501`, so a teacher cannot promote a student or demote another
staff member through the REST API even though the Phase 1 policy grants staff
full CRUD on `profiles`. The administration actions never accept a role field.

## Staff privilege guard

`protect_staff_privileges` runs before every `profiles` update, in addition to
the profile guard above, and adds three rules:

- a non-admin can never write a profile whose existing or new role is `teacher`
  or `admin` (defence in depth for the profile guard);
- an admin cannot demote or deactivate their own account
  (`profile_self_admin_change_forbidden`);
- nobody can remove the last active admin: demoting or deactivating an active
  admin fails with `last_admin_protected` when no other active admin remains.

Service-role requests and identity-less definer contexts skip the trigger so
migrations, cascades and staff provisioning keep working. Staff accounts are
created by the server-only provisioning module with the service role; a
single-use recovery link is returned once to the admin and never stored, and the
audit trail records only `setup_issued: true`.

## Assessment import staging

`assessment_imports` exists only between an upload and the reviewed draft. It
stores the extracted text, the parsed draft JSON and the private object paths.

- RLS requires an active teacher/admin role. A teacher can only read, update or
  delete rows where `created_by = auth.uid()`; admins can inspect and clean any
  row. Inserts must set `created_by` to the caller.
- `protect_assessment_import` runs before insert and update. It pins
  `created_by` and `created_at`, refreshes `updated_at`, and raises
  `import_source_path_outside_owner` / `import_answer_path_outside_owner` if a
  storage path's first segment is not the owner's UUID. A forged REST write
  therefore cannot point at another teacher's file.
- Nothing publishes implicitly. The save action inserts the assessment with
  `is_published = false`; publishing still uses the existing explicit action.
- Temporary files are removed when the import is saved or cancelled. A lazy sweep
  deletes expired drafts after 24 hours and saved staging rows after 7 days,
  removing each private object first.
- Import audit uses four extra `assessment_admin_events` actions:
  `import_started`, `import_draft_created`, `import_draft_edited` and
  `import_published`. Their `detail` contains safe metadata only — counts,
  booleans, file name/size, status, AI model and request counts — never question
  text, answers, API keys, headers, passwords or private URLs.
- Optional AI assistance is server-only and off by default. When enabled, the
  route sends question text and choices to OpenRouter, validates the response
  with Zod and stores pending suggestions on the draft. Nothing is applied until
  the teacher accepts it, and AI failures leave the deterministic draft intact.

## Adding a migration

```bash
npx supabase migration new add_my_change
# edit the generated SQL
npm run db:reset   # local apply + seed
npm run db:push    # remote apply (uses --remote) after linking
```

Keep policies close to the tables they protect and add a test or manual check for
each new student read path.
