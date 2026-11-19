# English Hub · منصة الإنجليزية

A bilingual (English / Arabic) teaching-resources and assessment platform for an
English teacher in Egypt. Teachers organise resources by grade, build quizzes and
exams, and review results. Students sign in with accounts created for them and
only ever see their own grade, their own attempts and their own results.

> **Current status: Phase 4 (reporting and Google Sheets sync).** On top of
> Phase 3 assessment delivery, teachers get live dashboards, a filterable
> results table with CSV export, and an admin-only Google Sheets integration
> with idempotent sync, retries and an audit trail. Students get a dashboard
> limited to their own grade, own attempts and only the results their teacher
> has made visible.

---

## What works in Phase 1

- Supabase password authentication with cookie-based server sessions. Students
  sign in with a globally unique **Student ID**; teachers/admins keep email login.
- Teacher/admin and student roles, enforced in the data-access layer and in
  PostgreSQL row-level security — not only in the UI.
- Grade-aware profiles, classes, and database-level isolation of grades.
- Complete schema for resources, assessments, questions, attempts, answers,
  manual grades and Google Sheets sync logs.
- Private `resources` and `assessment-submissions` storage buckets with policies.
- Sanitized student assessment payload function that never exposes answer keys.
- Bilingual UI foundation: both languages visible together, Arabic marked
  `lang="ar" dir="rtl"`, responsive layouts, accessible focus states and skip link.
- Bilingual login, teacher dashboard, student dashboard, loading, empty and error
  states.
- Seed data: one teacher, two grades, two classes, three YouTube resources and a
  sample quiz with four question types.
- Unit tests, TypeScript checking, linting and a production build.

## What works in Phase 2 — student administration

- `/teacher/students`: bilingual searchable list with grade, class and status
  filters, shareable GET URLs, pagination, desktop table and mobile cards.
- `/teacher/students/new` and `/teacher/students/[id]`: create and edit a
  student's English name, Arabic name, Student ID, grade, class and optional
  contact email in one form.
- Account provisioning through the service-role API: an email-confirmed account
  whose private Supabase Auth address is derived from the Student ID
  (`student-<normalised-id>@accounts.internal`), with either a teacher-set
  initial password or an unguessable random one plus a one-time setup link
  (`/auth/callback?token_hash=…&type=recovery&next=/set-password`). The link is
  shown once in the UI and is never emailed to students.
- `/set-password`: recovery-link screen where the student chooses their password
  (minimum 8 characters).
- Activate / deactivate, reset access and re-send invite actions on both the list
  and the profile page.
- Every administration action is written to the append-only
  `student_admin_events` table and shown as a bilingual activity timeline.
- `/teacher/classes`: create grades (bilingual name, slug, order) and classes
  (grade, bilingual name, academic year) without touching SQL.
- Student IDs are globally unique, not merely unique inside a grade; usernames
  are unique across accounts; a class must belong to the student's grade
  (composite foreign key).
- A trigger blocks teachers from changing any role or editing staff profiles;
  the administration actions never accept a role field at all.

## What works in Phase 2b — teaching resources

- `/teacher/resources`: bilingual resource library with search (titles and
  descriptions), grade, category, type and draft/published filters, shareable
  GET URLs and pagination.
- `/teacher/resources/new`: PDF, image or YouTube resource with bilingual title
  and description, grade, optional category, order and publish state.
- Direct-to-Storage uploads: the server validates metadata and returns a
  short-lived signed upload URL; the browser uploads the file, then the server
  re-checks the stored object's real size and MIME type before inserting the row.
  This avoids Server Action body limits while keeping 25 MB PDFs possible.
- `/teacher/resources/[id]`: preview, details, publish/unpublish and delete,
  plus a bilingual audit timeline from `resource_admin_events`.
- `/teacher/resources/[id]/edit`: edit titles, descriptions, category, grade,
  order and publish state. Changing grade moves the private object to the new
  grade folder; the type and file are immutable by design.
- `/teacher/resources/categories`: create, edit, activate/deactivate and delete
  bilingual categories. Deleting a category keeps its resources and marks them
  uncategorized.
- `/student/resources` and `/student/resources/[id]`: published resources for
  the student's own grade only. The grade always comes from the profile, never
  the URL, and the queries add explicit grade/published filters on top of RLS.
- Private viewing only: PDFs are embedded without the viewer toolbar, images are
  display-only, YouTube uses the privacy-enhanced `youtube-nocookie.com` player,
  and no download button is shown. Files are served through short-lived signed
  URLs created with the signed-in user's session.
- Every resource and category action is written to the append-only
  `resource_admin_events` table (no signed URLs or upload tokens are recorded).

## What works in Phase 3 — assessments

- `/teacher/assessments`: bilingual list of quizzes and exams with search,
  grade/type/status filters, pagination, publish state, retake policy and a
  per-assessment results link.
- `/teacher/assessments/new` and `/teacher/assessments/[id]/edit`: bilingual
  title and instructions, grade, quiz/exam type, 1–600 minute limit, results
  visibility (`immediately`, `after_review`, `hidden`), grading mode
  (`automatic`, `manual`, `mixed`), retakes (exams default to none), an optional
  availability window and Strict Exam Mode settings.
- Strict Exam Mode (on by default for exams, optional for quizzes): leaving the
  page, switching tabs, hiding the window or closing the page can submit the
  attempt automatically; a configurable 15–600 second server heartbeat closes
  attempts whose browser stopped reporting. Every attempt stores a submission
  reason, and teachers see the reason plus tab-hidden/focus-loss counts in
  results and the CSV export. Automatic closes append an
  `attempt_auto_submitted` audit event. The pre-start confirmation states the
  rules, and the UI/docs state clearly that this cannot prevent every kind of
  cheating (a student may use another device).
- Strict options also include deterministic per-attempt question and MCQ option
  randomisation, copy/paste blocking and a disabled context menu while the
  runner is open. Focus loss is counted but never submits on its own, so
  accessibility tools and keyboard navigation are not blocked.
- `/api/assessments/sweep` runs the idempotent stale-attempt sweep for a
  scheduler (`CRON_SECRET` bearer token) or a signed-in teacher; student pages
  also sweep lazily, so a crashed browser is closed even without a cron.
- `/teacher/assessments/[id]`: builder with sections (create, rename,
  reorder, delete) and questions (create, edit, reorder, delete) plus the
  append-only assessment activity timeline.
- Eight question types: multiple choice, true/false, matching, short answer,
  essay, file upload, rewrite and find-the-mistake. Each question has bilingual
  prompts, marks and an optional bilingual explanation/help text.
- Answer keys and automatic grading live server-side only:
  `finalize_attempt` receives pre-computed marks from a server-only module, and
  no key or explanation is ever included in the student runner or result
  payloads.
- `/teacher/assessments/[id]/results`: every attempt with status, score,
  percentage, submission time, submission reason, suspicious-event counts and
  manual-review state.
- `/teacher/assessments/[id]/results/[attemptId]`: manual grading for essay,
  file-upload and manual questions, with marks and bilingual feedback.
- `/student/assessments`: only published assessments for the profile's grade,
  type/completed filters, retake counts and result-availability badges.
- `/student/assessments/[id]`: rules, timer, availability and retake status
  before starting, plus a confirmation screen that lists the time limit, allowed
  attempts, whether leaving submits the attempt and when results appear.
  Starting creates a server-timed attempt; resuming reuses the open one.
- `/student/assessments/[id]/attempt/[attemptId]`: timed runner with autosaved
  answers, file uploads to `assessment-submissions`, a live countdown, an
  automatic submit at zero and strict-mode signals plus heartbeat.
- `/student/assessments/[id]/attempt/[attemptId]/result`: visible results with
  per-question marks, feedback and submitted files; hidden results never expose
  the score, answers or feedback.
- Server-side enforcement: retakes, availability, grade, timer expiry, heartbeat
  staleness and attempt ownership are checked in SQL functions and integrity
  triggers, not in the browser. Autosave writes are cut off the moment the timer
  expires or the attempt is submitted, including automatic submission.
- Every authoring, publish, grading and automatic-submission action is written
  to the append-only `assessment_admin_events` table.

## What works in Phase 4 — reporting and Google Sheets

- `/teacher`: live totals for active students (overall, by grade and by class),
  resources (published/unpublished), quizzes and exams, attempts, average score
  and pending manual grading, plus recent activity and recent results.
- Shared filters on the teacher dashboard and results page: grade, class,
  student, assessment, quiz/exam, date range and grading status. Filters are
  plain shareable GET URLs and are re-validated on every request.
- `/teacher/results`: paginated attempts table (student name and ID, grade and
  class, assessment title and type, submission time and reason, suspicious-event
  counts, score and percentage, grading state, result visibility, manual-review
  state, detail link) with a responsive card layout on small screens.
- `/teacher/results/export`: teacher-only CSV export that reuses the current
  filters, includes the submission reason and suspicious-event counts, handles
  RFC 4180 quoting, neutralises spreadsheet formula injection and caps the export
  at 5,000 rows.
- `/student`: grade and class, published resources and assessments for the
  student's own grade, completed/pending/in-progress counts, visible scores
  only, pending manual review, teacher feedback and recent activity. Hidden
  results contribute no score, average or feedback.
- `/teacher/reporting` (admin only): sync on/off, mock mode and sheet-tab name,
  credential *status* (booleans only), a read-only connectivity check, one-click
  retry of failed rows, the sync log and the append-only reporting audit log.
- Google Sheets sync runs through `after()` after finalisation and after manual
  grading, so a Google outage can never fail or delay a submission. One log row
  per attempt (`attempt_id` unique), a stored payload snapshot for idempotency,
  and a column-A submission-ID lookup so retries update instead of duplicating.
- The 18-column row contains submission/student/grade/class/assessment metadata,
  times, scores, status and a short feedback summary. Essay responses, answer
  keys and uploaded file paths are never included.
- Reporting settings and actions are admin-only; students cannot read sync logs,
  reporting settings or the reporting audit log even through the API. Manual
  sync, retry, settings changes and connectivity checks are audited with the
  actor id enforced by RLS.

## What works in Phase 5 — staff management

- `/teacher/staff` (admin only): paginated staff list with search and role/status
  filters, plus a recent-activity panel. Teachers and students are redirected;
  the server actions repeat the admin check and never trust a browser role.
- Create a teacher or admin with English and Arabic names, email, role and active
  status. Passwords are never collected: the server writes an unguessable random
  password and returns a single-use Supabase recovery link once, so the new
  staff member chooses their own password at `/set-password`.
- `/teacher/staff/[id]`: edit names and email, change the role, activate or
  deactivate, and issue a fresh one-time access link. Email changes update the
  Auth identity first and roll it back if the profile write fails.
- Role changes, activation and access resets are separate audited actions. The
  database trigger blocks self-demotion, self-deactivation and removing the last
  active admin (`last_admin_protected`), even through the REST API.
- `staff_admin_events` records actor, target, action, timestamp and sanitised
  metadata (`role`, `previous_role`, `is_active`, `email_changed`,
  `name_changed`, `setup_issued`). Passwords, tokens, recovery links and keys are
  stripped by an allowlist sanitiser and never stored.
- Public registration remains disabled, the existing admin account is untouched,
  and student login/recovery continues to use Student ID only.

## What works in Phase 6 — free, local assessment import

- `/teacher/assessments/import`: upload a typed question paper (DOCX, text-based
  PDF or `.txt`) and an optional answer key. The importer also accepts pasted
  text. Teachers and admins only; students are redirected and every server action
  repeats the staff check.
- Parsing runs entirely on this server with free libraries — `mammoth` for DOCX
  and `unpdf` (PDF.js) for PDF text. There is no OpenAI/Gemini/Claude/OCR call,
  no per-use service and no file content leaves the machine. Image-only/scanned
  PDFs are rejected instead of being guessed at.
- The parser detects sections, numbered questions, lettered or numbered choices,
  marks, instructions, explanations and the eight supported question types.
  Uncertain types become reviewable drafts with warnings and a manual type
  selector; nothing is silently invented.
- Answer keys such as `1. B`, `2. True`, `3. played`, `1-b, 2-a` and accepted-answer
  lists are parsed and matched by question number. Unmatched, duplicate and
  ambiguous keys are reported, never assigned silently. Questions with no
  reliable key default to manual grading, and every key stays editable.
- `/teacher/assessments/import/[id]`: bilingual review editor. Edit settings,
  warnings and answer keys; add, delete and reorder sections, questions, choices
  and matching pairs. “Save review progress” keeps the staging row for 24 hours;
  “Save draft assessment” writes a real assessment with `is_published = false`
  into the existing assessment system.
- Importing never publishes. The draft has to be reviewed and published through
  the existing explicit publish action, which also writes the `import_published`
  audit event.
- Privacy and file safety: the `assessment-imports` bucket is private, files are
  stored under `<owner uuid>/<import id>/…`, extension/MIME/magic bytes are
  checked, limits are 4 MB per file, 8 MB per request and 200,000 extracted
  characters, and temporary files are deleted on save/cancel plus a lazy cleanup
  sweep. Arabic content that the source file does not contain is left empty — it
  is never machine-translated.
- `assessment_imports` is staff-only and owner-scoped through RLS; an owner/path
  trigger keeps `created_by` immutable and every object inside the owner's
  folder. Audit details contain counts and booleans only — no question text,
  answers, file names or private URLs.

## Stack

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, TypeScript, Turbopack)                |
| Styling   | Tailwind CSS 4 + small shadcn-style primitives (`src/components/ui`) |
| Auth/DB   | Supabase Auth + PostgreSQL + Storage                          |
| Validation| Zod 4 + React Hook Form                                       |
| Icons     | Lucide                                                        |
| Tests     | Vitest                                                        |
| Deploy    | Vercel                                                        |

No payments, chat, attendance, lesson planning or subscriptions are included.

---

## Project structure

```text
src/
  app/
    (app)/                  authenticated shell (header + footer)
      teacher/              teacher dashboard
        students/           student list, create, edit, access actions
        classes/            grade and class setup
        resources/          resource library, uploads, categories, audit
        assessments/        assessment builder, results and manual grading
        assessments/import/ free local DOCX/PDF/text import + draft review
        results/            paginated results table and CSV export
        reporting/          admin-only Google Sheets settings, logs and retries
        staff/              admin-only staff list, create, edit and audit history
      student/              student dashboard
        resources/          published grade-scoped resource list and viewer
        assessments/        grade-scoped assessment list, timed attempts, results
    account-pending/        signed in, profile/grade not ready
    account-disabled/       deactivated account
    auth/callback/          one-time recovery / password setup callback
    login/                  bilingual sign-in page + client form
    set-password/           recovery-link password screen
    layout.tsx              root layout, fonts and metadata
    page.tsx                role-aware redirect
  components/
    bilingual.tsx           Bi + Ar bilingual text primitives
    form-field.tsx          label + control + hint + bilingual error
    dashboard/              stat cards
    reporting/              shared report filters and attempts table
    layout/                 header, footer, auth shell, setup notice
    assessments/            assessment form, builder, runner, import review and grading form
    resources/              resource card, filters and private viewer
    ui/                     button, input, select, card, alert, badge…
  lib/
    auth/                   DAL, server actions, safe redirects
    assessments/            grading, answer sanitising, files, storage, filters
    data/                   dashboard, student, resource, assessment and audit queries
    domain/                 role and entity types
    i18n/                   bilingual dictionary, student/resource/assessment copy, messages
    import/                 local extraction, parser, validation, save, storage, retention, audit
    resources/              file rules, storage helpers and YouTube parsing
    reporting/              filters, CSV, sheet payload, idempotency, Google client, sync, audit
    students/               provisioning (service role), filters, formatting
    supabase/               browser, server, admin clients + proxy session
    validation/             Zod schemas and error codes
  proxy.ts                  Next.js 16 proxy (session refresh + auth redirects)
supabase/
  migrations/               schema, RLS, storage, payload, identity and phases 2–6
  seed.sql                  local demo data
  config.toml               local Supabase configuration
scripts/                    hosted assessment + reporting RLS verification
tests/                      Vitest unit tests
docs/                       database security and Google Sheets setup
```

---

## Local development

### Prerequisites

- Node.js 20+ (Node 24 recommended) and npm.
- Docker Desktop (Supabase runs locally in containers).
- The project uses `npx supabase`, so no global CLI install is required.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Start Supabase:

```bash
npx supabase start
```

The CLI prints the API URL, publishable (anon) key and service-role key. Put
those values in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable/anon key>
SUPABASE_SERVICE_ROLE_KEY=<local service-role key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The code also accepts the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` name as a
fallback.

`npx supabase status` prints the same values again. Never commit `.env.local`.

### 3. Apply migrations and seed data

```bash
npm run db:reset
```

This recreates the local database, applies all sixteen migrations, and runs
`supabase/seed.sql`.

### 4. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>. Without Supabase credentials the app renders a
bilingual setup notice instead of crashing.

### Demo accounts (local seed only)

| Role              | Sign-in                       | Password      | Grade    |
| ----------------- | ----------------------------- | ------------- | -------- |
| Teacher           | `teacher@example.com` (email) | `Teacher123!` | —        |
| Student (active)  | Student ID `G10-001`          | `Student123!` | Grade 10 |
| Student (active)  | Student ID `G11-001`          | `Student123!` | Grade 11 |
| Student (inactive)| Student ID `G10-002`          | `Student123!` | Grade 10 |

Students type their Student ID, never an email. The seed's student Auth users
use the private `student-<normalised-id>@accounts.internal` addresses; their
`contact_email` (`sara@example.com`, …) is optional contact data only.

Public sign-up is disabled in `supabase/config.toml`. Accounts are created by the
teacher, which is why the seed inserts users directly and marks their emails
confirmed.

### Useful commands

| Command               | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `npm run dev`         | Start the Next.js dev server                       |
| `npm run build`       | Production build                                   |
| `npm run typecheck`   | `tsc --noEmit`                                     |
| `npm run lint`        | ESLint                                             |
| `npm test`            | Vitest unit tests                                  |
| `npm run verify:rls:hosted` | Hosted assessment RLS/RPC/storage checks (uses `.env.local`) |
| `npm run db:start`    | Start local Supabase                               |
| `npm run db:stop`     | Stop local Supabase                                |
| `npm run db:reset`    | Recreate local DB, apply migrations, run seed      |
| `npm run db:push`     | Push migrations to a linked remote Supabase project|
| `npm run db:types`    | Generate TypeScript DB types from local Supabase   |

---

## Environment variables

| Variable                        | Required | Exposure | Purpose |
| ------------------------------- | -------- | -------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Browser  | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Browser | Publishable (anon) key; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server features | **Server only** | Admin account creation, trusted grading/sync jobs |
| `NEXT_PUBLIC_APP_URL`           | Recommended | Browser | Canonical app URL |
| `GOOGLE_SHEETS_MOCK_MODE`       | No       | Server   | `true` overrides the admin mock switch and logs instead of calling Google |
| `GOOGLE_SHEETS_CLIENT_EMAIL`    | Phase 4  | **Server only** | Service-account email |
| `GOOGLE_SHEETS_PRIVATE_KEY`     | Phase 4  | **Server only** | Service-account private key (`\n` escaped) |
| `GOOGLE_SHEETS_SPREADSHEET_ID`  | Phase 4  | **Server only** | Target spreadsheet |
| `GOOGLE_SHEETS_SHEET_NAME`      | Phase 4  | **Server only** | Tab name, e.g. `Results` |
| `CRON_SECRET`                   | Optional | **Server only** | Bearer token for `GET /api/assessments/sweep`; without it the route requires a signed-in teacher/admin |

Server secrets are only read in `src/lib/env.server.ts`, which imports
`server-only`. If a Client Component ever imports it, the build fails.

---

## Architecture and security

### Authentication and roles

- `src/lib/auth/dal.ts` is the data-access layer. Every protected page and server
  action calls `requireTeacher()` or `requireStudent()`, which re-reads the
  Supabase user and profile from the database.
- `src/proxy.ts` (Next.js 16's renamed middleware) refreshes the session cookie
  and performs only optimistic redirects. It is not the authorization boundary.
- Roles and grade assignments live in `public.profiles`, never in cookies or
  client props.
- Students are created by staff through Supabase Admin (service role) starting in
  Phase 2. The `handle_new_user` trigger reads authorization fields from
  **`app_metadata`** (`app_role`, `grade_id`, `class_id`, `student_number`),
  because users cannot edit that field; user-editable `user_metadata` is used
  only for display names and usernames.
- Supabase password auth needs an email-shaped identifier, so the server derives
  a private one from the Student ID
  (`student-<normalised-id>@accounts.internal`, see
  `src/lib/auth/student-identity.ts`). It is never stored in `public.profiles`,
  never shown in the UI and never sent to Google Sheets. A database constraint
  rejects any `@accounts.internal` value in the contact-email column.
- The hosted trigger does not reliably apply `app_metadata` at insert time, so
  provisioning then upserts the profile explicitly with the service-role client.
  That write always sets `role = 'student'`; no teacher-facing action accepts a
  role field.
- Public registration is disabled. Do not enable it in the Supabase dashboard.

### Student account provisioning

1. A staff action runs `requireTeacher()` before anything else.
2. Zod validates the form — English and Arabic names, Student ID, grade, class
   and optional contact email — and the selected class is proven to belong to
   the selected grade. The Student ID is canonicalised and its lowercase form is
   checked against the global unique index before work begins.
3. `createAdminClient()` creates an email-confirmed user whose Auth email is the
   private Student-ID address. The password is either the teacher's initial
   password or an unguessable random value, then the profile is upserted
   (`role = 'student'`, names, optional contact email, username, Student ID,
   grade, class). If the profile write fails, the auth user is deleted again.
4. `generateLink({ type: "recovery" })` returns a hashed token for a one-time
   setup link. The UI builds
   `/auth/callback?token_hash=…&type=recovery&next=/set-password` and shows it
   once; `/set-password` lets the student choose a password (8+ characters).
   Students never receive this link by email; the teacher shares it privately.
5. An "edit Student ID" change updates the private Auth address first, then the
   profile; if the profile write fails the previous Auth identity is restored.
6. Every step is logged in `student_admin_events` (actor, action, timestamp and
   non-sensitive detail such as grade/class ids). `student_id_changed` and
   `password_reset` are audited explicitly. Passwords and links are never
   stored or logged.

The service-role key is imported by `src/lib/students/provisioning.ts` only,
which starts with `import "server-only"`.

### Student password reset

- A teacher resets a student's password from `/teacher/students/[id]`: the server
  issues a fresh one-time recovery link for the private Auth address, updates
  `access_reset_at` and writes a `password_reset` audit event.
- The link is single-use and time-limited by Supabase Auth. Nothing plaintext is
  stored or displayed after creation.
- Email-based self-service recovery remains available for teacher/admin accounts
  only; students have no email-dependent recovery path.

### Staff account management

1. Every staff page and server action starts with `requireAdmin()`; the action
   then re-reads the target profile and rejects any row that is not
   `teacher`/`admin`. A role or active flag sent by a teacher is never applied.
2. `createStaffAction` validates names, email, role and status with Zod, checks
   the email against `profiles`, then calls the server-only provisioning module.
   That module creates an email-confirmed Supabase Auth user with a random
   password and `app_metadata`, upserts the profile and issues a recovery link.
   If the profile write fails, the Auth user is deleted again.
3. Role and activation changes are dedicated audited actions. They run the same
   pure rules (`src/lib/staff/rules.ts`) as the UI *and* the database trigger, so
   self-demotion, self-deactivation and last-admin removal fail all the way down.
4. Access resets issue a fresh `generateLink({ type: "recovery" })` link and
   update `invitation_sent_at` / `access_reset_at`. The link is returned once,
   never stored, and the audit event only records `setup_issued: true`.
5. `staff_admin_events` is readable and appendable by active admins only, with
   `actor_id` forced to `auth.uid()`, no update or delete policy and revokes as a
   second layer. Detail is sanitised by an allowlist that drops passwords,
   tokens, links and keys.

The service-role key is imported by `src/lib/staff/provisioning.ts` only, which
starts with `import "server-only"`.

### Database security

RLS is enabled on every application table. Students can read only:

- their own profile;
- their own grade and classes in that grade;
- published resources for their grade;
- published assessments for their grade;
- their own **in-progress** attempt row. Every post-submission read goes
  through `public.student_attempt_result(uuid)`, which returns a score only
  when the assessment's `results_visibility` allows it.

Students have **no direct SELECT access** to sections, questions, options or
matching pairs. The assessment-taking flow uses
`public.get_student_assessment_payload(uuid)`, which validates the student's
grade and strips all answer keys. Answer writes are checked by
`public.student_can_write_answer(attempt_id, question_id)` and the
`protect_answer_integrity` trigger, so a student cannot write into another
student's attempt, after the timer expires, or outside
`<uid>/<attempt_id>/`. See [`docs/database.md`](docs/database.md) for the full
access matrix and integrity triggers.

### Storage

- `resources` is private. Staff uploads use short-lived signed upload URLs issued
  with the teacher's session; the server re-validates the stored object's real
  size and MIME type before saving the row. Students can read only files linked
  to a published resource in their own grade.
- Resource objects are stored as
  `<grade_id>/<pdf|image>/<uuid>-<filename>`, and the database check constraint
  rejects any other prefix. Signed URLs are created server-side with the
  signed-in user's session, so Storage RLS remains the final boundary.
- `assessment-submissions` is private. Student paths must begin with their UUID
  (`<student_id>/<attempt_id>/<file>`), so students cannot read classmates'
  uploads.

Browser-based PDF viewing cannot prevent a determined user from saving a file.
The product requirement is therefore implemented as “no visible download
button”, not as DRM. PDFs are embedded without the viewer toolbar, images are
display-only, and YouTube uses the privacy-enhanced nocookie player.

### Bilingual UI

`<Bi en="Dashboard" ar="لوحة التحكم" />` renders both languages together and
marks Arabic with `lang="ar" dir="rtl"`. There is no language toggle: the main
interface keeps English and Arabic visible at the same time, as required.
Validation and auth messages use stable codes that map to bilingual copy in
`src/lib/i18n/messages.ts`.

---

## Testing and verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The 296 unit tests cover role routing, login validation, open-redirect
protection, student/grade/class validation, student, resource, assessment and
staff filter parsing, resource, assessment and staff validation, automatic
grading, answer sanitising, storage-path helpers, YouTube parsing, staff
authorization/last-admin rules, audit metadata sanitising, mocked staff actions,
local DOCX/PDF/text extraction, question/section/choice parsing, answer-key
matching, importer validation/save boundaries, importer audit privacy and
bilingual copy completeness. Regression suites re-check student login, resource
filters, grading, hidden results, CSV export and the staff feature.

Hosted assessment security is verified by a self-contained script that creates
real test users, a temporary grade and four assessments, exercises the RPCs and
policies, then removes everything it created and checks that the cleanup left
nothing behind:

```bash
npm run verify:rls:hosted
```

It reads `.env.local` and needs the service-role key, so it only belongs on a
developer machine — never in a deployed environment. Its checks cover anonymous
denial, grade isolation, answer-key and question-table protection, cross-student
attempt/answer/submission access, resume and retake rules, timer expiry, strict
exam defaults, heartbeat ownership/counters, stale-heartbeat detection, automatic
submission reasons, one audit event per automatic close, duplicate-finalisation
idempotency, answer lockout after finalisation, seeded randomisation, automatic
and manual grading, visibility of `immediately` / `after_review` / `hidden`
results, the append-only audit logs, submission storage, staff
audit/self-protection rules, assessment-import staging (staff-only RLS,
owner-scoped rows, immutable owner, folder-bound paths, private bucket and the
four import audit actions) and cleanup of every row, audit event and temporary
import file it created.

Database integration otherwise requires Docker; verify migrations and RLS with:

```bash
npm run db:reset
```

Then sign in as each demo account and confirm:

1. The teacher reaches `/teacher` and sees counts.
2. Sara reaches `/student` and sees only Grade 10.
3. Omar sees only Grade 11.
4. Mona is redirected to `/account-disabled`.
5. Signed-out requests to `/teacher`, `/student` and `/account-*` redirect to
   `/login`.

Phase 2 checks on a hosted or local project:

1. `/teacher/students` lists students, searches by name/email/Student ID, and
   filters by grade, class and status through the URL.
2. Create a grade and a class on `/teacher/classes`, then create a student with
   English/Arabic names, a Student ID and both. The one-time link must contain
   `token_hash`, `type=recovery` and `next=/set-password`.
3. Sign in as that student with the Student ID and password. The private
   `@accounts.internal` address must not appear anywhere in the UI.
4. Try a duplicate Student ID in another grade: it must be rejected globally.
5. Deactivate the student: the badge flips to inactive and sign-in is refused.
   Reactivating restores access.
6. Edit the student's name and re-open the profile: the change is saved and the
   activity timeline shows the administration events. Change the Student ID and
   confirm the new ID signs in while the old one does not.
7. As a student, `/teacher` and `/teacher/students` are unreachable, other
   students' profiles are unreadable, and the audit log is invisible.

Phase 2b checks on a hosted or local project:

1. Create a category on `/teacher/resources/categories`; it appears in the
   resource form and the category count updates.
2. Upload a PDF and an image from `/teacher/resources/new`; both view in the
   browser without a download control.
3. Add a YouTube resource from a `youtu.be` link; the embedded player loads and
   the stored URL is canonical.
4. Publish one resource and leave another as a draft. A student in the same grade
   sees only the published row and opening the draft URL returns 404.
5. A student in another grade cannot see or open either resource, and the private
   bucket refuses anonymous/public URLs.
6. Edit a resource's grade; the private object moves to the new grade folder and
   only students in the new grade can open it.
7. Delete a resource; its storage object is removed, the row disappears, and the
   audit timeline records the deletion. Delete a category; its resources remain
   uncategorized.

Phase 3 checks on a hosted or local project:

1. Build a quiz with a section and one question of each type, publish it, and
   confirm a student in the assigned grade sees it while a student in another
   grade gets 404.
2. Start an attempt, reload the page, and confirm the same attempt resumes with
   saved answers and the countdown continuing.
3. Submit: objective answers are scored automatically, an answered essay moves
   the attempt to `grading`, and the teacher can grade it with feedback.
4. Switch an assessment to `after_review` and confirm the student result is
   hidden until grading finishes; switch to `hidden` and confirm no score,
   answers or feedback is returned by the result RPC.
5. Confirm a no-retake quiz rejects a second start, and an exam defaults to one
   attempt in the builder.
6. Let a one-minute attempt expire: the runner auto-submits at zero, and any
   late save is rejected with `attempt_expired`.
7. As a student, verify sections, questions, options, matching keys and other
   students' attempts/submissions are unreadable through the API, and that the
   builder shows the assessment activity timeline.
8. Delete a staff account that has graded an attempt: the delete succeeds, the
   attempt keeps its marks, and its `graded_by` reference becomes empty.

Phase 5 checks on a hosted or local project:

1. Sign in as the admin and open `/teacher/staff`: the list, filters, pagination
   and recent audit panel load. As a teacher or student, the same URL redirects
   away and the actions refuse to run.
2. Create a teacher with both names, an email and an active status. Only a
   one-time link is returned; no password is shown, and the new row appears with
   the invited timestamp. Use the link once to set a password, then confirm it
   cannot be reused.
3. Change the new account to admin, deactivate it, reactivate it, and reset its
   access. Each action appears in the audit timeline with the admin as actor and
   no token or link in the detail.
4. As an admin, try to demote or deactivate your own account, then try to remove
   the last active admin: both are rejected (`profile_self_admin_change_forbidden`
   / `last_admin_protected`), including through the REST API.
5. Edit a staff email, sign in with the new email, and confirm the old one no
   longer works. Rename the account and confirm the timeline shows `updated`.
6. As a teacher, attempt to read or append `staff_admin_events` and to update a
   staff profile through the REST API: all are denied, and the profile is
   unchanged.
7. Confirm student login still works with Student ID and no email, and that the
   existing admin account and student recovery flow are untouched.

Phase 6 checks on a hosted or local project:

1. As a teacher, open `/teacher/assessments/import` and upload a typed DOCX, a
   text-based PDF and a `.txt` paper. Each upload opens a review draft; no
   content is sent to an external service and no API key is needed.
2. Upload a scanned/image-only PDF: it is refused with a clear error instead of
   producing empty or invented questions.
3. Import an answer key (`1. B`, `2. True`, `3. played`, `1-b, 2-a`). Matched
   questions show the parsed key; an unmatched, duplicate or ambiguous number
   shows a warning and stays on manual grading until the teacher fixes it.
4. Edit titles, instructions, marks, types, choices, pairs and accepted answers,
   then reorder/add/delete sections and questions. “Save review progress” keeps
   the draft for 24 hours and “Save draft assessment” opens a real assessment
   that is still unpublished.
5. Confirm the imported assessment only appears to students after the explicit
   publish action, and that publishing writes `import_published` in the activity
   timeline alongside `import_started`, `import_draft_created` and
   `import_draft_edited` (counts only, never question text or file names).
6. Cancel an import: its staging row and both private files are deleted. Let
   another draft expire and confirm the lazy cleanup removes the row and files.
7. As a student, try to read `assessment_imports`, download an
   `assessment-imports` object or stage an import through the REST API: all are
   denied. As a second teacher, another teacher's staged row and files are
   unreadable and unwritable.

---

## Deploying to Vercel

1. **Create a Supabase project** at <https://supabase.com/dashboard> and keep
   the project URL, publishable (anon) key and service-role key.
2. **Push migrations** from your machine:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push --remote
   ```

   `--remote` is required: without it the CLI 3.x targets the local stack. In
   an interactive terminal the CLI asks for confirmation before touching the
   hosted database; non-interactive runs need `--yes`.

   Alternatively run the SQL files in `supabase/migrations/` in order from the
   SQL editor. Do not run `seed.sql` in production.
3. **Configure Auth** in the Supabase dashboard:
   - Disable new user sign-ups (Auth → Providers → Email → disable sign-ups).
   - Set the Site URL to the Vercel production URL.
   - Add `https://<your-domain>/auth/callback` to additional redirect URLs.
4. **Create the Vercel project** from this repository and add environment
   variables from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `NEXT_PUBLIC_APP_URL`
   - Google Sheets variables when Phase 4 reporting is enabled.
5. **Deploy.** The build command is `npm run build`; the framework preset is
   Next.js automatically.
6. **Create the teacher account** through the Supabase dashboard (Auth → Users)
   and set `app_metadata.app_role` to `teacher`, or run a controlled SQL update
   on `public.profiles` after creating the user. Keep public sign-up off.
7. Verify `/login`, both dashboards and a signed-out redirect on the deployed URL.

The service-role key must never be added with a `NEXT_PUBLIC_` prefix and must
never be used in browser code.

---

## Google Sheets reporting

The setup guide for Google Cloud, the service account, spreadsheet sharing and
environment variables is in [`docs/google-sheets.md`](docs/google-sheets.md).

- Sync is triggered after an attempt is finalised and after manual grading, in
  the background. A failure is logged and never blocks the student.
- Admin-only settings live at `/teacher/reporting`: sync on/off, mock mode, tab
  name, credential status (never the values), connectivity check, retry and the
  sync/audit logs.
- One attempt produces at most one sheet row and one log row. Regrades update
  the existing row after comparing the stored 18-column payload.
- Start with `reporting_settings.mock_mode` on, confirm the log rows, then turn
  it off after the spreadsheet is shared with the service-account email.

---

## Roadmap

| Phase | Scope |
| ----- | ----- |
| **1 — done** | Foundation, auth, roles, schema, RLS, storage, bilingual UI shell |
| **2 — done** | Student & class account management (create/invite, assign grade), grades/classes CRUD, student administration audit log |
| **2b — done** | Resource categories, PDF/image uploads, YouTube embeds, publishing, private signed-URL viewing, student resource browsing, resource audit log |
| **3 — done** | Assessment builder, eight question types, section/question ordering, timed attempts with autosave, automatic/manual grading, retake and visibility rules, results screens, assessment audit log |
| **4 — done** | Teacher/student dashboards, shared result filters, paginated results + CSV export, Google Sheets sync with idempotent payloads, retry and admin audit log |
| **5 — done** | Admin-only staff management: create/invite, edit, role changes, activation, one-time access links, last-admin protection and staff audit log |
| **6 — done** | Free, local assessment import: DOCX/text-PDF/plain-text extraction, deterministic question/answer-key parsing, bilingual review editor and unpublished draft creation |
| 7 | Seed polish, end-to-end runs, deployment hardening |

### Phase 5 starting points

- Reuse `requireTeacher()`, the bilingual form primitives and the
  `resource_admin_events` / `student_admin_events` audit pattern for any new
  staff mutations.
- Keep private files in `resources` with `<grade_id>/<type>/<uuid>-<filename>`,
  and validate stored object size/MIME type server-side after upload.
- Keep student-facing queries filtered by grade; RLS stays the final boundary.
- Keep answer keys in `questions`/`question_options` server-side. Use
  `student_can_write_answer` and `student_can_read_answers` for any new answer
  policies, and `student_attempt_result` for result reads.
- Automatic marks are computed in `src/lib/assessments/grading.ts` and applied
  atomically by `finalize_attempt`; keep trusted grading on the server-only
  client and never accept marks from the browser.
- Expired attempts are finalized lazily by the pages that encounter them; if a
  scheduled job is added later, call the same `finalize_attempt` RPC.

---

## Troubleshooting

- **Setup notice instead of the login page** — `NEXT_PUBLIC_SUPABASE_URL` or the
  publishable/anon key is missing/invalid. Edit `.env.local` and restart
  `npm run dev`.
- **`npx supabase start` fails with read-only/disk errors** — Docker Desktop
  needs free space on its data drive. Free space or move Docker's disk image,
  then retry.
- **Redirect loop at `/login`** — clear site cookies. Ensure the Supabase URL is
  reachable and the publishable/anon key belongs to the same project.
- **Seed users cannot sign in** — run `npm run db:reset`; the seed uses local-only
  passwords and confirms emails automatically. Students sign in with their
  Student ID (`G10-001`, `G11-001`, `G10-002`), not the contact email.
- **Reset the database** — `npm run db:reset` is destructive to local data only.

---

## License / usage

Private project for a single teacher. No license is granted for redistribution.
