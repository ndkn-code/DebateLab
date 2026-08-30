-- IELTS assessment modes and frozen attempt configuration.
--
-- This migration is additive: existing tests and attempts are classified from
-- their current test kind, while each attempt stores its own immutable mode and
-- test-version snapshot. A later edit to a test can therefore never change an
-- in-flight sitting's timing/order/feedback policy.

begin;

do $$ begin
  create type public.ielts_assessment_mode as enum ('practice', 'simulation');
exception when duplicate_object then null; end $$;

alter table public.ielts_tests
  add column if not exists assessment_mode public.ielts_assessment_mode
    not null default 'practice';

-- Full mocks are exam simulations; skill sets and drills remain guided practice.
update public.ielts_tests
set assessment_mode = case when kind = 'full_mock' then 'simulation'::public.ielts_assessment_mode
                           else 'practice'::public.ielts_assessment_mode end
where assessment_mode = 'practice'::public.ielts_assessment_mode
  and kind = 'full_mock';

alter table public.ielts_tests
  drop constraint if exists ielts_tests_assessment_mode_kind_check;
alter table public.ielts_tests
  add constraint ielts_tests_assessment_mode_kind_check
  check ((kind = 'full_mock' and assessment_mode = 'simulation') or kind <> 'full_mock');

alter table public.ielts_attempts
  add column if not exists assessment_mode public.ielts_assessment_mode
    not null default 'practice';
alter table public.ielts_attempts
  add column if not exists test_version integer not null default 1
    check (test_version > 0);

-- Snapshot both values before introducing the immutable-attempt trigger.
update public.ielts_attempts a
set assessment_mode = t.assessment_mode,
    test_version = t.version
from public.ielts_tests t
where t.id = a.test_id;

alter table public.ielts_question_responses
  add column if not exists test_version integer not null default 1
    check (test_version > 0);
alter table public.ielts_question_responses
  add column if not exists question_revision integer not null default 1
    check (question_revision > 0);

update public.ielts_question_responses r
set test_version = a.test_version
from public.ielts_attempts a
where a.id = r.attempt_id;

create index if not exists idx_ielts_tests_assessment_mode
  on public.ielts_tests(assessment_mode, status);
create index if not exists idx_ielts_attempts_assessment_mode
  on public.ielts_attempts(user_id, assessment_mode, created_at desc);
create index if not exists idx_ielts_question_responses_frozen_context
  on public.ielts_question_responses(attempt_id, test_version, question_revision);

-- Attempt mode/version are a snapshot. The test author may publish a new mode
-- for future attempts, but an existing attempt cannot be rewritten underneath a
-- learner or grader.
create or replace function private.prevent_ielts_attempt_snapshot_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assessment_mode <> old.assessment_mode
     or new.test_version <> old.test_version then
    raise exception 'IELTS_ATTEMPT_SNAPSHOT_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists ielts_attempt_snapshot_immutable on public.ielts_attempts;
create trigger ielts_attempt_snapshot_immutable
before update on public.ielts_attempts
for each row execute function private.prevent_ielts_attempt_snapshot_change();

-- Replace the timing RPCs with mode-aware guards. Every transition locks the
-- section and verifies the attempt status, ownership, frozen mode, and ordered
-- simulation progression using the database clock.
create or replace function public.ielts_start_attempt_section(p_section_id uuid)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sec public.ielts_attempt_sections%rowtype;
  v_attempt public.ielts_attempts%rowtype;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_sec from public.ielts_attempt_sections where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  if v_sec.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  select * into v_attempt from public.ielts_attempts where id = v_sec.attempt_id;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_attempt.status <> 'in_progress' then raise exception 'ATTEMPT_NOT_IN_PROGRESS'; end if;

  if v_attempt.assessment_mode = 'simulation' then
    if v_sec.skill not in ('listening', 'reading', 'writing') then
      raise exception 'SIMULATION_SPEAKING_REHEARSAL_SEPARATE';
    end if;
    if exists (
      select 1 from public.ielts_attempt_sections prior
      where prior.attempt_id = v_sec.attempt_id
        and prior.section_order < v_sec.section_order
        and prior.submitted_at is null
    ) or exists (
      select 1 from public.ielts_attempt_sections later
      where later.attempt_id = v_sec.attempt_id
        and later.section_order > v_sec.section_order
        and later.started_at is not null
    ) then
      raise exception 'SIMULATION_SECTION_ORDER_LOCKED';
    end if;
  end if;

  if v_sec.started_at is null then
    update public.ielts_attempt_sections
    set started_at = now(),
        deadline_at = case when v_sec.time_limit_seconds is null then null
          else now() + make_interval(secs => v_sec.time_limit_seconds) end,
        updated_at = now()
    where id = p_section_id
    returning deadline_at into v_sec.deadline_at;
  end if;
  return v_sec.deadline_at;
end;
$$;

create or replace function public.ielts_pause_attempt_section(p_section_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sec public.ielts_attempt_sections%rowtype;
  v_mode public.ielts_assessment_mode;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_sec from public.ielts_attempt_sections where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  select assessment_mode into v_mode from public.ielts_attempts where id = v_sec.attempt_id;
  if v_sec.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_mode = 'simulation' then raise exception 'SIMULATION_CANNOT_PAUSE'; end if;
  if v_sec.started_at is null then raise exception 'SECTION_NOT_STARTED'; end if;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  if v_sec.paused_at is not null then return; end if;
  if v_sec.deadline_at is not null and now() > v_sec.deadline_at then raise exception 'SECTION_EXPIRED'; end if;
  update public.ielts_attempt_sections set paused_at = now(), updated_at = now() where id = p_section_id;
end;
$$;

create or replace function public.ielts_resume_attempt_section(p_section_id uuid)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sec public.ielts_attempt_sections%rowtype;
  v_mode public.ielts_assessment_mode;
  v_paused interval;
  v_new_deadline timestamptz;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_sec from public.ielts_attempt_sections where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  select assessment_mode into v_mode from public.ielts_attempts where id = v_sec.attempt_id;
  if v_sec.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_mode = 'simulation' then raise exception 'SIMULATION_CANNOT_PAUSE'; end if;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  if v_sec.paused_at is null then return v_sec.deadline_at; end if;
  v_paused := now() - v_sec.paused_at;
  update public.ielts_attempt_sections
  set deadline_at = case when v_sec.deadline_at is null then null else v_sec.deadline_at + v_paused end,
      paused_seconds = v_sec.paused_seconds + floor(extract(epoch from v_paused))::integer,
      paused_at = null, updated_at = now()
  where id = p_section_id returning deadline_at into v_new_deadline;
  return v_new_deadline;
end;
$$;

create or replace function public.ielts_record_question_response(
  p_section_id uuid, p_question_id uuid, p_response jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sec public.ielts_attempt_sections%rowtype;
  v_attempt public.ielts_attempts%rowtype;
  v_q public.ielts_questions%rowtype;
  v_resp_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_sec from public.ielts_attempt_sections where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  if v_sec.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  if v_sec.paused_at is not null then raise exception 'SECTION_PAUSED'; end if;
  if v_sec.started_at is null then raise exception 'SECTION_NOT_STARTED'; end if;
  if v_sec.deadline_at is not null and now() > v_sec.deadline_at + interval '2 seconds' then raise exception 'SECTION_EXPIRED'; end if;
  select * into v_attempt from public.ielts_attempts where id = v_sec.attempt_id;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_attempt.status <> 'in_progress' then raise exception 'ATTEMPT_NOT_IN_PROGRESS'; end if;
  select * into v_q from public.ielts_questions where id = p_question_id;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  if v_q.test_id <> v_attempt.test_id then raise exception 'QUESTION_NOT_IN_TEST'; end if;
  if v_q.skill <> v_sec.skill then raise exception 'QUESTION_SKILL_MISMATCH'; end if;
  if exists (
    select 1 from public.ielts_question_responses existing
    where existing.attempt_id = v_sec.attempt_id
      and existing.question_id = p_question_id
      and existing.section_id is distinct from p_section_id
  ) then
    raise exception 'QUESTION_RESPONSE_SECTION_IMMUTABLE';
  end if;
  insert into public.ielts_question_responses
    (attempt_id, user_id, question_id, section_id, test_version, question_revision, response)
  values
    (v_sec.attempt_id, v_uid, p_question_id, p_section_id, v_attempt.test_version, 1, coalesce(p_response, '{}'::jsonb))
  on conflict (attempt_id, question_id) do update
    set response = excluded.response,
        test_version = excluded.test_version, question_revision = excluded.question_revision,
        updated_at = now()
  returning id into v_resp_id;
  return v_resp_id;
end;
$$;

create or replace function public.ielts_submit_attempt_section(p_section_id uuid)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sec public.ielts_attempt_sections%rowtype;
  v_attempt public.ielts_attempts%rowtype;
  v_submitted timestamptz;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_sec from public.ielts_attempt_sections where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  if v_sec.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  select * into v_attempt from public.ielts_attempts where id = v_sec.attempt_id;
  if not found or v_attempt.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_attempt.status <> 'in_progress' then raise exception 'ATTEMPT_NOT_IN_PROGRESS'; end if;
  if v_sec.submitted_at is not null then return v_sec.submitted_at; end if;
  update public.ielts_attempt_sections set submitted_at = now(), paused_at = null, updated_at = now()
  where id = p_section_id returning submitted_at into v_submitted;
  return v_submitted;
end;
$$;

revoke execute on function public.ielts_start_attempt_section(uuid) from public, anon;
revoke execute on function public.ielts_pause_attempt_section(uuid) from public, anon;
revoke execute on function public.ielts_resume_attempt_section(uuid) from public, anon;
revoke execute on function public.ielts_record_question_response(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.ielts_submit_attempt_section(uuid) from public, anon;
grant execute on function public.ielts_start_attempt_section(uuid) to authenticated, service_role;
grant execute on function public.ielts_pause_attempt_section(uuid) to authenticated, service_role;
grant execute on function public.ielts_resume_attempt_section(uuid) to authenticated, service_role;
grant execute on function public.ielts_record_question_response(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.ielts_submit_attempt_section(uuid) to authenticated, service_role;

commit;
