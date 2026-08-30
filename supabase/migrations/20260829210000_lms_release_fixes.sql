-- LMS release fixes: exact class manager scope, occurrence-linked attendance,
-- and a published/immutable teacher criterion-feedback projection.
begin;

-- The older Club OS policies granted any club manager all attendance rows. A
-- coach is a manager only for classes where they are the active assigned
-- teacher; owners and platform admins retain their class-wide authority.
drop policy if exists "Admins can manage class attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Students can view own class attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club members can view club attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club managers can insert club attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club managers can update club attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club managers can delete club attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Class attendance sessions readable by admins, members, and club members" on public.class_attendance_sessions;
drop policy if exists "Class attendance sessions insertable by admins and club managers" on public.class_attendance_sessions;
drop policy if exists "Class attendance sessions updatable by admins and club managers" on public.class_attendance_sessions;
drop policy if exists "Class attendance sessions deletable by admins and club managers" on public.class_attendance_sessions;
drop policy if exists "Historical learners read own attendance sessions" on public.class_attendance_sessions;

create policy "Attendance sessions readable by admins assigned teachers and enrolled learners"
on public.class_attendance_sessions for select to authenticated
using (
  private.is_admin((select auth.uid()))
  or private.can_manage_class(class_id, (select auth.uid()))
  or exists (
    select 1 from public.class_memberships member
    where member.class_id = class_attendance_sessions.class_id
      and member.user_id = (select auth.uid())
      and member.member_role = 'student'
      and member.status = 'active'
  )
  or exists (
    select 1
    from public.class_attendance_records own_record
    join public.class_attendance_sessions own_session
      on own_session.id = own_record.session_id
    where own_record.session_id = class_attendance_sessions.id
      and own_record.user_id = (select auth.uid())
      and private.was_class_student_on_date(
        own_session.class_id, (select auth.uid()), own_session.session_date
      )
  )
);
create policy "Attendance sessions insertable by admins and assigned teachers"
on public.class_attendance_sessions for insert to authenticated
with check (
  private.is_admin((select auth.uid()))
  or private.can_manage_class(class_id, (select auth.uid()))
);
create policy "Attendance sessions updatable by admins and assigned teachers"
on public.class_attendance_sessions for update to authenticated
using (
  private.is_admin((select auth.uid()))
  or private.can_manage_class(class_id, (select auth.uid()))
)
with check (
  private.is_admin((select auth.uid()))
  or private.can_manage_class(class_id, (select auth.uid()))
);
create policy "Attendance sessions deletable by admins and assigned teachers"
on public.class_attendance_sessions for delete to authenticated
using (
  private.is_admin((select auth.uid()))
  or private.can_manage_class(class_id, (select auth.uid()))
);

drop policy if exists "Admins can manage class attendance records" on public.class_attendance_records;
drop policy if exists "Students can view own class attendance records" on public.class_attendance_records;
drop policy if exists "Club members can view club attendance records" on public.class_attendance_records;
drop policy if exists "Club managers can insert club attendance records" on public.class_attendance_records;
drop policy if exists "Club managers can update club attendance records" on public.class_attendance_records;
drop policy if exists "Club managers can delete club attendance records" on public.class_attendance_records;
drop policy if exists "Class attendance records readable by admins, users, and club members" on public.class_attendance_records;
drop policy if exists "Class attendance records insertable by admins and club managers" on public.class_attendance_records;
drop policy if exists "Class attendance records updatable by admins and club managers" on public.class_attendance_records;
drop policy if exists "Class attendance records deletable by admins and club managers" on public.class_attendance_records;

create policy "Attendance records readable by admins assigned teachers and owners"
on public.class_attendance_records for select to authenticated
using (
  private.is_admin((select auth.uid()))
  or exists (
    select 1
    from public.class_attendance_sessions session_row
    where session_row.id = class_attendance_records.session_id
      and private.can_manage_class(session_row.class_id, (select auth.uid()))
  )
  or (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.class_attendance_sessions session_row
      where session_row.id = class_attendance_records.session_id
        and private.was_class_student_on_date(
          session_row.class_id, (select auth.uid()), session_row.session_date
        )
    )
  )
);
create policy "Attendance records insertable by admins and assigned teachers"
on public.class_attendance_records for insert to authenticated
with check (
  private.is_admin((select auth.uid()))
  or exists (
    select 1
    from public.class_attendance_sessions session_row
    where session_row.id = class_attendance_records.session_id
      and private.can_manage_class(session_row.class_id, (select auth.uid()))
  )
);
create policy "Attendance records updatable by admins and assigned teachers"
on public.class_attendance_records for update to authenticated
using (
  private.is_admin((select auth.uid()))
  or exists (
    select 1
    from public.class_attendance_sessions session_row
    where session_row.id = class_attendance_records.session_id
      and private.can_manage_class(session_row.class_id, (select auth.uid()))
  )
)
with check (
  private.is_admin((select auth.uid()))
  or exists (
    select 1
    from public.class_attendance_sessions session_row
    where session_row.id = class_attendance_records.session_id
      and private.can_manage_class(session_row.class_id, (select auth.uid()))
  )
);
create policy "Attendance records deletable by admins and assigned teachers"
on public.class_attendance_records for delete to authenticated
using (
  private.is_admin((select auth.uid()))
  or exists (
    select 1
    from public.class_attendance_sessions session_row
    where session_row.id = class_attendance_records.session_id
      and private.can_manage_class(session_row.class_id, (select auth.uid()))
  )
);

-- Existing pre-LMS sessions may remain null-linked. New sessions must be
-- attached to an occurrence; the nullable column is intentionally retained as
-- the migration path for legacy rows and backfill jobs.
create or replace function private.require_lms_attendance_occurrence()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'INSERT' and new.occurrence_id is null then
    raise exception 'ATTENDANCE_OCCURRENCE_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists require_lms_attendance_occurrence
  on public.class_attendance_sessions;
create trigger require_lms_attendance_occurrence
before insert on public.class_attendance_sessions
for each row execute function private.require_lms_attendance_occurrence();

-- Published teacher feedback is the only learner-visible projection. The
-- source review remains private for drafts, reviewers, and class managers.
drop policy if exists "Learners view published IELTS criterion feedback"
  on public.ielts_teacher_reviews;
create policy "Learners view published IELTS criterion feedback"
on public.ielts_teacher_reviews for select to authenticated
using (status = 'published' and user_id = (select auth.uid()));

create or replace view public.ielts_published_criterion_feedback
with (security_invoker = true)
as
select
  id,
  attempt_id,
  user_id,
  club_id,
  class_id,
  assignment_id,
  writing_response_id,
  speaking_response_id,
  review_kind,
  revision,
  criterion_feedback,
  published_at
from public.ielts_teacher_reviews
where status = 'published';

revoke all on public.ielts_published_criterion_feedback from anon;
grant select on public.ielts_published_criterion_feedback to authenticated;

create table if not exists public.ielts_teacher_review_feedback_history (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.ielts_teacher_reviews(id) on delete cascade,
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  revision integer not null check (revision >= 0),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  previous_criterion_feedback jsonb not null,
  criterion_feedback jsonb not null,
  created_at timestamptz not null default now()
);
comment on table public.ielts_teacher_review_feedback_history is
  'Append-only old/new criterion feedback versions; drafts are never learner-visible.';
create index if not exists ielts_teacher_review_feedback_history_review_idx
  on public.ielts_teacher_review_feedback_history(review_id, created_at desc);
alter table public.ielts_teacher_review_feedback_history enable row level security;
drop policy if exists "Managers view teacher criterion feedback history"
  on public.ielts_teacher_review_feedback_history;
create policy "Managers view teacher criterion feedback history"
on public.ielts_teacher_review_feedback_history for select to authenticated
using (exists (
  select 1 from public.ielts_teacher_reviews review
  where review.id = ielts_teacher_review_feedback_history.review_id
    and (
      review.reviewer_id = (select auth.uid())
      or private.can_manage_class(review.class_id, (select auth.uid()))
    )
));
revoke insert, update, delete on public.ielts_teacher_review_feedback_history
  from anon, authenticated;
grant select on public.ielts_teacher_review_feedback_history to authenticated;

create or replace function private.audit_ielts_teacher_review_feedback()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.criterion_feedback is distinct from old.criterion_feedback then
    insert into public.ielts_teacher_review_feedback_history(
      review_id, attempt_id, revision, actor_id,
      previous_criterion_feedback, criterion_feedback
    ) values (
      new.id, new.attempt_id, new.revision,
      coalesce(auth.uid(), new.reviewer_id),
      coalesce(old.criterion_feedback, '{}'::jsonb),
      coalesce(new.criterion_feedback, '{}'::jsonb)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_ielts_teacher_review_feedback
  on public.ielts_teacher_reviews;
create trigger audit_ielts_teacher_review_feedback
after update of criterion_feedback on public.ielts_teacher_reviews
for each row execute function private.audit_ielts_teacher_review_feedback();

create or replace function private.reject_ielts_teacher_review_feedback_history_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'ielts_teacher_review_feedback_history is append-only';
end;
$$;
drop trigger if exists ielts_teacher_review_feedback_history_immutable
  on public.ielts_teacher_review_feedback_history;
create trigger ielts_teacher_review_feedback_history_immutable
before update or delete on public.ielts_teacher_review_feedback_history
for each row execute function private.reject_ielts_teacher_review_feedback_history_mutation();

revoke all on function private.require_lms_attendance_occurrence(),
  private.audit_ielts_teacher_review_feedback(),
  private.reject_ielts_teacher_review_feedback_history_mutation()
  from public, anon, authenticated;

commit;
