# Google Sheets reporting setup · إعداد تقارير Google Sheets

> **Status: implemented (Phase 4).** Finalised attempts and regrades are synced
> by the server. The admin page at `/teacher/reporting` controls sync on/off,
> mock mode and the tab name, shows credential *status* only, and exposes the
> sync log, retries and the reporting audit trail. Start with mock mode on,
> then turn it off once the spreadsheet is shared with the service account.

Each submitted attempt is written as one row in a Google Sheet. Writes are
server-side only, idempotent per attempt, and logged in
`public.google_sheet_sync_logs`.

## 1. Create a Google Cloud project

1. Open <https://console.cloud.google.com/>.
2. Create a project (for example `english-hub-results`).
3. Open **APIs & Services → Library**.
4. Search for **Google Sheets API** and click **Enable**.

No OAuth consent screen is needed for a service account used with a sheet that
the teacher owns.

## 2. Create a service account

1. Go to **APIs & Services → Credentials**.
2. Click **Create credentials → Service account**.
3. Name it (for example `english-hub-sheets`) and finish creation.
4. Open the service account → **Keys → Add key → Create new key → JSON**.
5. Download the JSON file. It contains `client_email` and `private_key`.

Treat the JSON file as a secret. Do not commit it. Add it to `.gitignore` if you
store it locally (the repository ignores `.env*` and `*.pem`; JSON keys are not
ignored automatically, so store them outside the repo).

## 3. Create and share the spreadsheet

1. Create a spreadsheet in Google Sheets.
2. Create a tab named `Results` (or choose your own name).
3. Share the spreadsheet with the service-account email
   (`...@....iam.gserviceaccount.com`) as **Editor**.
4. Copy the spreadsheet ID from the URL:

   ```text
   https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
   ```

The sync service checks tab A1:R1 and writes the 18-column header below when it
is missing or different. It does not create the tab itself; the tab name is an
administrator decision.

```text
Submission ID | Student ID | Student name | Student email | Grade | Class |
Assessment title | Assessment type | Grading mode | Start time | Submission time |
Time limit (minutes) | Score | Maximum score | Percentage | Result status |
Manual review status | Feedback summary
```

Student ID is the primary student identifier. The email column is optional and
written as an empty string when the student has no contact email; the private
`@accounts.internal` Auth address is never included.

## 4. Configure environment variables

Add these to `.env.local` (development) and to the Vercel project settings
(production). Never prefix them with `NEXT_PUBLIC_`. These four names are also
listed in `.env.example`.

```dotenv
GOOGLE_SHEETS_CLIENT_EMAIL=english-hub-sheets@your-project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
GOOGLE_SHEETS_SHEET_NAME=Results
```

Notes for the private key:

- Keep the surrounding quotes.
- Replace real newlines with the two characters `\n`; the server converts them
  back with `.replace(/\\n/g, "\n")`.
- On Vercel, paste the key as a single-line value with `\n` escapes.
- If the key is malformed, auth fails with a `DECODER` error; regenerate the key
  rather than editing it by hand.

`src/lib/env.server.ts` reads these values and imports `server-only`. No service
credentials are ever sent to the browser, and the admin page only shows whether
each value exists.

## 5. Mock mode and the admin page

Sign in as an administrator and open `/teacher/reporting`.

- **Synchronise finalized attempts** — turns the worker on or off. When off,
  attempts are logged as `skipped` and nothing is sent to Google.
- **Mock mode** — builds and stores the exact payload but performs no Google
  call. This is the default for the database settings row, so a fresh project
  cannot accidentally write to an unshared spreadsheet.
- **Sheet tab name** — must match a tab inside the spreadsheet (default
  `Results`).
- **Server credentials** — three booleans. The email, private key and
  spreadsheet ID are never rendered.
- **Check connection** — reads spreadsheet metadata and confirms the tab exists
  without writing anything. Unavailable in mock mode.
- **Retry / Retry all failed** — re-runs failed rows. Retries update the
  existing sheet row instead of appending a duplicate.
- **Sync log** — one row per attempt with status, tries, row reference, last
  error and a per-row action.
- **Administration audit** — append-only record of manual sync, retry, settings
  changes and connectivity checks, with the actor.

Local override: setting `GOOGLE_SHEETS_MOCK_MODE=true` forces mock mode even if
the database switch is off. Leaving it unset or `false` lets the admin switch
decide.

## 6. Idempotency and retries

- `google_sheet_sync_logs.attempt_id` is unique: one attempt produces at most one
  log row.
- The log stores a frozen copy of the 18-column payload after a successful
  write. A regrade compares the new payload and updates that row.
- Before writing, the service reads column A and searches for the submission ID.
  - no row found → append;
  - row found and payload unchanged → skip, no write;
  - row found and payload changed → update the same row.
- If someone deletes the sheet row manually, the next sync appends it again
  instead of skipping.
- A failed Google call leaves `status = failed` with a readable `last_error`
  and never fails the student's submission. Submission and manual grading run
  the sync in `after()`, after the response.
- All writes use the service-role client, so a Google outage never blocks the
  assessment flow. Only administrators can trigger a manual retry.

## 7. Row payload

| # | Column | Source |
| - | ------ | ------ |
| 1 | Submission ID | `attempts.id` (also the idempotency key in column A) |
| 2 | Student ID | `profiles.student_number` (primary identifier); falls back to `profiles.id` only if a legacy row has no ID |
| 3 | Student name | English and Arabic names joined with `·` |
| 4 | Student email | Optional contact `profiles.email`; blank when the student has no email |
| 5 | Grade | `grades.name_en · grades.name_ar` |
| 6 | Class | `classes.name_en · classes.name_ar` |
| 7 | Assessment title | `assessments.title_en · title_ar` |
| 8 | Assessment type | `quiz` / `exam` |
| 9 | Grading mode | `automatic` / `manual` / `mixed` |
| 10 | Start time | `attempts.started_at` (ISO 8601, UTC) |
| 11 | Submission time | `attempts.submitted_at` |
| 12 | Time limit (minutes) | `assessments.time_limit_minutes` |
| 13 | Score | `attempts.score`, rounded to 2 decimals |
| 14 | Maximum score | `attempts.max_score` |
| 15 | Percentage | `attempts.percentage` |
| 16 | Result status | `attempts.status` |
| 17 | Manual review status | `attempts.manual_review_status` |
| 18 | Feedback summary | Teacher feedback only, de-duplicated, capped at 500 characters |

Essay responses, answer text, answer keys, explanations and uploaded file paths
are deliberately absent from the payload type, so they cannot leak into the
sheet by accident.

## 8. Testing checklist

- [ ] Mock mode creates exactly one log row per attempt and no sheet write.
- [ ] Turning mock mode off and finalising an attempt appends one row.
- [ ] Re-submitting or re-syncing the same attempt ID does not duplicate a row.
- [ ] A failed Google call leaves status `failed` with a readable `last_error`.
- [ ] Retry updates the same log row and eventually sets `synced`.
- [ ] A regrade updates the existing row and its `row_reference`.
- [ ] A deleted sheet row is re-appended on the next sync.
- [ ] The service role key and Google private key never appear in network
      responses or client bundles.
- [ ] `/teacher/reporting` rejects teachers and students, and shows no credential
      values.
- [ ] Students cannot read `google_sheet_sync_logs`, `reporting_settings` or
      `reporting_admin_events` (RLS denies them).
- [ ] `npm run verify:rls:hosted` passes and leaves no test rows behind.

## 9. Common errors

| Error | Fix |
| ----- | --- |
| `not_configured` | One of the four server variables is missing; check the admin credential status |
| `403 PERMISSION_DENIED` | Share the spreadsheet with the service-account email as Editor |
| `403 API has not been used…` | Enable the Google Sheets API in the Cloud project |
| `DECODER routines::unsupported` | Fix `GOOGLE_SHEETS_PRIVATE_KEY` newline escaping |
| `sheet_not_found` | Wrong spreadsheet ID or tab name; create the tab first |
| `invalid_grant` | Regenerate the service-account key and update the env vars |
| `service_role_unavailable` | Add `SUPABASE_SERVICE_ROLE_KEY` on the server |
