-- DebateLab Club OS V1: club/cohort workflow, assignment pipeline, and normalized performance attempts.

-- Reconcile observed debate_sessions app/schema drift before downstream performance writes depend on it.
do $$
begin
  if to_regclass('public.debate_sessions') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'debate_sessions' and column_name = 'category'
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'debate_sessions' and column_name = 'topic_category'
    ) then
      alter table public.debate_sessions rename column category to topic_category;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'debate_sessions' and column_name = 'prep_time_seconds'
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'debate_sessions' and column_name = 'prep_time'
    ) then
      alter table public.debate_sessions rename column prep_time_seconds to prep_time;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'debate_sessions' and column_name = 'speech_time_seconds'
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'debate_sessions' and column_name = 'speech_time'
    ) then
      alter table public.debate_sessions rename column speech_time_seconds to speech_time;
    end if;

    alter table public.debate_sessions
      add column if not exists practice_track text;

    update public.debate_sessions
    set practice_track = case
      when feedback ->> 'practiceTrack' in ('debate', 'speaking') then feedback ->> 'practiceTrack'
      when practice_track in ('debate', 'speaking') then practice_track
      else 'debate'
    end
    where practice_track is null
       or practice_track not in ('debate', 'speaking');

    alter table public.debate_sessions
      alter column practice_track set default 'debate',
      alter column practice_track set not null;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'debate_sessions_practice_track_check'
        and conrelid = 'public.debate_sessions'::regclass
    ) then
      alter table public.debate_sessions
        add constraint debate_sessions_practice_track_check
        check (practice_track in ('debate', 'speaking'));
    end if;
  end if;
end;
$$;

create index if not exists idx_debate_sessions_user_track_created
  on public.debate_sessions(user_id, practice_track, created_at desc);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  club_type text not null default 'school'
    check (club_type in ('school', 'center', 'independent', 'online')),
  city text,
  country text not null default 'VN',
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'student'
    check (role in ('owner', 'coach', 'student')),
  status text not null default 'active'
    check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  invited_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id, role)
);

alter table public.classes
  add column if not exists club_id uuid references public.clubs(id) on delete set null;

alter table public.class_schedules
  alter column timezone set default 'Asia/Ho_Chi_Minh';

update public.class_schedules
set timezone = 'Asia/Ho_Chi_Minh'
where timezone = 'America/New_York';

create table if not exists public.club_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  title text not null,
  description text,
  assignment_type text not null default 'practice'
    check (assignment_type in ('practice', 'case', 'speech', 'quiz', 'attendance')),
  assigned_track text not null default 'debate'
    check (assigned_track in ('debate', 'speaking', 'mun')),
  topic_title text,
  topic_category text,
  due_at timestamptz,
  required_attempts integer not null default 1 check (required_attempts > 0),
  rubric_key text not null default 'debate_v1',
  rubric_version integer not null default 1 check (rubric_version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.club_assignments(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null default 'debate_session'
    check (source_type in ('debate_session', 'activity_attempt', 'duel_speech', 'manual')),
  source_id uuid not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewed')),
  submitted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id, source_type, source_id)
);

create table if not exists public.performance_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  assignment_id uuid references public.club_assignments(id) on delete set null,
  submission_id uuid references public.club_assignment_submissions(id) on delete set null,
  source_type text not null default 'debate_session'
    check (source_type in ('debate_session', 'activity_attempt', 'duel_speech', 'manual')),
  source_id uuid not null,
  practice_track text not null default 'debate'
    check (practice_track in ('debate', 'speaking', 'mun')),
  format text,
  topic_title text,
  topic_category text,
  topic_difficulty text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  word_count integer check (word_count is null or word_count >= 0),
  overall_score numeric(5, 2) check (overall_score is null or (overall_score >= 0 and overall_score <= 100)),
  overall_band text,
  rubric_key text not null default 'debate_v1',
  rubric_version integer not null default 1 check (rubric_version > 0),
  skill_scores jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  model_name text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create table if not exists public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  performance_attempt_id uuid not null references public.performance_attempts(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  visibility text not null default 'coach_only'
    check (visibility in ('coach_only', 'student_visible')),
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  score_adjustments jsonb not null default '{}'::jsonb,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clubs_status_created
  on public.clubs(status, created_at desc);
create index if not exists idx_clubs_owner
  on public.clubs(owner_user_id)
  where owner_user_id is not null;
create index if not exists idx_club_memberships_user_status
  on public.club_memberships(user_id, status);
create index if not exists idx_club_memberships_club_role_status
  on public.club_memberships(club_id, role, status);
create index if not exists idx_club_memberships_invited_by
  on public.club_memberships(invited_by)
  where invited_by is not null;
create index if not exists idx_classes_club_status
  on public.classes(club_id, status)
  where club_id is not null;
create index if not exists idx_club_assignments_club_status_due
  on public.club_assignments(club_id, status, due_at);
create index if not exists idx_club_assignments_class_status
  on public.club_assignments(class_id, status)
  where class_id is not null;
create index if not exists idx_club_assignments_created_by
  on public.club_assignments(created_by)
  where created_by is not null;
create index if not exists idx_club_assignment_submissions_user_submitted
  on public.club_assignment_submissions(user_id, submitted_at desc);
create index if not exists idx_club_assignment_submissions_club_submitted
  on public.club_assignment_submissions(club_id, submitted_at desc);
create index if not exists idx_club_assignment_submissions_class
  on public.club_assignment_submissions(class_id)
  where class_id is not null;
create index if not exists idx_club_assignment_submissions_assignment_status
  on public.club_assignment_submissions(assignment_id, status);
create index if not exists idx_performance_attempts_club_occurred
  on public.performance_attempts(club_id, occurred_at desc)
  where club_id is not null;
create index if not exists idx_performance_attempts_class_occurred
  on public.performance_attempts(class_id, occurred_at desc)
  where class_id is not null;
create index if not exists idx_performance_attempts_assignment
  on public.performance_attempts(assignment_id)
  where assignment_id is not null;
create index if not exists idx_performance_attempts_submission
  on public.performance_attempts(submission_id)
  where submission_id is not null;
create index if not exists idx_performance_attempts_user_occurred
  on public.performance_attempts(user_id, occurred_at desc);
create index if not exists idx_coach_reviews_club_status
  on public.coach_reviews(club_id, status, created_at desc);
create index if not exists idx_coach_reviews_attempt
  on public.coach_reviews(performance_attempt_id);
create index if not exists idx_coach_reviews_reviewer
  on public.coach_reviews(reviewer_id)
  where reviewer_id is not null;

create or replace function private.can_view_club(p_club_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and (
    private.is_admin(p_user_id)
    or exists (
      select 1
      from public.club_memberships cm
      where cm.club_id = p_club_id
        and cm.user_id = p_user_id
        and cm.status = 'active'
    )
  );
$$;

create or replace function private.can_manage_club(p_club_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and (
    private.is_admin(p_user_id)
    or exists (
      select 1
      from public.club_memberships cm
      where cm.club_id = p_club_id
        and cm.user_id = p_user_id
        and cm.status = 'active'
        and cm.role in ('owner', 'coach')
    )
  );
$$;

revoke all on function private.can_view_club(uuid, uuid) from public;
revoke all on function private.can_manage_club(uuid, uuid) from public;
grant execute on function private.can_view_club(uuid, uuid) to authenticated;
grant execute on function private.can_manage_club(uuid, uuid) to authenticated;

alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.club_assignments enable row level security;
alter table public.club_assignment_submissions enable row level security;
alter table public.performance_attempts enable row level security;
alter table public.coach_reviews enable row level security;

drop policy if exists "Club members can view clubs" on public.clubs;
create policy "Club members can view clubs"
  on public.clubs for select
  using (private.can_view_club(id, (select auth.uid())));

drop policy if exists "Admins and owners can create clubs" on public.clubs;
create policy "Admins and owners can create clubs"
  on public.clubs for insert
  with check (
    owner_user_id = (select auth.uid())
    or private.is_admin((select auth.uid()))
  );

drop policy if exists "Club managers can update clubs" on public.clubs;
create policy "Club managers can update clubs"
  on public.clubs for update
  using (private.can_manage_club(id, (select auth.uid())))
  with check (private.can_manage_club(id, (select auth.uid())));

drop policy if exists "Club managers can view memberships" on public.club_memberships;
create policy "Club managers can view memberships"
  on public.club_memberships for select
  using (
    user_id = (select auth.uid())
    or private.can_manage_club(club_id, (select auth.uid()))
  );

drop policy if exists "Club managers can insert memberships" on public.club_memberships;
create policy "Club managers can insert memberships"
  on public.club_memberships for insert
  with check (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can update memberships" on public.club_memberships;
create policy "Club managers can update memberships"
  on public.club_memberships for update
  using (private.can_manage_club(club_id, (select auth.uid())))
  with check (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can delete memberships" on public.club_memberships;
create policy "Club managers can delete memberships"
  on public.club_memberships for delete
  using (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club members can view assignments" on public.club_assignments;
create policy "Club members can view assignments"
  on public.club_assignments for select
  using (private.can_view_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can insert assignments" on public.club_assignments;
create policy "Club managers can insert assignments"
  on public.club_assignments for insert
  with check (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can update assignments" on public.club_assignments;
create policy "Club managers can update assignments"
  on public.club_assignments for update
  using (private.can_manage_club(club_id, (select auth.uid())))
  with check (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can delete assignments" on public.club_assignments;
create policy "Club managers can delete assignments"
  on public.club_assignments for delete
  using (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Students and managers can view submissions" on public.club_assignment_submissions;
create policy "Students and managers can view submissions"
  on public.club_assignment_submissions for select
  using (
    user_id = (select auth.uid())
    or private.can_manage_club(club_id, (select auth.uid()))
  );

drop policy if exists "Students can create own assignment submissions" on public.club_assignment_submissions;
create policy "Students can create own assignment submissions"
  on public.club_assignment_submissions for insert
  with check (
    user_id = (select auth.uid())
    and private.can_view_club(club_id, (select auth.uid()))
  );

drop policy if exists "Club managers can update submissions" on public.club_assignment_submissions;
create policy "Club managers can update submissions"
  on public.club_assignment_submissions for update
  using (private.can_manage_club(club_id, (select auth.uid())))
  with check (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Users and club managers can view performance attempts" on public.performance_attempts;
create policy "Users and club managers can view performance attempts"
  on public.performance_attempts for select
  using (
    user_id = (select auth.uid())
    or (club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
  );

drop policy if exists "Users can insert own performance attempts" on public.performance_attempts;
create policy "Users can insert own performance attempts"
  on public.performance_attempts for insert
  with check (
    user_id = (select auth.uid())
    and (
      club_id is null
      or private.can_view_club(club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can update performance attempts" on public.performance_attempts;
create policy "Club managers can update performance attempts"
  on public.performance_attempts for update
  using (club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
  with check (club_id is not null and private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers and visible students can view coach reviews" on public.coach_reviews;
create policy "Club managers and visible students can view coach reviews"
  on public.coach_reviews for select
  using (
    private.can_manage_club(club_id, (select auth.uid()))
    or (
      visibility = 'student_visible'
      and exists (
        select 1
        from public.performance_attempts pa
        where pa.id = coach_reviews.performance_attempt_id
          and pa.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Club managers can insert coach reviews" on public.coach_reviews;
create policy "Club managers can insert coach reviews"
  on public.coach_reviews for insert
  with check (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can update coach reviews" on public.coach_reviews;
create policy "Club managers can update coach reviews"
  on public.coach_reviews for update
  using (private.can_manage_club(club_id, (select auth.uid())))
  with check (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can delete coach reviews" on public.coach_reviews;
create policy "Club managers can delete coach reviews"
  on public.coach_reviews for delete
  using (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club members can view club classes" on public.classes;
create policy "Club members can view club classes"
  on public.classes for select
  using (club_id is not null and private.can_view_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can update club classes" on public.classes;
create policy "Club managers can update club classes"
  on public.classes for update
  using (club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
  with check (club_id is not null and private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can view club class memberships" on public.class_memberships;
create policy "Club managers can view club class memberships"
  on public.class_memberships for select
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_memberships.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club members can view club class schedules" on public.class_schedules;
create policy "Club members can view club class schedules"
  on public.class_schedules for select
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_schedules.class_id
        and c.club_id is not null
        and private.can_view_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can insert club class schedules" on public.class_schedules;
create policy "Club managers can insert club class schedules"
  on public.class_schedules for insert
  with check (
    exists (
      select 1
      from public.classes c
      where c.id = class_schedules.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can update club class schedules" on public.class_schedules;
create policy "Club managers can update club class schedules"
  on public.class_schedules for update
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_schedules.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.classes c
      where c.id = class_schedules.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can delete club class schedules" on public.class_schedules;
create policy "Club managers can delete club class schedules"
  on public.class_schedules for delete
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_schedules.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club members can view club course assignments" on public.class_course_assignments;
create policy "Club members can view club course assignments"
  on public.class_course_assignments for select
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_course_assignments.class_id
        and c.club_id is not null
        and private.can_view_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can insert club course assignments" on public.class_course_assignments;
create policy "Club managers can insert club course assignments"
  on public.class_course_assignments for insert
  with check (
    exists (
      select 1
      from public.classes c
      where c.id = class_course_assignments.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can update club course assignments" on public.class_course_assignments;
create policy "Club managers can update club course assignments"
  on public.class_course_assignments for update
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_course_assignments.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.classes c
      where c.id = class_course_assignments.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can delete club course assignments" on public.class_course_assignments;
create policy "Club managers can delete club course assignments"
  on public.class_course_assignments for delete
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_course_assignments.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club members can view club attendance sessions" on public.class_attendance_sessions;
create policy "Club members can view club attendance sessions"
  on public.class_attendance_sessions for select
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_attendance_sessions.class_id
        and c.club_id is not null
        and private.can_view_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can insert club attendance sessions" on public.class_attendance_sessions;
create policy "Club managers can insert club attendance sessions"
  on public.class_attendance_sessions for insert
  with check (
    exists (
      select 1
      from public.classes c
      where c.id = class_attendance_sessions.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can update club attendance sessions" on public.class_attendance_sessions;
create policy "Club managers can update club attendance sessions"
  on public.class_attendance_sessions for update
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_attendance_sessions.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.classes c
      where c.id = class_attendance_sessions.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can delete club attendance sessions" on public.class_attendance_sessions;
create policy "Club managers can delete club attendance sessions"
  on public.class_attendance_sessions for delete
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_attendance_sessions.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club members can view club attendance records" on public.class_attendance_records;
create policy "Club members can view club attendance records"
  on public.class_attendance_records for select
  using (
    exists (
      select 1
      from public.class_attendance_sessions sessions
      join public.classes c on c.id = sessions.class_id
      where sessions.id = class_attendance_records.session_id
        and c.club_id is not null
        and private.can_view_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can insert club attendance records" on public.class_attendance_records;
create policy "Club managers can insert club attendance records"
  on public.class_attendance_records for insert
  with check (
    exists (
      select 1
      from public.class_attendance_sessions sessions
      join public.classes c on c.id = sessions.class_id
      where sessions.id = class_attendance_records.session_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can update club attendance records" on public.class_attendance_records;
create policy "Club managers can update club attendance records"
  on public.class_attendance_records for update
  using (
    exists (
      select 1
      from public.class_attendance_sessions sessions
      join public.classes c on c.id = sessions.class_id
      where sessions.id = class_attendance_records.session_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.class_attendance_sessions sessions
      join public.classes c on c.id = sessions.class_id
      where sessions.id = class_attendance_records.session_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can delete club attendance records" on public.class_attendance_records;
create policy "Club managers can delete club attendance records"
  on public.class_attendance_records for delete
  using (
    exists (
      select 1
      from public.class_attendance_sessions sessions
      join public.classes c on c.id = sessions.class_id
      where sessions.id = class_attendance_records.session_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop view if exists public.admin_class_list_rows;
create view public.admin_class_list_rows
with (security_invoker = true)
as
select
  c.id,
  c.club_id,
  clubs.name as club_name,
  c.code,
  c.title,
  c.description,
  c.program_type,
  c.grade_level,
  c.status,
  c.start_date,
  c.end_date,
  c.meeting_schedule,
  c.room,
  c.max_students,
  c.created_at,
  c.updated_at,
  coalesce(m.student_count, 0)::integer as student_count,
  coalesce(a.assigned_course_count, 0)::integer as assigned_course_count,
  coalesce(s.session_count_30d, 0)::integer as session_count_30d,
  coalesce(cs.schedule_count, 0)::integer as schedule_count,
  case
    when coalesce(r.total_records_30d, 0) = 0 then null
    else round(((coalesce(r.present_records_30d, 0) + coalesce(r.late_records_30d, 0))::numeric / r.total_records_30d::numeric) * 100)
  end as attendance_rate_30d
from public.classes c
left join public.clubs on clubs.id = c.club_id
left join (
  select class_id, count(*) as student_count
  from public.class_memberships
  where member_role = 'student'
    and status = 'active'
  group by class_id
) m on m.class_id = c.id
left join (
  select class_id, count(*) as assigned_course_count
  from public.class_course_assignments
  group by class_id
) a on a.class_id = c.id
left join (
  select class_id, count(*) as session_count_30d
  from public.class_attendance_sessions
  where session_date >= (current_date - interval '30 days')::date
  group by class_id
) s on s.class_id = c.id
left join (
  select class_id, count(*) as schedule_count
  from public.class_schedules
  where status = 'active'
  group by class_id
) cs on cs.class_id = c.id
left join (
  select
    sessions.class_id,
    count(records.id) as total_records_30d,
    count(records.id) filter (where records.status = 'present') as present_records_30d,
    count(records.id) filter (where records.status = 'late') as late_records_30d
  from public.class_attendance_sessions sessions
  left join public.class_attendance_records records on records.session_id = sessions.id
  where sessions.session_date >= (current_date - interval '30 days')::date
  group by sessions.class_id
) r on r.class_id = c.id;

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
  ), 1) as average_score_30d
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
  attendance_counts.total_records_30d,
  attendance_counts.present_records_30d,
  attendance_counts.late_records_30d;

create or replace view public.admin_club_assignment_rows
with (security_invoker = true)
as
select
  assignments.id,
  assignments.club_id,
  assignments.class_id,
  classes.title as class_title,
  assignments.title,
  assignments.description,
  assignments.assignment_type,
  assignments.assigned_track,
  assignments.topic_title,
  assignments.topic_category,
  assignments.due_at,
  assignments.required_attempts,
  assignments.rubric_key,
  assignments.rubric_version,
  assignments.status,
  assignments.created_at,
  assignments.updated_at,
  count(submissions.id)::integer as submission_count,
  count(distinct submissions.user_id)::integer as unique_submitters,
  round(avg(performance_attempts.overall_score), 1) as average_score
from public.club_assignments assignments
left join public.classes on classes.id = assignments.class_id
left join public.club_assignment_submissions submissions on submissions.assignment_id = assignments.id
left join public.performance_attempts on performance_attempts.assignment_id = assignments.id
group by assignments.id, classes.title;

revoke all on table
  public.admin_class_list_rows,
  public.admin_club_list_rows,
  public.admin_club_assignment_rows
from anon, authenticated;

grant select on table
  public.admin_class_list_rows,
  public.admin_club_list_rows,
  public.admin_club_assignment_rows
to authenticated;

revoke all on table
  public.clubs,
  public.club_memberships,
  public.club_assignments,
  public.club_assignment_submissions,
  public.performance_attempts,
  public.coach_reviews
from anon, authenticated;

grant select, insert, update on table
  public.clubs,
  public.club_assignment_submissions,
  public.performance_attempts
to authenticated;

grant select, insert, update, delete on table
  public.club_memberships,
  public.club_assignments,
  public.coach_reviews
to authenticated;
