-- WS-L5: curated student resource library with private file delivery.

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null check (kind in ('file', 'link')),
  storage_path text,
  url text,
  mime_type text,
  size_bytes bigint,
  subject text not null default 'ielts' check (subject in ('ielts', 'debate')),
  tags text[] not null default '{}'::text[],
  access_level text not null default 'authenticated'
    check (access_level in ('public', 'authenticated', 'club')),
  club_id uuid references public.clubs(id),
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_title_nonempty_check check (length(btrim(title)) > 0),
  constraint resources_kind_payload_check check (
    (kind = 'file' and storage_path is not null and url is null)
    or (kind = 'link' and url is not null and storage_path is null)
  ),
  constraint resources_storage_path_nonempty_check
    check (storage_path is null or length(btrim(storage_path)) > 0),
  constraint resources_url_nonempty_check
    check (url is null or length(btrim(url)) > 0),
  constraint resources_size_bytes_check check (size_bytes is null or size_bytes >= 0),
  constraint resources_club_access_check check (
    (access_level = 'club' and club_id is not null)
    or (access_level <> 'club' and club_id is null)
  )
);

create unique index resources_storage_path_uidx
  on public.resources(storage_path)
  where storage_path is not null;

create index resources_visible_subject_created_idx
  on public.resources(subject, created_at desc)
  where published;

create index resources_club_created_idx
  on public.resources(club_id, created_at desc)
  where club_id is not null;

alter table public.resources enable row level security;

create policy "Anyone can view published public resources"
  on public.resources for select
  to anon
  using (published and access_level = 'public');

create policy "Authenticated users can view permitted resources"
  on public.resources for select
  to authenticated
  using (
    private.is_admin((select auth.uid()))
    or (
      published
      and (
        access_level in ('public', 'authenticated')
        or (
          access_level = 'club'
          and club_id is not null
          and private.can_view_club(club_id, (select auth.uid()))
        )
      )
    )
  );

create policy "Admins can create resources"
  on public.resources for insert
  to authenticated
  with check (private.is_admin((select auth.uid())));

create policy "Admins can update resources"
  on public.resources for update
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

create policy "Admins can delete resources"
  on public.resources for delete
  to authenticated
  using (private.is_admin((select auth.uid())));

grant select on public.resources to anon;
grant select, insert, update, delete on public.resources to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', false, 52428800)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit;

-- Upload paths are scoped as <admin-id>/<resource-id>/<unique-file-name>.
create policy "Admins can upload resource files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resources'
    and private.is_admin((select auth.uid()))
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

create policy "Admins can update resource files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resources'
    and private.is_admin((select auth.uid()))
  )
  with check (
    bucket_id = 'resources'
    and private.is_admin((select auth.uid()))
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

create policy "Admins can delete resource files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resources'
    and private.is_admin((select auth.uid()))
  );

-- A signed URL can only be minted when its metadata row is visible to the
-- caller. Keeping this policy row-backed prevents orphaned objects from being
-- downloaded and mirrors the homework-loop private-file pattern.
create policy "Visible resource files can be signed"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'resources'
    and exists (
      select 1
      from public.resources resource
      where resource.storage_path = name
    )
  );
