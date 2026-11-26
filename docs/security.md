# Security model · نموذج الأمان

This document records the deliberate security decisions, the limits of the
current design, and the operational steps for the hardening pass in
`supabase/migrations/20261126120000_security_hardening.sql`.

> **The hardening migration is a local file only.** It has not been applied to
> the hosted Supabase project. Apply it with explicit approval and after a
> backup, following the rollout steps at the end of this document.

---

## 1. Roles and scope

### Teachers and administrators are global staff (intentional)

A teacher or administrator can read and write every grade, class, resource,
assessment and result. There is **no** per-grade or per-class teacher scoping.
This is a deliberate product decision for a single-teacher deployment: staff are
trusted, and splitting their access would add friction without protecting
anything the owner does not already control.

What is enforced:

- Only an administrator can create, promote, deactivate or delete staff.
- A teacher cannot promote themselves, demote the last administrator, or
  deactivate their own account (database trigger plus server checks).
- Staff management RLS is admin-only; teaching staff cannot change roles or
  activation state.
- Every staff change is appended to `staff_admin_events`.

### Students are isolated

A student can only read:

- their own `profiles` row,
- assessments published for **their own grade**,
- their own attempts and answers,
- results only when the assessment's `results_visibility` allows it.

The boundary is PostgreSQL RLS plus security-definer helpers, not the UI. The
server actions take the student identity from the session (`requireStudent()`),
never from request input. Reporting and list screens are staff-only; a student
session cannot reach them.

Regression coverage: `tests/auth-signin.test.ts`,
`tests/student-identity.test.ts`, `tests/staff-rules.test.ts`,
`tests/strict-exam.test.ts`, and the RLS definitions in
`supabase/migrations/20261112091100_rls.sql`.

---

## 2. Strict Exam Mode

Strict mode is a deterrent, not an unbreakable proctor. It records heartbeats
and suspicious events, can submit on tab hide/navigation, and refuses writes
after the configured heartbeat timeout. A determined student can still use a
second device, a browser extension, or the network itself; no web-only design
can prevent that.

### What is enforced

| Path | Behaviour |
| ---- | --------- |
| Answer save | Server action checks status, expiry and heartbeat freshness; the database trigger and RLS helper repeat the check. |
| File upload | Storage insert policy requires an owned, open, unexpired, non-stale attempt. |
| Submission | Only server/RPC finalisation may close an attempt. A stale attempt is closed with `heartbeat_expired`, even if the browser claims a normal submit. |
| Page reload | `student_attempt_payload` refuses a stale attempt; the page finalises it and redirects to the result. |
| Resume | `student_start_attempt` refuses a stale attempt; the intro page sends the student to the result. |
| Timer expiry | The authoritative `expires_at` always wins, independent of the heartbeat. |
| Non-strict quiz | Heartbeat staleness is not applied when `strict_exam_mode` is off, or when connection-loss resume is allowed. |

### Limits

- Heartbeats are best-effort; a closed laptop cannot send one. The attempt is
  finalised on the next request or sweep.
- A student can open the assessment in two tabs. The server treats both as the
  same attempt and the last write wins.
- Browser focus/tab events are advisory. They are counted, not trusted.
- The free scheduler cannot run every minute on Vercel Hobby. Until a scheduler
  is configured, stale attempts are closed lazily on the next student or teacher
  request. See section 10.

---

## 3. Forged submissions

Before this pass, a student could send a PostgREST `PATCH` to their own
`attempts` row and set `status = 'submitted'`, skipping grading. The fix keeps
the owner-scoped UPDATE policy (so the heartbeat RPC still works if the function
owner is ever subject to RLS) but adds a trigger that rejects every meaningful
direct change:

- `status` changes raise `attempt_already_submitted`.
- `last_heartbeat_at`, the suspicious-event counters, the timer fields and the
  ownership columns raise `attempt_direct_write_forbidden`.
- Trusted RPCs set `app.attempt_server_write = 'on'` for their own transaction,
  and privileged/service-role writes bypass the trigger.

`finalize_attempt` and `teacher_grade_attempt` are privileged-only and remain
idempotent, so duplicate finalisation returns the existing result.

Normal submission, timer expiry, tab/navigation submission, teacher grading and
duplicate finalisation keep working; they all use privileged paths.

---

## 4. Login protection

### Throttling

- Per-identifier and per-IP keys are SHA-256 hashes; raw Student IDs, e-mails and
  IPs are never stored in the throttle table.
- Backoff starts after 5 identifier failures (15-minute window) and 10 IP
  failures, capped at 60 s and 300 s respectively. The window slides, so the
  lockout is temporary.
- A successful password clears the key.
- The RPCs are granted to `service_role` only. A client cannot call them to lock
  a known Student ID out.
- If the throttle store is unavailable, login falls through to Supabase Auth's
  own rate limits; the application never hard-fails because of the throttle.
- The client IP is read from `x-forwarded-for`/`x-real-ip`. This assumes the
  hosting proxy overwrites client-supplied values (Vercel does). A self-hosted
  deployment must strip those headers at the edge, otherwise a client can
  rotate the IP key.

### Enumeration

- Wrong password, unknown Student ID, wrong role tab and inactive account all
  return the same `invalid_credentials` message.
- The server never echoes the Student ID, internal Auth address or provider
  message.
- Student IDs map to private `@accounts.internal` addresses; those addresses are
  never copied into `profiles.email` and never logged.

### Passwords

- Sign-in keeps the old floor so existing accounts still work.
- New and reset passwords require at least 10 characters, at most 200, and must
  not be a common password, a repeated character or a keyboard sequence.
- There is no forced character-class rule; length and blocklisting follow
  current NIST guidance.
- A forced password change for teacher-generated initial passwords is **not**
  implemented. It would need a `must_change_password` flag, a signed-in change
  flow and a middleware redirect. Until then, generated passwords should be
  treated as temporary and shared out-of-band.

---

## 5. Uploads and Storage

- Submission bucket: private, 25 MiB, matching `ASSESSMENT_MAX_FILE_BYTES`.
- Import bucket: private, 50 MiB, matching `IMPORT_MAX_FILE_BYTES`.
- Students may upload only into `<student_id>/<attempt_id>/` while the attempt
  is open and not stale.
- The server re-checks the stored object's size and MIME type before an answer
  references it.
- Unreferenced files left by an abandoned upload are removed best-effort after
  finalisation.
- DOCX imports are inspected as ZIP archives before mammoth runs: entry count,
  total uncompressed size, ZIP64 sentinels and suspicious compression ratios are
  rejected. Parsing is wrapped in a 20-second cooperative timeout.
- A parse timeout bounds the request, but the parser may continue in the
  background. Keep the platform function timeout low as well.

---

## 6. Signed URLs are bearer tokens

- Submission files: 10-minute signed URLs, created with the signed-in user's
  session so Storage RLS still applies.
- Resource files: 1-hour signed URLs, long enough to read or watch without
  re-signing on every scroll.
- Anyone who obtains a signed URL can use it until it expires, without a
  session. Do not paste them into chats, tickets or screenshots.
- The URL is not a replacement for authorization; the signing request is
  authorized first.

---

## 7. OpenRouter (optional AI import assistance)

- AI is off unless both `OPENROUTER_IMPORT_ENABLED=true` and
  `OPENROUTER_API_KEY` are set. The key is server-only.
- The provider receives question text, option text, marks and the existing
  explanation. It never receives correct flags, accepted answers,
  `correct_value`, answer-key files, student names, Student IDs or e-mails.
- The provider cannot change the question type or the answer key. Its suggestion
  is shown to the teacher for approval; the local key is applied by index.
- Requests are bounded by request count, output tokens, timeout and one retry
  for transient failures. The key, headers and response body are never logged.
- Data leaves the server only when a teacher explicitly requests AI assistance.
  Review OpenRouter's retention terms before enabling it for real student data.

---

## 8. Search and reporting

- Free-text reporting search is capped at 80 characters.
- The value is escaped as one double-quoted PostgREST literal; commas, dots,
  parentheses, quotes and backslashes cannot add a filter or switch a column.
- The four search columns are fixed in code. The query is scoped to
  `role = 'student'` before the search is applied.
- List screens that strip grammar characters keep doing so; assessment search
  now uses the same quoted builder as reporting.
- Exports remain staff-only, capped at 5,000 rows, `no-store`, and formula
  prefixes are neutralised.

---

## 9. Headers, cookies and logging

### Headers (`next.config.ts`)

- `Content-Security-Policy` with `default-src 'self'`, `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and explicit
  Supabase, YouTube-nocookie and thumbnail origins.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling camera, microphone, geolocation, payment, USB
  and interest-cohort.
- `X-Frame-Options: DENY` for older browsers.
- `Strict-Transport-Security` in production only.

CSP uses `'unsafe-inline'` for scripts and styles because Next.js injects inline
bootstrap markup. A nonce-based CSP is a future improvement; it requires a proxy
rewrite on every response.

### Cookies

- Supabase SSR cookies keep `HttpOnly: false`. The browser client reads the
  session cookie to sign direct Storage uploads; making it HttpOnly would break
  that path.
- `Secure` is forced in production; local HTTP development keeps the library
  value.
- `SameSite=Lax` is preserved, and the proxy keeps the library's no-store
  headers whenever it writes auth cookies.

### Logging

- Never log passwords, tokens, service-role keys, OpenRouter keys, raw answer
  keys or full documents.
- Auth/provider failures log a stable code, not the provider message.
- Provisioning no longer logs raw constraint details (which can include a
  Student ID) or Auth error messages.
- Student-facing errors are stable codes rendered bilingually; provider wording
  never reaches the browser.

---

## 10. Scheduled cleanup (free options)

Stale attempts and expired imports are cleaned lazily on page loads. That is
enough for correctness but not for a quiet site. Options, cheapest first:

1. **External free scheduler** (for example a free cron/HTTP ping service)
   calling `GET /api/assessments/sweep` with
   `Authorization: Bearer $CRON_SECRET` every 5–15 minutes. No code change.
2. **Supabase `pg_cron`** if the project plan includes it: schedule a SQL job
   that selects stale attempts, but grading still needs the application (the
   objective marks are computed in TypeScript). A DB-only job can close the
   attempt, but it cannot produce the same scores unless grading is moved into
   SQL. Prefer option 1.
3. **Vercel Cron** on a paid plan. Vercel Hobby allows only daily cron, which is
   too slow for strict exams. Do not add it without approval.

`CRON_SECRET` comparison is length-checked and constant-time
(`crypto.timingSafeEqual`). Without a secret, the endpoint requires a signed-in
teacher.

---

## 11. Rollout

1. Back up the hosted database (Supabase dashboard → Database → Backups).
2. Review `supabase/migrations/20261126120000_security_hardening.sql`.
3. Apply it in a staging project first and run the app's own tests plus a manual
   strict-exam smoke test.
4. Apply to production with explicit approval.
5. Deploy the application code. The code tolerates the migration being absent:
   throttle RPC failures fall through, and the UI checks are additive. The
   database migration is what closes the forgery and staleness holes.
6. Set `CRON_SECRET` and point a free scheduler at the sweep route.
7. Verify:
   - a student cannot `PATCH` `attempts` directly,
   - a stale strict attempt cannot save an answer or upload,
   - a normal quiz and a normal strict submission still work,
   - login still works for a student and a teacher,
   - reporting search with commas/quotes returns the expected rows,
   - response headers include CSP and HSTS.

Do **not** run `scripts/verify-assessments-rls.mjs` against production; it
mutates data. Use a staging project.

---

## 12. Known remaining risks

- Global staff access is intentional; a compromised teacher account can read
  every grade.
- Strict mode cannot stop a second device or a determined cheater.
- CSP keeps `'unsafe-inline'` for Next.js compatibility.
- The throttle store is a database table, not a distributed rate limiter; a
  large botnet can still spread attempts across IPs.
- Signed URLs are bearer tokens until they expire.
- AI assistance is opt-in and minimised, but the provider still sees question
  text.
- Forced password change for generated initial passwords is not implemented.
