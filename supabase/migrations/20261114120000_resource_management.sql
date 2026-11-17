-- ---------------------------------------------------------------------------
-- Migration 6: teaching-resource management (Phase 2b)
-- ---------------------------------------------------------------------------
-- Additive only: the Phase 1 resource/category tables and storage policies are
-- preserved. This migration adds an append-only audit trail, integrity rules
-- for private file paths, and indexes for the browsing screens.
-- ---------------------------------------------------------------------------

-- 1. Private file paths must stay inside the resource's grade/type folder ----
-- The application writes "<grade_id>/<pdf|image>/<uuid>-<name>.<ext>". The
-- check makes a forged or stale path impossible even through the REST API.
alter table public.resources
  add constraint resources_storage_path_grade_type_check check (
    storage_path is null
    or (
      split_part(storage_path, '/', 1) = grade_id::text
      and split_part(storage_path, '/', 2) = type::text
      and length(split_part(storage_path, '/', 3)) between 1 and 200
      and split_part(storage_path, '/', 4) = ''
    )
  );

comment on constraint resources_storage_path_grade_type_check on public.resources is
  'PDF/image paths must start with the resource grade and type, e.g. "<grade_id>/pdf/<uuid>-<name>.pdf".';

-- 2. Audit trail -------------------------------------------------------------
-- Mirrors student_admin_events: append-only, staff-only, no update/delete
-- policy. resource_id/category_id intentionally have no foreign key so history
-- survives deletion of the recorded object.
create table public.resource_admin_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid,
  category_id uuid,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (
    action in (
      'created',
      'updated',
      'published',
      'unpublished',
      'deleted',
      'category_created',
      'category_updated',
      'category_deleted'
    )
  ),
  -- Non-sensitive summary only; never store signed URLs or upload tokens.
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint resource_admin_events_target_check check (
    resource_id is not null or category_id is not null
  )
);

create index resource_admin_events_resource_idx
  on public.resource_admin_events (resource_id, created_at desc)
  where resource_id is not null;
create index resource_admin_events_category_idx
  on public.resource_admin_events (category_id, created_at desc)
  where category_id is not null;

alter table public.resource_admin_events enable row level security;

create policy resource_admin_events_staff_read on public.resource_admin_events
  for select to authenticated
  using (public.is_teacher());

create policy resource_admin_events_staff_insert on public.resource_admin_events
  for insert to authenticated
  with check (public.is_teacher() and actor_id = (select auth.uid()));

comment on table public.resource_admin_events is
  'Append-only audit log for teaching-resource management. Intentionally has no update or delete policy.';

-- 3. Browse indexes ----------------------------------------------------------
-- Student lists read published rows for one grade; staff lists filter the same
-- columns while managing drafts.
create index if not exists resources_grade_published_type_idx
  on public.resources (grade_id, is_published, type, sort_order, created_at desc);
create index if not exists resources_category_grade_idx
  on public.resources (category_id, grade_id, is_published);
