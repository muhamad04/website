-- ---------------------------------------------------------------------------
-- Migration 16: free, local assessment import
-- ---------------------------------------------------------------------------
-- Adds the private staging area used between an upload and a reviewed draft:
--
--   1. public.assessment_imports: teacher-owned staging rows holding the parsed
--      draft, the extracted text and the private storage paths. Students can
--      never read or write this table.
--   2. A trigger that pins the owner and keeps every storage path inside the
--      owner's folder, even if a request bypasses the UI.
--   3. The private assessment-imports bucket with staff-only storage policies.
--   4. Four new append-only audit actions on assessment_admin_events.
--
-- Nothing here publishes an assessment. Imported assessments are inserted with
-- is_published = false by the application and can only go live through the
-- existing explicit publish action.
-- ---------------------------------------------------------------------------

-- 1. Staging table -----------------------------------------------------------

create table public.assessment_imports (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'draft' check (
    status in ('draft', 'saved', 'cancelled')
  ),
  source_file_name text not null,
  source_mime_type text not null,
  source_size integer not null check (source_size >= 0),
  source_kind text not null check (source_kind in ('docx', 'pdf', 'txt')),
  answer_file_name text,
  answer_mime_type text,
  answer_size integer check (answer_size is null or answer_size >= 0),
  answer_kind text check (
    answer_kind is null or answer_kind in ('docx', 'pdf', 'txt')
  ),
  -- Private storage paths, always "<owner_id>/<import_id>/<role>-<name>".
  source_path text,
  answer_path text,
  -- Extracted text and parsed draft are staff-only and are cleared as soon as
  -- the import is saved or cancelled.
  source_text text not null default '',
  answer_text text not null default '',
  draft jsonb not null default '{}'::jsonb,
  assessment_id uuid references public.assessments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create index assessment_imports_owner_idx
  on public.assessment_imports (created_by, created_at desc);
create index assessment_imports_expiry_idx
  on public.assessment_imports (status, expires_at);

alter table public.assessment_imports enable row level security;

-- Teachers own their imports; admins may inspect and clean any import. Every
-- policy also requires an active staff role, so a student can never stage one.
create policy assessment_imports_staff_read
  on public.assessment_imports
  for select to authenticated
  using (
    public.is_teacher()
    and (created_by = (select auth.uid()) or public.is_admin())
  );

create policy assessment_imports_staff_insert
  on public.assessment_imports
  for insert to authenticated
  with check (
    public.is_teacher()
    and created_by = (select auth.uid())
  );

create policy assessment_imports_staff_update
  on public.assessment_imports
  for update to authenticated
  using (
    public.is_teacher()
    and (created_by = (select auth.uid()) or public.is_admin())
  )
  with check (
    public.is_teacher()
    and (created_by = (select auth.uid()) or public.is_admin())
  );

create policy assessment_imports_staff_delete
  on public.assessment_imports
  for delete to authenticated
  using (
    public.is_teacher()
    and (created_by = (select auth.uid()) or public.is_admin())
  );

grant select, insert, update, delete on public.assessment_imports
  to authenticated;
revoke all on public.assessment_imports from anon;

comment on table public.assessment_imports is
  'Private assessment-import staging. Staff-only, owner-scoped, temporary. Parsed drafts never publish themselves.';

-- 2. Owner and path guards ---------------------------------------------------

create or replace function public.protect_assessment_import()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner text;
begin
  if tg_op = 'UPDATE' then
    -- The owner and creation time can never be reassigned.
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  v_owner := new.created_by::text;

  if new.source_path is not null and split_part(new.source_path, '/', 1) <> v_owner then
    raise exception 'import_source_path_outside_owner';
  end if;

  if new.answer_path is not null and split_part(new.answer_path, '/', 1) <> v_owner then
    raise exception 'import_answer_path_outside_owner';
  end if;

  return new;
end;
$$;

create trigger assessment_imports_guard
  before insert or update on public.assessment_imports
  for each row execute function public.protect_assessment_import();

comment on function public.protect_assessment_import() is
  'Keeps import ownership immutable and every private file path inside the owner folder.';

-- 3. Private storage bucket --------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-imports',
  'assessment-imports',
  false,
  4194304, -- 4 MB per file
  array[
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Only staff may touch this bucket, and only inside their own
-- "<uid>/..." folder. Admins may read or remove any import object so expired
-- rows can be cleaned without the owning teacher present.
create policy storage_assessment_imports_staff_all on storage.objects
  for all to authenticated
  using (
    bucket_id = 'assessment-imports'
    and public.is_teacher()
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  )
  with check (
    bucket_id = 'assessment-imports'
    and public.is_teacher()
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

-- 4. Import audit actions ----------------------------------------------------

alter table public.assessment_admin_events
  drop constraint if exists assessment_admin_events_action_check;

alter table public.assessment_admin_events
  add constraint assessment_admin_events_action_check
  check (
    action in (
      'created',
      'updated',
      'published',
      'unpublished',
      'deleted',
      'section_created',
      'section_updated',
      'section_deleted',
      'sections_reordered',
      'question_created',
      'question_updated',
      'question_deleted',
      'questions_reordered',
      'attempt_graded',
      'import_started',
      'import_draft_created',
      'import_draft_edited',
      'import_published'
    )
  );
