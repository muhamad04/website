-- ---------------------------------------------------------------------------
-- Migration 3 of 4: private storage buckets and storage RLS
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources',
  'resources',
  false,
  26214400, -- 25 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-submissions',
  'assessment-submissions',
  false,
  20971520, -- 20 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Resources: staff manage everything, students read files attached to a
-- published resource for their own grade. Access is granted via signed URLs.
create policy storage_resources_teacher_all on storage.objects
  for all to authenticated
  using (bucket_id = 'resources' and public.is_teacher())
  with check (bucket_id = 'resources' and public.is_teacher());

create policy storage_resources_student_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resources'
    and exists (
      select 1
      from public.resources r
      where r.storage_path = storage.objects.name
        and r.is_published = true
        and r.grade_id = public.current_grade_id()
    )
  );

-- Assessment submissions: object paths must start with the student's UUID,
-- e.g. "<student_id>/<attempt_id>/<file>".
create policy storage_submissions_teacher_all on storage.objects
  for all to authenticated
  using (bucket_id = 'assessment-submissions' and public.is_teacher())
  with check (bucket_id = 'assessment-submissions' and public.is_teacher());

create policy storage_submissions_student_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assessment-submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy storage_submissions_student_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assessment-submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
