-- IELTS attempt security foundation.
--
-- New attempts receive an immutable question blueprint. Learner mutations use
-- attempt-bound RPCs so a forged attempt/section/question tuple cannot be
-- redirected to another resource. The original one-argument RPCs remain as
-- compatibility wrappers for older clients; they derive the attempt from the
-- section and therefore cannot bind a caller-supplied cross-attempt id.

begin;

-- The browser recorder normalizes Speaking captures to WAV PCM. Keep the
-- private practice bucket contract aligned with that client output while
-- retaining the formats used by older mobile/debate practice clients.
update storage.buckets
   set allowed_mime_types = array[
     'audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/m4a',
     'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/wave', 'audio/x-wav'
   ]::text[]
 where id = 'practice-audio';

alter table public.ielts_attempts
  add column if not exists blueprint_frozen_at timestamptz;

create table if not exists public.ielts_attempt_question_blueprints (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  section_id uuid not null references public.ielts_attempt_sections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_id uuid not null references public.ielts_tests(id) on delete restrict,
  question_id uuid not null references public.ielts_questions(id) on delete restrict,
  skill public.ielts_skill not null,
  question_type public.ielts_question_type not null,
  question_revision integer not null default 1 check (question_revision > 0),
  question_order integer not null,
  group_key text,
  group_instructions text,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  max_points integer not null check (max_points >= 0),
  word_limit integer check (word_limit is null or word_limit > 0),
  visual jsonb,
  metadata jsonb not null default '{}'::jsonb,
  passage_id uuid,
  listening_section_id uuid,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  unique (attempt_id, section_id, question_order)
);

create index if not exists ielts_attempt_question_blueprints_attempt_idx
  on public.ielts_attempt_question_blueprints(attempt_id, section_id, question_order);
create index if not exists ielts_attempt_question_blueprints_user_idx
  on public.ielts_attempt_question_blueprints(user_id, attempt_id);

-- Answer keys are frozen separately so the learner-facing blueprint can remain
-- readable without ever exposing secret answers.
create table if not exists public.ielts_attempt_question_keys (
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  question_id uuid not null references public.ielts_questions(id) on delete restrict,
  correct_answer jsonb not null default '{}'::jsonb,
  accept_variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
alter table public.ielts_attempt_question_keys enable row level security;
revoke all on public.ielts_attempt_question_keys from anon, authenticated;
grant all on public.ielts_attempt_question_keys to service_role;

-- The snapshot is intentionally append-only. A new attempt gets a new
-- snapshot; changing an existing attempt's blueprint would invalidate grading.
create or replace function private.prevent_ielts_attempt_blueprint_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'IELTS_ATTEMPT_BLUEPRINT_IMMUTABLE';
end;
$$;

drop trigger if exists ielts_attempt_blueprint_immutable
  on public.ielts_attempt_question_blueprints;
create trigger ielts_attempt_blueprint_immutable
  before update or delete on public.ielts_attempt_question_blueprints
  for each row execute function private.prevent_ielts_attempt_blueprint_mutation();
drop trigger if exists ielts_attempt_question_keys_immutable
  on public.ielts_attempt_question_keys;
create trigger ielts_attempt_question_keys_immutable
  before update or delete on public.ielts_attempt_question_keys
  for each row execute function private.prevent_ielts_attempt_blueprint_mutation();

-- Keep response rows bound even when they are written by a privileged service
-- path. Legacy rows with a NULL section remain readable, but any new/updated
-- section binding must match the attempt, owner, test, skill, and frozen item.
create or replace function private.validate_ielts_question_response_binding()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_attempt public.ielts_attempts%rowtype;
  v_section public.ielts_attempt_sections%rowtype;
  v_question public.ielts_questions%rowtype;
begin
  select * into v_attempt
    from public.ielts_attempts
   where id = new.attempt_id;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if new.user_id <> v_attempt.user_id then raise exception 'RESPONSE_OWNER_MISMATCH'; end if;

  if new.section_id is not null then
    select * into v_section
      from public.ielts_attempt_sections
     where id = new.section_id;
    if not found then raise exception 'SECTION_NOT_FOUND'; end if;
    if v_section.attempt_id <> new.attempt_id then
      raise exception 'RESPONSE_SECTION_ATTEMPT_MISMATCH';
    end if;
    if v_section.user_id <> new.user_id then raise exception 'RESPONSE_SECTION_OWNER_MISMATCH'; end if;
    if v_attempt.blueprint_frozen_at is not null then
      if v_section.skill <> (
        select b.skill from public.ielts_attempt_question_blueprints b
         where b.attempt_id = new.attempt_id and b.question_id = new.question_id
           and (new.section_id is null or b.section_id = new.section_id)
      ) then raise exception 'RESPONSE_SECTION_SKILL_MISMATCH'; end if;
    elsif v_section.skill <> (select skill from public.ielts_questions where id = new.question_id) then
      raise exception 'RESPONSE_SECTION_SKILL_MISMATCH';
    end if;
  end if;

  if v_attempt.blueprint_frozen_at is not null then
    if not exists (
      select 1 from public.ielts_attempt_question_blueprints b
       where b.attempt_id = new.attempt_id
         and b.question_id = new.question_id
         and (new.section_id is null or b.section_id = new.section_id)
         and b.test_id = v_attempt.test_id
         and new.test_version = v_attempt.test_version
         and new.question_revision = b.question_revision
    ) then
      raise exception 'QUESTION_NOT_IN_FROZEN_ATTEMPT';
    end if;
  else
    select * into v_question from public.ielts_questions where id = new.question_id;
    if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
    if v_question.test_id <> v_attempt.test_id then raise exception 'QUESTION_NOT_IN_TEST'; end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ielts_question_response_binding
  on public.ielts_question_responses;
create trigger ielts_question_response_binding
  before insert or update of attempt_id, user_id, question_id, section_id
  on public.ielts_question_responses
  for each row execute function private.validate_ielts_question_response_binding();

-- Existing attempts are frozen at migration time so re-grading cannot change
-- their interpretation after authoring edits. Attempts without authored items
-- retain the legacy path and remain visible for compatibility.
insert into public.ielts_attempt_question_blueprints (
  attempt_id, section_id, user_id, test_id, question_id, skill, question_type,
  question_order, group_key, group_instructions, prompt, options, max_points,
  word_limit, visual, metadata, passage_id, listening_section_id,
  source_updated_at
)
select a.id, s.id, a.user_id, a.test_id, q.id, q.skill, q.question_type,
       q.order_index, q.group_key, q.group_instructions, q.prompt, q.options,
       q.max_points, q.word_limit, q.visual, q.metadata, q.passage_id,
       q.listening_section_id, q.updated_at
  from public.ielts_attempts a
  join public.ielts_attempt_sections s on s.attempt_id = a.id and s.user_id = a.user_id
  join public.ielts_questions q on q.test_id = a.test_id and q.skill = s.skill
 where a.blueprint_frozen_at is null
on conflict (attempt_id, question_id) do nothing;

insert into public.ielts_attempt_question_keys (attempt_id, question_id, correct_answer, accept_variants)
select b.attempt_id, b.question_id,
       coalesce(k.correct_answer, '{}'::jsonb),
       coalesce(k.accept_variants, '[]'::jsonb)
  from public.ielts_attempt_question_blueprints b
  left join public.ielts_question_keys k on k.question_id = b.question_id
on conflict (attempt_id, question_id) do nothing;

update public.ielts_attempts a
   set blueprint_frozen_at = coalesce(a.blueprint_frozen_at, a.created_at),
       updated_at = now()
 where a.blueprint_frozen_at is null
   and exists (select 1 from public.ielts_attempt_question_blueprints b where b.attempt_id = a.id);

-- Shared checks for all attempt-bound learner operations.
create or replace function private.ielts_assert_attempt_section(
  p_attempt_id uuid,
  p_section_id uuid,
  p_require_in_progress boolean default true
)
returns public.ielts_attempt_sections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.ielts_attempts%rowtype;
  v_section public.ielts_attempt_sections%rowtype;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_attempt from public.ielts_attempts where id = p_attempt_id for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if p_require_in_progress and v_attempt.status <> 'in_progress' then
    raise exception 'ATTEMPT_NOT_IN_PROGRESS';
  end if;
  if v_attempt.expires_at is not null and now() > v_attempt.expires_at then
    raise exception 'ATTEMPT_EXPIRED';
  end if;
  select * into v_section from public.ielts_attempt_sections
   where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  if v_section.attempt_id <> p_attempt_id then
    raise exception 'ATTEMPT_SECTION_MISMATCH';
  end if;
  if v_section.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  return v_section;
end;
$$;

revoke all on function private.ielts_assert_attempt_section(uuid, uuid, boolean)
  from public, anon, authenticated;

-- Attempt creation is one transaction. The server passes only the requested
-- section shape; this function reads the question bank, snapshots content and
-- answer keys, then marks the attempt frozen as the final statement.
create or replace function public.ielts_create_attempt_with_blueprint(
  p_user_id uuid,
  p_test_id uuid,
  p_module public.ielts_module,
  p_attempt_number integer,
  p_sections jsonb,
  p_club_id uuid default null,
  p_class_id uuid default null,
  p_assignment_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_attempt_id uuid;
  v_test public.ielts_tests%rowtype;
begin
  if p_user_id is null or p_test_id is null then raise exception 'INVALID_ATTEMPT_CONTEXT'; end if;
  if jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) = 0 then
    raise exception 'EMPTY_ATTEMPT_BLUEPRINT';
  end if;
  select * into v_test from public.ielts_tests where id = p_test_id;
  if not found then raise exception 'TEST_NOT_FOUND'; end if;
  if v_test.module <> p_module then raise exception 'TEST_MODULE_MISMATCH'; end if;

  insert into public.ielts_attempts (
    user_id, test_id, module, status, attempt_number, club_id, class_id,
    assignment_id, assessment_mode, test_version, blueprint_frozen_at
  ) values (
    p_user_id, p_test_id, p_module, 'in_progress', greatest(p_attempt_number, 1),
    p_club_id, p_class_id, p_assignment_id, v_test.assessment_mode, v_test.version, null
  ) returning id into v_attempt_id;

  insert into public.ielts_attempt_sections (
    attempt_id, user_id, skill, section_order, label, time_limit_seconds
  )
  select v_attempt_id, p_user_id, x.skill::public.ielts_skill, x.section_order,
         x.label, x.time_limit_seconds
    from jsonb_to_recordset(p_sections) as x(
      skill text, section_order integer, label text, time_limit_seconds integer
    )
   where not (v_test.assessment_mode = 'simulation' and x.skill = 'speaking');
  if not exists (select 1 from public.ielts_attempt_sections where attempt_id = v_attempt_id) then
    raise exception 'EMPTY_ATTEMPT_BLUEPRINT';
  end if;
  if v_test.assessment_mode = 'simulation' and (
    (select count(*) from public.ielts_attempt_sections where attempt_id = v_attempt_id) <> 3
    or (select count(distinct skill) from public.ielts_attempt_sections where attempt_id = v_attempt_id and skill in ('listening','reading','writing')) <> 3
  ) then raise exception 'SIMULATION_REQUIRES_LISTENING_READING_WRITING'; end if;

  insert into public.ielts_attempt_question_blueprints (
    attempt_id, section_id, user_id, test_id, question_id, skill, question_type,
    question_order, group_key, group_instructions, prompt, options, max_points,
    word_limit, visual, metadata, passage_id, listening_section_id, source_updated_at
  )
  select v_attempt_id, s.id, p_user_id, q.test_id, q.id, q.skill, q.question_type,
         q.order_index, q.group_key, q.group_instructions, q.prompt, q.options,
         q.max_points, q.word_limit, q.visual, q.metadata, q.passage_id,
         q.listening_section_id, q.updated_at
    from public.ielts_attempt_sections s
    join public.ielts_questions q
      on q.test_id = p_test_id and q.skill = s.skill
   where s.attempt_id = v_attempt_id;
  if exists (
    select 1 from public.ielts_attempt_sections s
     where s.attempt_id = v_attempt_id
       and not exists (select 1 from public.ielts_attempt_question_blueprints b where b.section_id = s.id)
  ) then raise exception 'INCOMPLETE_ATTEMPT_BLUEPRINT'; end if;

  insert into public.ielts_attempt_question_keys (attempt_id, question_id, correct_answer, accept_variants)
  select b.attempt_id, b.question_id, coalesce(k.correct_answer, '{}'::jsonb),
         coalesce(k.accept_variants, '[]'::jsonb)
    from public.ielts_attempt_question_blueprints b
    left join public.ielts_question_keys k on k.question_id = b.question_id
   where b.attempt_id = v_attempt_id;

  update public.ielts_attempts
     set blueprint_frozen_at = now(), updated_at = now()
   where id = v_attempt_id;
  return v_attempt_id;
end;
$$;

create or replace function public.ielts_start_attempt_section_v2(
  p_attempt_id uuid, p_section_id uuid
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_sec public.ielts_attempt_sections%rowtype; v_attempt public.ielts_attempts%rowtype;
begin
  v_sec := private.ielts_assert_attempt_section(p_attempt_id, p_section_id);
  select * into v_attempt from public.ielts_attempts where id = p_attempt_id;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  if v_attempt.assessment_mode = 'simulation' then
    if v_sec.skill not in ('listening', 'reading', 'writing') then
      raise exception 'SIMULATION_SPEAKING_REHEARSAL_SEPARATE';
    end if;
    if exists (select 1 from public.ielts_attempt_sections prior where prior.attempt_id = p_attempt_id and prior.section_order < v_sec.section_order and prior.submitted_at is null)
       or exists (select 1 from public.ielts_attempt_sections later where later.attempt_id = p_attempt_id and later.section_order > v_sec.section_order and later.started_at is not null) then
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

create or replace function public.ielts_pause_attempt_section_v2(
  p_attempt_id uuid, p_section_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sec public.ielts_attempt_sections%rowtype; v_mode public.ielts_assessment_mode;
begin
  v_sec := private.ielts_assert_attempt_section(p_attempt_id, p_section_id);
  select assessment_mode into v_mode from public.ielts_attempts where id = p_attempt_id;
  if v_mode = 'simulation' then raise exception 'SIMULATION_CANNOT_PAUSE'; end if;
  if v_sec.started_at is null then raise exception 'SECTION_NOT_STARTED'; end if;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  if v_sec.paused_at is not null then return; end if;
  if v_sec.deadline_at is not null and now() > v_sec.deadline_at then raise exception 'SECTION_EXPIRED'; end if;
  update public.ielts_attempt_sections set paused_at = now(), updated_at = now() where id = p_section_id;
end;
$$;

create or replace function public.ielts_resume_attempt_section_v2(
  p_attempt_id uuid, p_section_id uuid
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_sec public.ielts_attempt_sections%rowtype; v_paused interval; v_deadline timestamptz; v_mode public.ielts_assessment_mode;
begin
  v_sec := private.ielts_assert_attempt_section(p_attempt_id, p_section_id);
  select assessment_mode into v_mode from public.ielts_attempts where id = p_attempt_id;
  if v_mode = 'simulation' then raise exception 'SIMULATION_CANNOT_PAUSE'; end if;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  if v_sec.paused_at is null then return v_sec.deadline_at; end if;
  v_paused := now() - v_sec.paused_at;
  update public.ielts_attempt_sections
     set deadline_at = case when v_sec.deadline_at is null then null else v_sec.deadline_at + v_paused end,
         paused_seconds = v_sec.paused_seconds + floor(extract(epoch from v_paused))::integer,
         paused_at = null, updated_at = now()
   where id = p_section_id returning deadline_at into v_deadline;
  return v_deadline;
end;
$$;

create or replace function public.ielts_record_question_response_v2(
  p_attempt_id uuid, p_section_id uuid, p_question_id uuid, p_response jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_sec public.ielts_attempt_sections%rowtype;
  v_attempt public.ielts_attempts%rowtype;
  v_question public.ielts_questions%rowtype;
  v_response_id uuid;
begin
  v_sec := private.ielts_assert_attempt_section(p_attempt_id, p_section_id);
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  if v_sec.paused_at is not null then raise exception 'SECTION_PAUSED'; end if;
  if v_sec.started_at is null then raise exception 'SECTION_NOT_STARTED'; end if;
  if v_sec.deadline_at is not null and now() > v_sec.deadline_at + interval '2 seconds' then raise exception 'SECTION_EXPIRED'; end if;
  select * into v_attempt from public.ielts_attempts where id = p_attempt_id;
  if v_attempt.blueprint_frozen_at is not null then
    if not exists (
      select 1 from public.ielts_attempt_question_blueprints b
       where b.attempt_id = p_attempt_id and b.section_id = p_section_id
         and b.question_id = p_question_id and b.test_id = v_attempt.test_id
         and b.skill = v_sec.skill
    ) then raise exception 'QUESTION_NOT_IN_FROZEN_ATTEMPT'; end if;
    if v_attempt.assessment_mode = 'simulation' and v_sec.skill = 'speaking' then
      raise exception 'SIMULATION_SPEAKING_REHEARSAL_SEPARATE';
    end if;
  else
    select * into v_question from public.ielts_questions where id = p_question_id;
    if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
    if v_question.test_id <> v_attempt.test_id then raise exception 'QUESTION_NOT_IN_TEST'; end if;
    if v_question.skill <> v_sec.skill then raise exception 'QUESTION_SKILL_MISMATCH'; end if;
  end if;
  insert into public.ielts_question_responses (
    attempt_id, user_id, question_id, section_id, test_version, question_revision, response
  )
  values (
    p_attempt_id, v_attempt.user_id, p_question_id, p_section_id,
    v_attempt.test_version, 1, coalesce(p_response, '{}'::jsonb)
  )
  on conflict (attempt_id, question_id) do update
    set section_id = excluded.section_id, test_version = excluded.test_version,
        question_revision = excluded.question_revision, response = excluded.response, updated_at = now()
  returning id into v_response_id;
  return v_response_id;
end;
$$;

create or replace function public.ielts_submit_attempt_section_v2(
  p_attempt_id uuid, p_section_id uuid
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_sec public.ielts_attempt_sections%rowtype; v_submitted timestamptz;
begin
  v_sec := private.ielts_assert_attempt_section(p_attempt_id, p_section_id);
  if v_sec.submitted_at is not null then return v_sec.submitted_at; end if;
  if v_sec.started_at is null then raise exception 'SECTION_NOT_STARTED'; end if;
  if v_sec.deadline_at is not null and now() > v_sec.deadline_at + interval '2 seconds' then raise exception 'SECTION_EXPIRED'; end if;
  update public.ielts_attempt_sections set submitted_at = now(), paused_at = null, updated_at = now()
   where id = p_section_id returning submitted_at into v_submitted;
  return v_submitted;
end;
$$;

-- Atomic finalization: every persisted section must be submitted before the
-- attempt can enter grading. This is callable only by the owning learner.
create or replace function public.ielts_finalize_attempt(p_attempt_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_attempt public.ielts_attempts%rowtype; v_submitted timestamptz;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_attempt from public.ielts_attempts where id = p_attempt_id for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_attempt.status = 'submitted' or v_attempt.status = 'scoring' or v_attempt.status = 'completed' then return coalesce(v_attempt.submitted_at, v_attempt.updated_at); end if;
  if v_attempt.status <> 'in_progress' then raise exception 'ATTEMPT_NOT_IN_PROGRESS'; end if;
  if not exists (select 1 from public.ielts_attempt_sections where attempt_id = p_attempt_id) then raise exception 'ATTEMPT_INCOMPLETE'; end if;
  if v_attempt.assessment_mode = 'simulation' then
    if (select count(*) from public.ielts_attempt_sections where attempt_id = p_attempt_id) <> 3
       or (select count(distinct skill) from public.ielts_attempt_sections where attempt_id = p_attempt_id and skill in ('listening','reading','writing')) <> 3
       or exists (select 1 from public.ielts_attempt_sections where attempt_id = p_attempt_id and skill not in ('listening','reading','writing')) then
      raise exception 'SIMULATION_REQUIRES_LISTENING_READING_WRITING';
    end if;
  end if;
  if exists (select 1 from public.ielts_attempt_sections where attempt_id = p_attempt_id and (started_at is null or submitted_at is null)) then raise exception 'ATTEMPT_INCOMPLETE'; end if;
  if exists (select 1 from public.ielts_attempt_sections where attempt_id = p_attempt_id and deadline_at is not null and submitted_at > deadline_at + interval '2 seconds') then raise exception 'SECTION_EXPIRED'; end if;
  update public.ielts_attempts set status = 'submitted', submitted_at = now(), updated_at = now()
   where id = p_attempt_id returning submitted_at into v_submitted;
  return v_submitted;
end;
$$;

-- Compatibility wrappers derive the authoritative attempt from the section.
create or replace function public.ielts_start_attempt_section(p_section_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_attempt uuid; begin select attempt_id into v_attempt from public.ielts_attempt_sections where id = p_section_id; if not found then raise exception 'SECTION_NOT_FOUND'; end if; return public.ielts_start_attempt_section_v2(v_attempt, p_section_id); end; $$;
create or replace function public.ielts_pause_attempt_section(p_section_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempt uuid; begin select attempt_id into v_attempt from public.ielts_attempt_sections where id = p_section_id; if not found then raise exception 'SECTION_NOT_FOUND'; end if; perform public.ielts_pause_attempt_section_v2(v_attempt, p_section_id); end; $$;
create or replace function public.ielts_resume_attempt_section(p_section_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_attempt uuid; begin select attempt_id into v_attempt from public.ielts_attempt_sections where id = p_section_id; if not found then raise exception 'SECTION_NOT_FOUND'; end if; return public.ielts_resume_attempt_section_v2(v_attempt, p_section_id); end; $$;
create or replace function public.ielts_submit_attempt_section(p_section_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_attempt uuid; begin select attempt_id into v_attempt from public.ielts_attempt_sections where id = p_section_id; if not found then raise exception 'SECTION_NOT_FOUND'; end if; return public.ielts_submit_attempt_section_v2(v_attempt, p_section_id); end; $$;
create or replace function public.ielts_record_question_response(p_section_id uuid, p_question_id uuid, p_response jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_attempt uuid; begin select attempt_id into v_attempt from public.ielts_attempt_sections where id = p_section_id; if not found then raise exception 'SECTION_NOT_FOUND'; end if; return public.ielts_record_question_response_v2(v_attempt, p_section_id, p_question_id, p_response); end; $$;

alter table public.ielts_attempt_question_blueprints enable row level security;
revoke all on public.ielts_attempt_question_blueprints from anon, authenticated;
grant select on public.ielts_attempt_question_blueprints to authenticated;
grant all on public.ielts_attempt_question_blueprints to service_role;
drop policy if exists "Users view own IELTS attempt blueprints" on public.ielts_attempt_question_blueprints;
create policy "Users view own IELTS attempt blueprints" on public.ielts_attempt_question_blueprints
  for select using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

revoke execute on function public.ielts_start_attempt_section_v2(uuid, uuid) from public, anon;
revoke execute on function public.ielts_pause_attempt_section_v2(uuid, uuid) from public, anon;
revoke execute on function public.ielts_resume_attempt_section_v2(uuid, uuid) from public, anon;
revoke execute on function public.ielts_record_question_response_v2(uuid, uuid, uuid, jsonb) from public, anon;
revoke execute on function public.ielts_submit_attempt_section_v2(uuid, uuid) from public, anon;
revoke execute on function public.ielts_finalize_attempt(uuid) from public, anon;
revoke execute on function public.ielts_create_attempt_with_blueprint(uuid, uuid, public.ielts_module, integer, jsonb, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.ielts_start_attempt_section_v2(uuid, uuid) to authenticated, service_role;
grant execute on function public.ielts_pause_attempt_section_v2(uuid, uuid) to authenticated, service_role;
grant execute on function public.ielts_resume_attempt_section_v2(uuid, uuid) to authenticated, service_role;
grant execute on function public.ielts_record_question_response_v2(uuid, uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.ielts_submit_attempt_section_v2(uuid, uuid) to authenticated, service_role;
grant execute on function public.ielts_finalize_attempt(uuid) to authenticated, service_role;
grant execute on function public.ielts_create_attempt_with_blueprint(uuid, uuid, public.ielts_module, integer, jsonb, uuid, uuid, uuid) to service_role;

commit;
