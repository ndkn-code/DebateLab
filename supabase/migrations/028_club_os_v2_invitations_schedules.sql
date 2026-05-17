-- Club OS V2: club creation metadata, pending invitations, logo storage, and club schedules.

alter table public.clubs
  add column if not exists logo_url text,
  add column if not exists logo_storage_path text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists threads_url text;

create table if not exists public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  email text not null,
  role text not null default 'student'
    check (role in ('owner', 'coach', 'student')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '14 days'),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  last_sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_club_invitations_pending_email_role
  on public.club_invitations(club_id, lower(email), role)
  where status = 'pending';

create index if not exists idx_club_invitations_club_status
  on public.club_invitations(club_id, status, created_at desc);

create index if not exists idx_club_invitations_email_status
  on public.club_invitations(lower(email), status, expires_at);

create table if not exists public.club_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  title text not null,
  event_type text not null default 'meeting'
    check (event_type in ('meeting', 'workshop', 'tournament', 'social', 'deadline', 'other')),
  room text,
  location text,
  start_date date not null,
  end_date date,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  recurrence_rule jsonb not null default '{"frequency":"none"}'::jsonb,
  recurrence_summary text,
  external_calendar_url text,
  external_provider text,
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (end_time > start_time)
);

create index if not exists idx_club_events_club_status_start
  on public.club_events(club_id, status, start_date);

create index if not exists idx_club_events_class
  on public.club_events(class_id)
  where class_id is not null;

alter table public.club_invitations enable row level security;
alter table public.club_events enable row level security;

drop policy if exists "Club managers can view invitations" on public.club_invitations;
create policy "Club managers can view invitations"
  on public.club_invitations for select
  using (
    private.can_manage_club(club_id, (select auth.uid()))
    or (
      status = 'pending'
      and lower(email) = (
        select lower(p.email)
        from public.profiles p
        where p.id = (select auth.uid())
      )
    )
  );

drop policy if exists "Club managers can insert invitations" on public.club_invitations;
create policy "Club managers can insert invitations"
  on public.club_invitations for insert
  with check (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can update invitations" on public.club_invitations;
create policy "Club managers can update invitations"
  on public.club_invitations for update
  using (private.can_manage_club(club_id, (select auth.uid())))
  with check (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can delete invitations" on public.club_invitations;
create policy "Club managers can delete invitations"
  on public.club_invitations for delete
  using (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club members can view events" on public.club_events;
create policy "Club members can view events"
  on public.club_events for select
  using (private.can_view_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can insert events" on public.club_events;
create policy "Club managers can insert events"
  on public.club_events for insert
  with check (
    private.can_manage_club(club_id, (select auth.uid()))
    and (
      class_id is null
      or exists (
        select 1
        from public.classes c
        where c.id = class_id
          and c.club_id = club_id
      )
    )
  );

drop policy if exists "Club managers can update events" on public.club_events;
create policy "Club managers can update events"
  on public.club_events for update
  using (private.can_manage_club(club_id, (select auth.uid())))
  with check (
    private.can_manage_club(club_id, (select auth.uid()))
    and (
      class_id is null
      or exists (
        select 1
        from public.classes c
        where c.id = class_id
          and c.club_id = club_id
      )
    )
  );

drop policy if exists "Club managers can delete events" on public.club_events;
create policy "Club managers can delete events"
  on public.club_events for delete
  using (private.can_manage_club(club_id, (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-logos',
  'club-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Club logos are publicly readable" on storage.objects;
create policy "Club logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'club-logos');

drop policy if exists "Club managers can insert logos" on storage.objects;
create policy "Club managers can insert logos"
  on storage.objects for insert
  with check (
    bucket_id = 'club-logos'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.can_manage_club(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      else false
    end
  );

drop policy if exists "Club managers can update logos" on storage.objects;
create policy "Club managers can update logos"
  on storage.objects for update
  using (
    bucket_id = 'club-logos'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.can_manage_club(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      else false
    end
  )
  with check (
    bucket_id = 'club-logos'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.can_manage_club(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      else false
    end
  );

drop policy if exists "Club managers can delete logos" on storage.objects;
create policy "Club managers can delete logos"
  on storage.objects for delete
  using (
    bucket_id = 'club-logos'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.can_manage_club(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      else false
    end
  );

alter table public.email_template_overrides
  drop constraint if exists email_template_overrides_template_key_check,
  add constraint email_template_overrides_template_key_check
  check (
    template_key in (
      'welcome',
      'onboarding_nudge',
      'practice_reminder',
      'streak_rescue',
      'winback',
      'weekly_progress',
      'achievement',
      'course_nudge',
      'club_invitation'
    )
  );

alter table public.email_template_override_events
  drop constraint if exists email_template_override_events_template_key_check,
  add constraint email_template_override_events_template_key_check
  check (
    template_key in (
      'welcome',
      'onboarding_nudge',
      'practice_reminder',
      'streak_rescue',
      'winback',
      'weekly_progress',
      'achievement',
      'course_nudge',
      'club_invitation'
    )
  );

create or replace view public.admin_club_list_rows
with (security_invoker = true)
as
select
  clubs.id,
  clubs.code,
  clubs.name,
  clubs.club_type,
  clubs.city,
  clubs.country,
  clubs.status,
  clubs.timezone,
  clubs.created_at,
  clubs.updated_at,
  coalesce(cohort_counts.class_count, 0)::integer as class_count,
  coalesce(member_counts.student_count, 0)::integer as student_count,
  coalesce(member_counts.coach_count, 0)::integer as coach_count,
  coalesce(assignment_counts.assignment_count, 0)::integer as assignment_count,
  coalesce(review_counts.review_queue_count, 0)::integer as review_queue_count,
  case
    when coalesce(assignment_counts.assignment_count, 0) = 0
      or coalesce(member_counts.student_count, 0) = 0 then null
    else round(
      (
        coalesce(submission_counts.submission_count_30d, 0)::numeric
        / greatest(1, assignment_counts.assignment_count * member_counts.student_count)::numeric
      ) * 100
    )
  end as completion_rate_30d,
  case
    when coalesce(attendance_counts.total_records_30d, 0) = 0 then null
    else round(
      (
        (coalesce(attendance_counts.present_records_30d, 0) + coalesce(attendance_counts.late_records_30d, 0))::numeric
        / attendance_counts.total_records_30d::numeric
      ) * 100
    )
  end as attendance_rate_30d,
  round(avg(performance_attempts.overall_score) filter (
    where performance_attempts.occurred_at >= now() - interval '30 days'
  ), 1) as average_score_30d,
  clubs.logo_url,
  clubs.logo_storage_path,
  clubs.facebook_url,
  clubs.instagram_url,
  clubs.threads_url,
  coalesce(event_counts.upcoming_event_count, 0)::integer as upcoming_event_count
from public.clubs
left join (
  select club_id, count(*) as class_count
  from public.classes
  where status <> 'archived'
  group by club_id
) cohort_counts on cohort_counts.club_id = clubs.id
left join (
  select
    club_id,
    count(*) filter (where role = 'student' and status = 'active') as student_count,
    count(*) filter (where role in ('owner', 'coach') and status = 'active') as coach_count
  from public.club_memberships
  group by club_id
) member_counts on member_counts.club_id = clubs.id
left join (
  select club_id, count(*) as assignment_count
  from public.club_assignments
  where status = 'active'
  group by club_id
) assignment_counts on assignment_counts.club_id = clubs.id
left join (
  select club_id, count(*) as submission_count_30d
  from public.club_assignment_submissions
  where submitted_at >= now() - interval '30 days'
  group by club_id
) submission_counts on submission_counts.club_id = clubs.id
left join (
  select club_id, count(*) as review_queue_count
  from public.coach_reviews
  where status = 'open'
  group by club_id
) review_counts on review_counts.club_id = clubs.id
left join (
  select club_id, count(*) as upcoming_event_count
  from public.club_events
  where status = 'active'
    and start_date >= current_date
  group by club_id
) event_counts on event_counts.club_id = clubs.id
left join (
  select
    classes.club_id,
    count(records.id) as total_records_30d,
    count(records.id) filter (where records.status = 'present') as present_records_30d,
    count(records.id) filter (where records.status = 'late') as late_records_30d
  from public.classes
  join public.class_attendance_sessions sessions on sessions.class_id = classes.id
  left join public.class_attendance_records records on records.session_id = sessions.id
  where sessions.session_date >= (current_date - interval '30 days')::date
  group by classes.club_id
) attendance_counts on attendance_counts.club_id = clubs.id
left join public.performance_attempts on performance_attempts.club_id = clubs.id
group by
  clubs.id,
  cohort_counts.class_count,
  member_counts.student_count,
  member_counts.coach_count,
  assignment_counts.assignment_count,
  submission_counts.submission_count_30d,
  review_counts.review_queue_count,
  event_counts.upcoming_event_count,
  attendance_counts.total_records_30d,
  attendance_counts.present_records_30d,
  attendance_counts.late_records_30d;

revoke all on table
  public.admin_club_list_rows
from anon, authenticated;

grant select on table
  public.admin_club_list_rows
to authenticated;

revoke all on table
  public.club_invitations,
  public.club_events
from anon, authenticated;

grant select, insert, update, delete on table
  public.club_invitations,
  public.club_events
to authenticated;

grant all on public.club_invitations to service_role;
grant all on public.club_events to service_role;
