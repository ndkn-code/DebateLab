-- IELTS LMS core-loop schema.
-- Persistent lesson occurrences connect the cohort calendar to course content,
-- resources, assignments, attendance, and an immutable historical roster.

begin;

create or replace function private.is_assigned_class_teacher(
  p_class_id uuid,
  p_user_id uuid
)
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
      from public.class_memberships cm
      join public.classes c on c.id = cm.class_id
      join public.club_memberships club_member
        on club_member.club_id = c.club_id
       and club_member.user_id = cm.user_id
       and club_member.role in ('owner', 'coach')
       and club_member.status = 'active'
      where cm.class_id = p_class_id
        and cm.user_id = p_user_id
        and cm.member_role = 'teacher'
        and cm.status = 'active'
    )
  );
$$;

create or replace function private.was_class_student_on_date(
  p_class_id uuid,
  p_user_id uuid,
  p_date date
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and p_date is not null and exists (
    select 1
    from public.class_memberships cm
    where cm.class_id = p_class_id
      and cm.user_id = p_user_id
      and cm.member_role = 'student'
      and cm.joined_at::date <= p_date
      and (cm.removed_at is null or cm.removed_at::date >= p_date)
  );
$$;

create table if not exists public.lms_lesson_occurrences (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  class_schedule_id uuid references public.class_schedules(id) on delete set null,
  course_id uuid not null references public.courses(id) on delete restrict,
  lesson_id uuid references public.lessons(id) on delete restrict,
  activity_id uuid references public.activities(id) on delete restrict,
  occurrence_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  title text not null check (length(btrim(title)) between 1 and 200),
  notes text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (lesson_id is not null or activity_id is not null),
  foreign key (class_id, course_id)
    references public.class_course_assignments(class_id, course_id)
    on delete restrict,
  unique (class_id, class_schedule_id, starts_at),
  unique (id, class_id, course_id, occurrence_date)
);

create table if not exists public.lms_occurrence_resources (
  occurrence_id uuid not null references public.lms_lesson_occurrences(id) on delete cascade,
  resource_id uuid not null references public.lms_resources(id) on delete restrict,
  order_index integer not null default 0 check (order_index >= 0),
  required boolean not null default false,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (occurrence_id, resource_id)
);

create table if not exists public.lms_occurrence_assignments (
  occurrence_id uuid not null references public.lms_lesson_occurrences(id) on delete cascade,
  assignment_id uuid not null references public.club_assignments(id) on delete restrict,
  relation_type text not null default 'homework'
    check (relation_type in ('prework', 'classwork', 'homework')),
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (occurrence_id, assignment_id)
);

create table if not exists public.lms_occurrence_roster_snapshots (
  occurrence_id uuid not null references public.lms_lesson_occurrences(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  class_membership_id uuid references public.class_memberships(id) on delete set null,
  enrollment_status text not null default 'enrolled'
    check (enrollment_status in ('enrolled', 'removed_after_occurrence')),
  captured_at timestamptz not null default now(),
  primary key (occurrence_id, user_id)
);

alter table public.class_attendance_sessions
  add column if not exists occurrence_id uuid
    references public.lms_lesson_occurrences(id) on delete set null;

create unique index if not exists class_attendance_sessions_occurrence_uidx
  on public.class_attendance_sessions(occurrence_id)
  where occurrence_id is not null;
create index if not exists lms_lesson_occurrences_class_week_idx
  on public.lms_lesson_occurrences(class_id, occurrence_date, starts_at, id);
create index if not exists lms_lesson_occurrences_course_idx
  on public.lms_lesson_occurrences(course_id, occurrence_date);
create index if not exists lms_lesson_occurrences_schedule_idx
  on public.lms_lesson_occurrences(class_schedule_id, starts_at)
  where class_schedule_id is not null;
create index if not exists lms_occurrence_resources_resource_idx
  on public.lms_occurrence_resources(resource_id, occurrence_id);
create index if not exists lms_occurrence_assignments_assignment_idx
  on public.lms_occurrence_assignments(assignment_id, occurrence_id);
create index if not exists lms_occurrence_roster_user_idx
  on public.lms_occurrence_roster_snapshots(user_id, occurrence_id);

create or replace function private.validate_lms_lesson_occurrence_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  class_row record;
  content_course uuid;
  schedule_row record;
begin
  select c.club_id, c.program_type into class_row
  from public.classes c where c.id = new.class_id;
  if not found or class_row.club_id is distinct from new.club_id then
    raise exception 'LMS_OCCURRENCE_CLASS_SCOPE_MISMATCH';
  end if;
  if class_row.program_type <> 'ielts' then
    raise exception 'LMS_OCCURRENCE_REQUIRES_IELTS_CLASS';
  end if;
  if not private.lms_pilot_enabled(new.club_id, new.class_id) then
    raise exception 'LMS_PILOT_DISABLED';
  end if;

  if new.lesson_id is not null then
    select m.course_id into content_course
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    where l.id = new.lesson_id;
    if content_course is distinct from new.course_id then
      raise exception 'LMS_OCCURRENCE_LESSON_COURSE_MISMATCH';
    end if;
  end if;
  if new.activity_id is not null then
    select m.course_id into content_course
    from public.activities a
    join public.course_modules m on m.id = a.module_id
    where a.id = new.activity_id;
    if content_course is distinct from new.course_id then
      raise exception 'LMS_OCCURRENCE_ACTIVITY_COURSE_MISMATCH';
    end if;
  end if;
  if new.class_schedule_id is not null then
    select s.class_id, s.course_id, s.timezone into schedule_row
    from public.class_schedules s where s.id = new.class_schedule_id;
    if not found or schedule_row.class_id <> new.class_id
       or (schedule_row.course_id is not null and schedule_row.course_id <> new.course_id) then
      raise exception 'LMS_OCCURRENCE_SCHEDULE_SCOPE_MISMATCH';
    end if;
  end if;
  if new.occurrence_date <> (new.starts_at at time zone new.timezone)::date then
    raise exception 'LMS_OCCURRENCE_LOCAL_DATE_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_lms_lesson_occurrence_scope
  on public.lms_lesson_occurrences;
create trigger validate_lms_lesson_occurrence_scope
before insert or update on public.lms_lesson_occurrences
for each row execute function private.validate_lms_lesson_occurrence_scope();

create or replace function private.validate_lms_occurrence_resource_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare occurrence_row record;
begin
  select club_id, class_id, course_id into occurrence_row
  from public.lms_lesson_occurrences where id = new.occurrence_id;
  if not found or not exists (
    select 1
    from public.lms_resources r
    where r.id = new.resource_id
      and r.club_id = occurrence_row.club_id
      and r.status = 'published'
      and r.license_status = 'approved'
      and (
        r.scope_class_id = occurrence_row.class_id
        or exists (
          select 1 from public.lms_resource_assignments ra
          where ra.resource_id = r.id
            and (ra.class_id = occurrence_row.class_id or ra.course_id = occurrence_row.course_id)
        )
      )
  ) then
    raise exception 'LMS_OCCURRENCE_RESOURCE_SCOPE_MISMATCH';
  end if;
  return new;
end;
$$;

create or replace function private.validate_lms_occurrence_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare occurrence_row record;
begin
  select club_id, class_id into occurrence_row
  from public.lms_lesson_occurrences where id = new.occurrence_id;
  if not found or not exists (
    select 1 from public.club_assignments a
    where a.id = new.assignment_id
      and a.club_id = occurrence_row.club_id
      and a.class_id = occurrence_row.class_id
  ) then
    raise exception 'LMS_OCCURRENCE_ASSIGNMENT_SCOPE_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_lms_occurrence_resource_scope
  on public.lms_occurrence_resources;
create trigger validate_lms_occurrence_resource_scope
before insert or update on public.lms_occurrence_resources
for each row execute function private.validate_lms_occurrence_resource_scope();
drop trigger if exists validate_lms_occurrence_assignment_scope
  on public.lms_occurrence_assignments;
create trigger validate_lms_occurrence_assignment_scope
before insert or update on public.lms_occurrence_assignments
for each row execute function private.validate_lms_occurrence_assignment_scope();

create or replace function private.validate_lms_occurrence_attendance_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.occurrence_id is not null and not exists (
    select 1 from public.lms_lesson_occurrences o
    where o.id = new.occurrence_id
      and o.class_id = new.class_id
      and o.course_id = new.course_id
      and o.occurrence_date = new.session_date
  ) then
    raise exception 'LMS_OCCURRENCE_ATTENDANCE_SCOPE_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_lms_occurrence_attendance_scope
  on public.class_attendance_sessions;
create trigger validate_lms_occurrence_attendance_scope
before insert or update of occurrence_id, class_id, course_id, session_date
on public.class_attendance_sessions
for each row execute function private.validate_lms_occurrence_attendance_scope();

create or replace function private.capture_lms_occurrence_roster()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.lms_occurrence_roster_snapshots(
    occurrence_id, user_id, class_membership_id
  )
  select new.id, cm.user_id, cm.id
  from public.class_memberships cm
  where cm.class_id = new.class_id
    and cm.member_role = 'student'
    and cm.joined_at::date <= new.occurrence_date
    and (cm.removed_at is null or cm.removed_at::date >= new.occurrence_date)
  on conflict (occurrence_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists capture_lms_occurrence_roster
  on public.lms_lesson_occurrences;
create trigger capture_lms_occurrence_roster
after insert on public.lms_lesson_occurrences
for each row execute function private.capture_lms_occurrence_roster();

create or replace function private.mark_lms_occurrence_roster_removed()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.member_role = 'student' and new.status = 'removed'
     and (old.status is distinct from new.status
       or old.removed_at is distinct from new.removed_at) then
    update public.lms_occurrence_roster_snapshots snapshot
    set enrollment_status = 'removed_after_occurrence'
    from public.lms_lesson_occurrences occurrence
    where snapshot.occurrence_id = occurrence.id
      and snapshot.user_id = new.user_id
      and occurrence.class_id = new.class_id
      and occurrence.occurrence_date <= coalesce(new.removed_at, now())::date;
  end if;
  return new;
end;
$$;

drop trigger if exists mark_lms_occurrence_roster_removed
  on public.class_memberships;
create trigger mark_lms_occurrence_roster_removed
after update of status, removed_at on public.class_memberships
for each row execute function private.mark_lms_occurrence_roster_removed();

create or replace function private.can_view_lms_occurrence(
  p_occurrence_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and exists (
    select 1
    from public.lms_lesson_occurrences o
    where o.id = p_occurrence_id
      and private.lms_pilot_enabled(o.club_id, o.class_id)
      and (
        private.can_manage_class(o.class_id, p_user_id)
        or private.was_class_student_on_date(o.class_id, p_user_id, o.occurrence_date)
        or exists (
          select 1 from public.lms_occurrence_roster_snapshots snapshot
          where snapshot.occurrence_id = o.id and snapshot.user_id = p_user_id
        )
      )
  );
$$;

create or replace function private.has_own_attendance_record(
  p_session_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and exists (
    select 1 from public.class_attendance_records record
    where record.session_id = p_session_id and record.user_id = p_user_id
  );
$$;

alter table public.lms_lesson_occurrences enable row level security;
alter table public.lms_occurrence_resources enable row level security;
alter table public.lms_occurrence_assignments enable row level security;
alter table public.lms_occurrence_roster_snapshots enable row level security;

create policy "LMS occurrence scoped reads"
on public.lms_lesson_occurrences for select to authenticated
using (private.can_view_lms_occurrence(id, (select auth.uid())));
create policy "LMS occurrence manager writes"
on public.lms_lesson_occurrences for all to authenticated
using (private.can_manage_class(class_id, (select auth.uid())))
with check (private.can_manage_class(class_id, (select auth.uid())));
create policy "LMS occurrence resource scoped reads"
on public.lms_occurrence_resources for select to authenticated
using (private.can_view_lms_occurrence(occurrence_id, (select auth.uid())));
create policy "LMS occurrence resource manager writes"
on public.lms_occurrence_resources for all to authenticated
using (exists (
  select 1 from public.lms_lesson_occurrences o
  where o.id = occurrence_id and private.can_manage_class(o.class_id, (select auth.uid()))
))
with check (exists (
  select 1 from public.lms_lesson_occurrences o
  where o.id = occurrence_id and private.can_manage_class(o.class_id, (select auth.uid()))
));
create policy "LMS occurrence assignment scoped reads"
on public.lms_occurrence_assignments for select to authenticated
using (private.can_view_lms_occurrence(occurrence_id, (select auth.uid())));
create policy "LMS occurrence assignment manager writes"
on public.lms_occurrence_assignments for all to authenticated
using (exists (
  select 1 from public.lms_lesson_occurrences o
  where o.id = occurrence_id and private.can_manage_class(o.class_id, (select auth.uid()))
))
with check (exists (
  select 1 from public.lms_lesson_occurrences o
  where o.id = occurrence_id and private.can_manage_class(o.class_id, (select auth.uid()))
));
create policy "LMS occurrence roster scoped reads"
on public.lms_occurrence_roster_snapshots for select to authenticated
using (
  user_id = (select auth.uid())
  or private.can_view_lms_occurrence(occurrence_id, (select auth.uid()))
);

drop policy if exists "Historical learners read own attendance sessions"
  on public.class_attendance_sessions;
create policy "Historical learners read own attendance sessions"
on public.class_attendance_sessions for select to authenticated
using (private.has_own_attendance_record(id, (select auth.uid())));

revoke all on public.lms_lesson_occurrences,
  public.lms_occurrence_resources,
  public.lms_occurrence_assignments,
  public.lms_occurrence_roster_snapshots from anon;
grant select, insert, update, delete on public.lms_lesson_occurrences,
  public.lms_occurrence_resources,
  public.lms_occurrence_assignments to authenticated;
grant select on public.lms_occurrence_roster_snapshots to authenticated;

-- Criterion-specific teacher feedback is separate from AI rationale. Only an
-- active assigned class teacher (or platform admin) may author or transition a
-- review; class owners remain operational managers but are not score authors.
alter table public.ielts_teacher_reviews
  add column if not exists criterion_feedback jsonb not null default '{}'::jsonb;

create or replace function private.validate_ielts_criterion_feedback(
  p_kind text,
  p_feedback jsonb
)
returns boolean
language sql
immutable
set search_path = public, private
as $$
  select jsonb_typeof(coalesce(p_feedback, '{}'::jsonb)) = 'object'
    and not exists (
      select 1
      from jsonb_each(coalesce(p_feedback, '{}'::jsonb)) item
      where item.key not in (
        'taskAchievement', 'taskResponse', 'coherenceCohesion',
        'lexicalResource', 'grammaticalRangeAccuracy',
        'fluencyCoherence', 'pronunciation'
      )
        or jsonb_typeof(item.value) <> 'string'
        or length(btrim(item.value #>> '{}')) > 5000
        or (p_kind = 'writing' and item.key in ('fluencyCoherence', 'pronunciation'))
        or (p_kind = 'speaking' and item.key in ('taskAchievement', 'taskResponse', 'coherenceCohesion'))
    );
$$;

alter table public.ielts_teacher_reviews
  drop constraint if exists ielts_teacher_reviews_criterion_feedback_check,
  add constraint ielts_teacher_reviews_criterion_feedback_check
    check (private.validate_ielts_criterion_feedback(review_kind, criterion_feedback));

create or replace function private.enforce_ielts_review_teacher_authority()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is not null
     and not private.is_assigned_class_teacher(new.class_id, auth.uid()) then
    raise exception 'IELTS_REVIEW_REQUIRES_ASSIGNED_CLASS_TEACHER';
  end if;
  if not private.is_assigned_class_teacher(new.class_id, new.reviewer_id) then
    raise exception 'IELTS_REVIEW_REQUIRES_ASSIGNED_CLASS_TEACHER';
  end if;
  if tg_op = 'UPDATE' and new.reviewer_id is distinct from old.reviewer_id then
    raise exception 'IELTS_REVIEW_AUTHOR_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_ielts_review_teacher_authority
  on public.ielts_teacher_reviews;
create trigger enforce_ielts_review_teacher_authority
before insert or update on public.ielts_teacher_reviews
for each row execute function private.enforce_ielts_review_teacher_authority();

create or replace function public.update_ielts_teacher_review_feedback(
  p_review_id uuid,
  p_expected_revision integer,
  p_criterion_feedback jsonb,
  p_actor_id uuid default auth.uid()
)
returns setof public.ielts_teacher_reviews
language plpgsql
security definer
set search_path = public, private
as $$
declare review_row public.ielts_teacher_reviews%rowtype;
begin
  if p_actor_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  select * into review_row
  from public.ielts_teacher_reviews
  where id = p_review_id
  for update;
  if not found or review_row.status <> 'draft'
     or review_row.reviewer_id <> p_actor_id
     or review_row.revision <> p_expected_revision then
    raise exception 'IELTS_DRAFT_NOT_EDITABLE';
  end if;
  if not private.is_assigned_class_teacher(review_row.class_id, p_actor_id) then
    raise exception 'FORBIDDEN';
  end if;
  if not private.validate_ielts_criterion_feedback(
    review_row.review_kind,
    coalesce(p_criterion_feedback, '{}'::jsonb)
  ) then
    raise exception 'IELTS_CRITERION_FEEDBACK_INVALID';
  end if;
  update public.ielts_teacher_reviews
  set criterion_feedback = coalesce(p_criterion_feedback, '{}'::jsonb),
      updated_at = now()
  where id = review_row.id
  returning * into review_row;
  insert into public.ielts_teacher_review_events(
    review_id, attempt_id, actor_id, event_type, from_status, to_status,
    revision, payload
  ) values (
    review_row.id, review_row.attempt_id, p_actor_id, 'updated', 'draft',
    'draft', review_row.revision,
    jsonb_build_object('reviewKind', review_row.review_kind,
      'criterionFeedbackUpdated', true)
  );
  return next review_row;
end;
$$;

revoke all on function public.update_ielts_teacher_review_feedback(uuid, integer, jsonb, uuid)
  from public, anon;
grant execute on function public.update_ielts_teacher_review_feedback(uuid, integer, jsonb, uuid)
  to authenticated;

-- Speaking evidence remains private. The application creates short-lived
-- signed URLs; these columns record the metadata verified by the server first.
alter table public.speaking_responses
  add column if not exists audio_mime_type text,
  add column if not exists audio_size_bytes bigint
    check (audio_size_bytes is null or audio_size_bytes between 1 and 26214400),
  add column if not exists audio_sha256 text
    check (audio_sha256 is null or audio_sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists audio_verified_at timestamptz;

drop policy if exists "Assigned IELTS teachers read review audio" on storage.objects;
create policy "Assigned IELTS teachers read review audio"
on storage.objects for select to authenticated
using (
  bucket_id = 'practice-audio'
  and exists (
    select 1
    from public.speaking_responses response
    join public.ielts_attempts attempt on attempt.id = response.attempt_id
    where response.audio_storage_path = name
      and attempt.class_id is not null
      and private.is_assigned_class_teacher(
        attempt.class_id,
        (select auth.uid())
      )
  )
);

-- Extend the existing stale-submission cleanup claim with durable outcome
-- tracking. The storage worker reports success/failure after deleting blobs.
alter table public.club_assignment_submissions
  add column if not exists cleanup_status text not null default 'none'
    check (cleanup_status in ('none', 'pending', 'succeeded', 'failed')),
  add column if not exists cleanup_attempts integer not null default 0
    check (cleanup_attempts >= 0),
  add column if not exists cleanup_last_error text,
  add column if not exists cleanup_updated_at timestamptz;

create index if not exists club_assignment_submissions_cleanup_idx
  on public.club_assignment_submissions(cleanup_status, cleanup_updated_at)
  where submission_state = 'failed';

create or replace function public.retry_homework_submission(
  p_submission_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, storage
as $$
declare
  uid uuid := auth.uid();
  submission public.club_assignment_submissions%rowtype;
begin
  if uid is null or p_user_id is distinct from uid then raise exception 'FORBIDDEN'; end if;
  select * into submission
  from public.club_assignment_submissions
  where id = p_submission_id
  for update;
  if not found or submission.user_id <> uid then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if submission.submission_state <> 'failed' then raise exception 'SUBMISSION_NOT_FAILED'; end if;
  if submission.cleanup_status <> 'succeeded' then
    raise exception 'HOMEWORK_RETRY_REQUIRES_SUCCESSFUL_CLEANUP';
  end if;
  if not private.can_submit_homework_assignment(submission.assignment_id, uid) then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;
  if exists (
    select 1
    from public.assignment_submission_files file
    join storage.objects object
      on object.bucket_id = 'assignment-submissions'
     and object.name = file.storage_path
    where file.submission_id = submission.id
  ) then
    raise exception 'HOMEWORK_RETRY_REQUIRES_OBJECT_CLEANUP';
  end if;

  perform set_config('app.homework_state_transition', 'on', true);
  update public.assignment_submission_files
  set state = 'pending', verified_at = null
  where submission_id = submission.id;
  update public.club_assignment_submissions
  set submission_state = 'draft', failure_reason = null,
      cleanup_status = 'none', cleanup_last_error = null,
      cleanup_updated_at = now(), updated_at = now()
  where id = submission.id;
  return submission.id;
end;
$$;

create or replace function public.record_homework_cleanup_result(
  p_submission_id uuid,
  p_success boolean,
  p_error text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  update public.club_assignment_submissions
  set cleanup_status = case when p_success then 'succeeded' else 'failed' end,
      cleanup_last_error = case when p_success then null else left(nullif(btrim(p_error), ''), 1000) end,
      cleanup_updated_at = now(), updated_at = now()
  where id = p_submission_id
    and submission_state = 'failed'
    and cleanup_status = 'pending';
  if not found then raise exception 'HOMEWORK_CLEANUP_NOT_PENDING'; end if;
  return p_submission_id;
end;
$$;

-- Preserve the existing service-only claim contract while adding durable
-- claim state and retry counters.
create or replace function public.cleanup_stale_homework_submissions(
  p_before timestamptz,
  p_limit integer default 100
)
returns table (submission_id uuid, previous_state text, removed_paths jsonb)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  submission_row record;
  paths jsonb;
  limit_value integer := greatest(1, least(coalesce(p_limit, 100), 1000));
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if p_before is null then raise exception 'CUTOFF_REQUIRED'; end if;

  for submission_row in
    select id, submission_state
    from public.club_assignment_submissions
    where submission_state in ('draft', 'uploading', 'failed')
      and updated_at < p_before
      and cleanup_status in ('none', 'failed')
    order by updated_at asc
    limit limit_value
    for update skip locked
  loop
    select coalesce(jsonb_agg(file.storage_path order by file.created_at), '[]'::jsonb)
      into paths
    from public.assignment_submission_files file
    where file.submission_id = submission_row.id
      and file.state in ('pending', 'failed');

    update public.assignment_submission_files file
    set state = 'failed', verified_at = null
    where file.submission_id = submission_row.id
      and file.state in ('pending', 'failed');

    perform set_config('app.homework_state_transition', 'on', true);
    update public.club_assignment_submissions
    set submission_state = 'failed',
        failure_reason = 'stale submission cleanup',
        cleanup_status = 'pending',
        cleanup_attempts = cleanup_attempts + 1,
        cleanup_last_error = null,
        cleanup_updated_at = now(),
        updated_at = now()
    where id = submission_row.id;

    submission_id := submission_row.id;
    previous_state := submission_row.submission_state;
    removed_paths := paths;
    return next;
  end loop;
end;
$$;

revoke all on function public.retry_homework_submission(uuid, uuid)
  from public, anon;
grant execute on function public.retry_homework_submission(uuid, uuid)
  to authenticated;
revoke all on function public.record_homework_cleanup_result(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_homework_cleanup_result(uuid, boolean, text)
  to service_role;

revoke all on function private.is_assigned_class_teacher(uuid, uuid),
  private.was_class_student_on_date(uuid, uuid, date),
  private.validate_lms_lesson_occurrence_scope(),
  private.validate_lms_occurrence_resource_scope(),
  private.validate_lms_occurrence_assignment_scope(),
  private.validate_lms_occurrence_attendance_scope(),
  private.capture_lms_occurrence_roster(),
  private.mark_lms_occurrence_roster_removed(),
  private.can_view_lms_occurrence(uuid, uuid),
  private.has_own_attendance_record(uuid, uuid),
  private.validate_ielts_criterion_feedback(text, jsonb),
  private.enforce_ielts_review_teacher_authority()
  from public, anon;
grant execute on function private.is_assigned_class_teacher(uuid, uuid),
  private.was_class_student_on_date(uuid, uuid, date),
  private.can_view_lms_occurrence(uuid, uuid),
  private.has_own_attendance_record(uuid, uuid)
  to authenticated, service_role;

commit;
