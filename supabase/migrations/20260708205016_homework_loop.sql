-- WS-L0: Homework loop schema for assign -> submit -> grade -> feedback.

alter table public.club_assignments
  add column if not exists submission_text_enabled boolean not null default true,
  add column if not exists submission_files_enabled boolean not null default false,
  add column if not exists submission_max_files integer not null default 3,
  add column if not exists submission_max_file_mb integer not null default 10,
  add column if not exists submission_allowed_ext text[],
  add column if not exists submission_instructions text;

alter table public.club_assignments
  drop constraint if exists club_assignments_submission_max_files_check,
  add constraint club_assignments_submission_max_files_check
    check (submission_max_files between 0 and 20),
  drop constraint if exists club_assignments_submission_max_file_mb_check,
  add constraint club_assignments_submission_max_file_mb_check
    check (submission_max_file_mb between 1 and 50);

alter table public.club_assignment_submissions
  alter column source_id drop not null,
  add column if not exists submission_text text,
  add column if not exists grade_status text not null default 'submitted',
  add column if not exists score numeric(5,2),
  add column if not exists score_max numeric(5,2),
  add column if not exists rubric_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists feedback text,
  add column if not exists graded_by uuid references public.profiles(id) on delete set null,
  add column if not exists graded_at timestamptz;

alter table public.club_assignment_submissions
  drop constraint if exists club_assignment_submissions_source_type_check,
  add constraint club_assignment_submissions_source_type_check
    check (source_type = any (array[
      'debate_session'::text,
      'activity_attempt'::text,
      'duel_speech'::text,
      'manual'::text,
      'homework'::text
    ])),
  drop constraint if exists club_assignment_submissions_grade_status_check,
  add constraint club_assignment_submissions_grade_status_check
    check (grade_status = any (array[
      'submitted'::text,
      'graded'::text,
      'returned'::text,
      'resubmit_requested'::text
    ])),
  drop constraint if exists club_assignment_submissions_score_bounds_check,
  add constraint club_assignment_submissions_score_bounds_check
    check (
      (score is null or score >= 0)
      and (score_max is null or score_max > 0)
      and (score is null or score_max is null or score <= score_max)
    );

create unique index if not exists club_assignment_submissions_id_club_user_uidx
  on public.club_assignment_submissions(id, club_id, user_id);

create table if not exists public.assignment_submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint assignment_submission_files_submission_owner_fkey
    foreign key (submission_id, club_id, user_id)
    references public.club_assignment_submissions(id, club_id, user_id)
    on delete cascade,
  constraint assignment_submission_files_storage_path_key unique (storage_path),
  constraint assignment_submission_files_nonempty_path_check check (length(btrim(storage_path)) > 0),
  constraint assignment_submission_files_nonempty_name_check check (length(btrim(file_name)) > 0),
  constraint assignment_submission_files_size_check check (size_bytes is null or size_bytes >= 0)
);

alter table public.assignment_submission_files enable row level security;

drop policy if exists "Students can create own assignment submission files"
  on public.assignment_submission_files;
create policy "Students can create own assignment submission files"
  on public.assignment_submission_files for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.can_view_club(club_id, (select auth.uid()))
  );

drop policy if exists "Students and managers can view assignment submission files"
  on public.assignment_submission_files;
create policy "Students and managers can view assignment submission files"
  on public.assignment_submission_files for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_manage_club(club_id, (select auth.uid()))
  );

drop policy if exists "Students and managers can delete assignment submission files"
  on public.assignment_submission_files;
create policy "Students and managers can delete assignment submission files"
  on public.assignment_submission_files for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_manage_club(club_id, (select auth.uid()))
  );

create index if not exists assignment_submission_files_submission_id_idx
  on public.assignment_submission_files(submission_id);

create index if not exists assignment_submission_files_club_created_idx
  on public.assignment_submission_files(club_id, created_at desc);

grant select, insert, delete on public.assignment_submission_files to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assignment-submissions',
  'assignment-submissions',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'audio/wave',
    'audio/x-wav'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Students can upload own assignment submission files"
  on storage.objects;
create policy "Students can upload own assignment submission files"
  on storage.objects for insert
  to authenticated
  with check (
    case
      when bucket_id = 'assignment-submissions'
        and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then
        (
          owner = (select auth.uid())
          or owner_id = ((select auth.uid()))::text
          or ((storage.foldername(name))[3])::uuid = (select auth.uid())
        )
        and private.can_view_club(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      else false
    end
  );

drop policy if exists "Students and managers can read assignment submission files"
  on storage.objects;
create policy "Students and managers can read assignment submission files"
  on storage.objects for select
  to authenticated
  using (
    case
      when bucket_id = 'assignment-submissions'
        and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then
        (
          owner = (select auth.uid())
          or owner_id = ((select auth.uid()))::text
          or ((storage.foldername(name))[3])::uuid = (select auth.uid())
        )
        or private.can_manage_club(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      else false
    end
  );

drop policy if exists "Students and managers can delete assignment submission files"
  on storage.objects;
create policy "Students and managers can delete assignment submission files"
  on storage.objects for delete
  to authenticated
  using (
    case
      when bucket_id = 'assignment-submissions'
        and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then
        (
          owner = (select auth.uid())
          or owner_id = ((select auth.uid()))::text
          or ((storage.foldername(name))[3])::uuid = (select auth.uid())
        )
        or private.can_manage_club(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      else false
    end
  );
